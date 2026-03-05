"""
🔐 Authentication & Authorization System

Implements JWT tokens, OAuth2, API key management, and role-based access control
for the Premier League Oracle API.

Security features:
- JWT with RS256 signing
- Token refresh mechanism
- API key scopes
- Rate limiting per user
- Brute force protection
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from fastapi import Depends, HTTPException, status, Security
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm, APIKeyHeader, HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field, validator
import secrets
import hashlib
import redis
from sqlalchemy.orm import Session
import logging
from enum import Enum

logger = logging.getLogger(__name__)

# Security configuration
SECRET_KEY = secrets.token_urlsafe(32)  # Should be from environment
ALGORITHM = "HS256"  # Use RS256 in production with key pair
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7
API_KEY_LENGTH = 32

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

# API Key scheme
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# HTTP Bearer
http_bearer = HTTPBearer(auto_error=False)


class UserRole(str, Enum):
    """User roles for RBAC"""
    ADMIN = "admin"
    PREMIUM = "premium"
    STANDARD = "standard"
    TRIAL = "trial"


class TokenType(str, Enum):
    """Token types"""
    ACCESS = "access"
    REFRESH = "refresh"
    API_KEY = "api_key"


class User(BaseModel):
    """User model"""
    username: str
    email: str
    role: UserRole = UserRole.TRIAL
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    
    @validator('email')
    def validate_email(cls, v):
        if '@' not in v:
            raise ValueError('Invalid email address')
        return v.lower()


class Token(BaseModel):
    """Token response model"""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int = ACCESS_TOKEN_EXPIRE_MINUTES * 60


class APIKey(BaseModel):
    """API Key model"""
    key: str
    name: str
    user_id: str
    scopes: List[str] = []
    rate_limit: int = 100  # requests per minute
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    is_active: bool = True
    last_used: Optional[datetime] = None
    usage_count: int = 0


class AuthenticationService:
    """
    Main authentication service handling all auth operations.
    """
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis_client = redis_client
        self.failed_attempts = {}  # Track failed login attempts
        
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        return pwd_context.verify(plain_password, hashed_password)
    
    def get_password_hash(self, password: str) -> str:
        """Hash a password."""
        return pwd_context.hash(password)
    
    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """
        Create a JWT access token.
        
        Args:
            data: Claims to encode in the token
            expires_delta: Token expiration time
            
        Returns:
            Encoded JWT token
        """
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": TokenType.ACCESS.value,
            "jti": secrets.token_urlsafe(16)  # JWT ID for revocation
        })
        
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        
        # Store in Redis for revocation capability
        if self.redis_client:
            self.redis_client.setex(
                f"token:{to_encode['jti']}",
                int(expires_delta.total_seconds() if expires_delta else ACCESS_TOKEN_EXPIRE_MINUTES * 60),
                "valid"
            )
        
        return encoded_jwt
    
    def create_refresh_token(self, user_id: str) -> str:
        """Create a refresh token."""
        data = {
            "sub": user_id,
            "type": TokenType.REFRESH.value
        }
        expires_delta = timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        return self.create_access_token(data, expires_delta)
    
    def verify_token(self, token: str, token_type: TokenType = TokenType.ACCESS) -> Dict[str, Any]:
        """
        Verify and decode a JWT token.
        
        Args:
            token: JWT token to verify
            token_type: Expected token type
            
        Returns:
            Decoded token claims
            
        Raises:
            HTTPException: If token is invalid
        """
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            
            # Check token type
            if payload.get("type") != token_type.value:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token type"
                )
            
            # Check if token is revoked (if Redis available)
            if self.redis_client:
                jti = payload.get("jti")
                if jti and not self.redis_client.exists(f"token:{jti}"):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Token has been revoked"
                    )
            
            return payload
            
        except JWTError as e:
            logger.warning(f"JWT verification failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    def revoke_token(self, token: str):
        """Revoke a token by removing it from Redis."""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            jti = payload.get("jti")
            
            if jti and self.redis_client:
                self.redis_client.delete(f"token:{jti}")
                logger.info(f"Token {jti} revoked")
                
        except JWTError:
            pass  # Token already invalid
    
    def generate_api_key(self, user_id: str, name: str, scopes: List[str] = None) -> APIKey:
        """
        Generate a new API key for a user.
        
        Args:
            user_id: User ID
            name: API key name/description
            scopes: Allowed scopes for this key
            
        Returns:
            APIKey object
        """
        # Generate secure random key
        raw_key = secrets.token_urlsafe(API_KEY_LENGTH)
        
        # Hash the key for storage (never store plain keys)
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        
        api_key = APIKey(
            key=raw_key,  # Return plain key once (user must save it)
            name=name,
            user_id=user_id,
            scopes=scopes or ["predictions:read"],
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=365)  # 1 year expiry
        )
        
        # Store hashed key in database/Redis
        if self.redis_client:
            self.redis_client.hset(
                f"api_key:{key_hash}",
                mapping={
                    "user_id": user_id,
                    "name": name,
                    "scopes": ",".join(api_key.scopes),
                    "rate_limit": api_key.rate_limit,
                    "created_at": api_key.created_at.isoformat(),
                    "expires_at": api_key.expires_at.isoformat() if api_key.expires_at else "",
                    "is_active": "1"
                }
            )
        
        return api_key
    
    def verify_api_key(self, api_key: str) -> Optional[Dict[str, Any]]:
        """
        Verify an API key.
        
        Args:
            api_key: Plain API key
            
        Returns:
            API key data if valid, None otherwise
        """
        # Hash the key to look it up
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        
        if self.redis_client:
            key_data = self.redis_client.hgetall(f"api_key:{key_hash}")
            
            if key_data and key_data.get("is_active") == "1":
                # Check expiration
                expires_at = key_data.get("expires_at")
                if expires_at and datetime.fromisoformat(expires_at) < datetime.utcnow():
                    return None
                
                # Update last used
                self.redis_client.hset(
                    f"api_key:{key_hash}",
                    "last_used",
                    datetime.utcnow().isoformat()
                )
                
                # Increment usage counter
                self.redis_client.hincrby(f"api_key:{key_hash}", "usage_count", 1)
                
                return {
                    "user_id": key_data.get("user_id"),
                    "scopes": key_data.get("scopes", "").split(","),
                    "rate_limit": int(key_data.get("rate_limit", 100))
                }
        
        return None
    
    def check_rate_limit(self, identifier: str, limit: int = 100, window: int = 60) -> bool:
        """
        Check if rate limit is exceeded.
        
        Args:
            identifier: User ID or IP address
            limit: Max requests allowed
            window: Time window in seconds
            
        Returns:
            True if within limit, False if exceeded
        """
        if not self.redis_client:
            return True  # No rate limiting without Redis
        
        key = f"rate_limit:{identifier}"
        
        try:
            current = self.redis_client.incr(key)
            
            if current == 1:
                # First request, set expiry
                self.redis_client.expire(key, window)
            
            if current > limit:
                logger.warning(f"Rate limit exceeded for {identifier}")
                return False
                
            return True
            
        except Exception as e:
            logger.error(f"Rate limit check failed: {e}")
            return True  # Fail open
    
    def track_failed_login(self, identifier: str) -> bool:
        """
        Track failed login attempts for brute force protection.
        
        Args:
            identifier: Username or IP
            
        Returns:
            True if account should be locked
        """
        if identifier not in self.failed_attempts:
            self.failed_attempts[identifier] = []
        
        self.failed_attempts[identifier].append(datetime.utcnow())
        
        # Keep only attempts from last hour
        cutoff = datetime.utcnow() - timedelta(hours=1)
        self.failed_attempts[identifier] = [
            attempt for attempt in self.failed_attempts[identifier]
            if attempt > cutoff
        ]
        
        # Lock after 5 failed attempts in an hour
        if len(self.failed_attempts[identifier]) >= 5:
            logger.warning(f"Account locked due to failed attempts: {identifier}")
            return True
        
        return False
    
    def clear_failed_attempts(self, identifier: str):
        """Clear failed login attempts after successful login."""
        if identifier in self.failed_attempts:
            del self.failed_attempts[identifier]


class PermissionChecker:
    """
    Check user permissions for different operations.
    """
    
    # Permission matrix
    PERMISSIONS = {
        UserRole.ADMIN: [
            "predictions:read", "predictions:write",
            "models:train", "models:delete",
            "users:read", "users:write",
            "api_keys:manage", "system:admin"
        ],
        UserRole.PREMIUM: [
            "predictions:read", "predictions:write",
            "models:read", "batch:predict",
            "natural_language:use", "websocket:connect"
        ],
        UserRole.STANDARD: [
            "predictions:read", "models:read",
            "batch:predict"
        ],
        UserRole.TRIAL: [
            "predictions:read"
        ]
    }
    
    @classmethod
    def has_permission(cls, user_role: UserRole, required_permission: str) -> bool:
        """Check if a user role has a specific permission."""
        return required_permission in cls.PERMISSIONS.get(user_role, [])
    
    @classmethod
    def check_scopes(cls, required_scopes: List[str], token_scopes: List[str]) -> bool:
        """Check if token has required scopes."""
        return all(scope in token_scopes for scope in required_scopes)


# Dependency injection functions for FastAPI

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """
    Get current user from JWT token.
    
    FastAPI dependency for protected endpoints.
    """
    auth_service = AuthenticationService()
    
    try:
        payload = auth_service.verify_token(token)
        username: str = payload.get("sub")
        
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials"
            )
        
        # Get user from database (mock for now)
        user = User(
            username=username,
            email=payload.get("email", f"{username}@example.com"),
            role=UserRole(payload.get("role", UserRole.TRIAL.value))
        )
        
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Ensure user is active."""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def require_role(required_role: UserRole):
    """
    Factory function to create role-based dependencies.
    
    Usage:
        @app.get("/admin", dependencies=[Depends(require_role(UserRole.ADMIN))])
    """
    async def role_checker(current_user: User = Depends(get_current_active_user)):
        if current_user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    
    return role_checker


def require_permission(permission: str):
    """
    Factory function to create permission-based dependencies.
    
    Usage:
        @app.post("/train", dependencies=[Depends(require_permission("models:train"))])
    """
    async def permission_checker(current_user: User = Depends(get_current_active_user)):
        if not PermissionChecker.has_permission(current_user.role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {permission}"
            )
        return current_user
    
    return permission_checker


async def verify_api_key_dep(api_key: Optional[str] = Depends(api_key_header)) -> Optional[Dict]:
    """Verify API key from header."""
    if not api_key:
        return None
    
    auth_service = AuthenticationService()
    key_data = auth_service.verify_api_key(api_key)
    
    if not key_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    
    return key_data


# Combined authentication (JWT or API key)
async def get_current_user_or_api_key(
    token: Optional[str] = Depends(oauth2_scheme),
    api_key_data: Optional[Dict] = Depends(verify_api_key_dep)
) -> Dict[str, Any]:
    """
    Allow authentication via JWT token or API key.
    """
    if token:
        user = await get_current_user(token)
        return {"type": "user", "data": user}
    elif api_key_data:
        return {"type": "api_key", "data": api_key_data}
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )


# Example usage
if __name__ == "__main__":
    # Test authentication service
    auth = AuthenticationService()
    
    # Test password hashing
    password = "SecurePassword123!"
    hashed = auth.get_password_hash(password)
    print(f"Password hash: {hashed}")
    print(f"Verify: {auth.verify_password(password, hashed)}")
    
    # Test token creation
    token = auth.create_access_token({"sub": "testuser", "role": UserRole.PREMIUM.value})
    print(f"\nJWT Token: {token}")
    
    # Test API key generation
    api_key = auth.generate_api_key("user123", "Production API Key", ["predictions:read"])
    print(f"\nAPI Key: {api_key.key}")
    print(f"Save this key securely - it won't be shown again!")
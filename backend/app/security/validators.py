"""
🛡️ Input Validation and Sanitization

Comprehensive input validation to prevent injection attacks, XSS, and other
security vulnerabilities in the Premier League Oracle system.

Security features:
- SQL injection prevention
- XSS protection
- Path traversal prevention
- Command injection prevention
- Input type validation
- Data sanitization
"""

import re
import html
import os
from typing import Any, Dict, List, Optional, Union
from pathlib import Path
from pydantic import BaseModel, Field, validator, ValidationError
from fastapi import HTTPException, status
import logging
import json
from urllib.parse import urlparse
import ipaddress

logger = logging.getLogger(__name__)

# Validation patterns
PATTERNS = {
    'team_name': r'^[A-Za-z\s&\-\.\']+(?:\s(?:FC|United|City|Town|Hotspur|Albion|Rovers|Wanderers|Athletic|County))?$',
    'username': r'^[a-zA-Z0-9_-]{3,32}$',
    'email': r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
    'api_key': r'^[A-Za-z0-9_-]{32,64}$',
    'date': r'^\d{4}-\d{2}-\d{2}$',
    'season': r'^\d{4}\/\d{4}$',
    'safe_string': r'^[a-zA-Z0-9\s\-_\.]+$',
    'numeric_id': r'^\d+$',
}

# Blacklisted SQL keywords (case-insensitive)
SQL_BLACKLIST = [
    'select', 'insert', 'update', 'delete', 'drop', 'create', 'alter',
    'exec', 'execute', 'union', 'from', 'where', 'join', 'script',
    'javascript', 'onclick', 'onerror', 'onload', 'eval', 'setTimeout'
]

# Valid Premier League teams (current season)
VALID_TEAMS = {
    "Arsenal FC", "Arsenal",
    "Aston Villa FC", "Aston Villa",
    "AFC Bournemouth", "Bournemouth",
    "Brentford FC", "Brentford",
    "Brighton & Hove Albion FC", "Brighton & Hove Albion", "Brighton",
    "Burnley FC", "Burnley",
    "Chelsea FC", "Chelsea",
    "Crystal Palace FC", "Crystal Palace",
    "Everton FC", "Everton",
    "Fulham FC", "Fulham",
    "Liverpool FC", "Liverpool",
    "Luton Town FC", "Luton Town", "Luton",
    "Manchester City FC", "Manchester City", "Man City",
    "Manchester United FC", "Manchester United", "Man United",
    "Newcastle United FC", "Newcastle United", "Newcastle",
    "Nottingham Forest FC", "Nottingham Forest",
    "Sheffield United FC", "Sheffield United",
    "Tottenham Hotspur FC", "Tottenham Hotspur", "Tottenham", "Spurs",
    "West Ham United FC", "West Ham United", "West Ham",
    "Wolverhampton Wanderers FC", "Wolverhampton Wanderers", "Wolves"
}


class InputValidator:
    """
    Main input validation class with various validation methods.
    """
    
    @staticmethod
    def validate_team_name(team_name: str, strict: bool = True) -> str:
        """
        Validate and sanitize team name.
        
        Args:
            team_name: Team name to validate
            strict: If True, only allow known Premier League teams
            
        Returns:
            Sanitized team name
            
        Raises:
            ValidationError: If team name is invalid
        """
        if not team_name or not isinstance(team_name, str):
            raise ValidationError("Team name must be a non-empty string")
        
        # Remove leading/trailing whitespace
        team_name = team_name.strip()
        
        # Check length
        if len(team_name) < 2 or len(team_name) > 50:
            raise ValidationError("Team name must be between 2 and 50 characters")
        
        # Check for SQL injection attempts
        if InputValidator._contains_sql_injection(team_name):
            logger.warning(f"SQL injection attempt detected: {team_name}")
            raise ValidationError("Invalid characters in team name")
        
        # Check against pattern
        if not re.match(PATTERNS['team_name'], team_name):
            raise ValidationError("Team name contains invalid characters")
        
        # Strict mode: only allow known teams
        if strict and team_name not in VALID_TEAMS:
            raise ValidationError(f"Unknown team: {team_name}")
        
        # HTML escape for XSS prevention
        return html.escape(team_name)
    
    @staticmethod
    def validate_username(username: str) -> str:
        """Validate username format."""
        if not username or not isinstance(username, str):
            raise ValidationError("Username must be a non-empty string")
        
        username = username.strip().lower()
        
        if not re.match(PATTERNS['username'], username):
            raise ValidationError("Username must be 3-32 characters, alphanumeric with _ and -")
        
        # Check for SQL injection
        if InputValidator._contains_sql_injection(username):
            raise ValidationError("Invalid username")
        
        return username
    
    @staticmethod
    def validate_email(email: str) -> str:
        """Validate email format."""
        if not email or not isinstance(email, str):
            raise ValidationError("Email must be a non-empty string")
        
        email = email.strip().lower()
        
        if not re.match(PATTERNS['email'], email):
            raise ValidationError("Invalid email format")
        
        if len(email) > 255:
            raise ValidationError("Email too long")
        
        return html.escape(email)
    
    @staticmethod
    def validate_password(password: str) -> str:
        """
        Validate password strength.
        
        Requirements:
        - At least 8 characters
        - Contains uppercase and lowercase
        - Contains numbers
        - Contains special characters
        """
        if not password or not isinstance(password, str):
            raise ValidationError("Password must be a non-empty string")
        
        if len(password) < 8:
            raise ValidationError("Password must be at least 8 characters")
        
        if len(password) > 128:
            raise ValidationError("Password too long")
        
        if not re.search(r'[A-Z]', password):
            raise ValidationError("Password must contain uppercase letters")
        
        if not re.search(r'[a-z]', password):
            raise ValidationError("Password must contain lowercase letters")
        
        if not re.search(r'\d', password):
            raise ValidationError("Password must contain numbers")
        
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            raise ValidationError("Password must contain special characters")
        
        return password  # Don't escape passwords
    
    @staticmethod
    def validate_api_key(api_key: str) -> str:
        """Validate API key format."""
        if not api_key or not isinstance(api_key, str):
            raise ValidationError("API key must be a non-empty string")
        
        api_key = api_key.strip()
        
        if not re.match(PATTERNS['api_key'], api_key):
            raise ValidationError("Invalid API key format")
        
        return api_key
    
    @staticmethod
    def validate_date(date_str: str) -> str:
        """Validate date format (YYYY-MM-DD)."""
        if not date_str or not isinstance(date_str, str):
            raise ValidationError("Date must be a non-empty string")
        
        if not re.match(PATTERNS['date'], date_str):
            raise ValidationError("Date must be in YYYY-MM-DD format")
        
        # Additional date validation
        try:
            from datetime import datetime
            datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            raise ValidationError("Invalid date")
        
        return date_str
    
    @staticmethod
    def validate_numeric_id(id_value: Union[str, int]) -> int:
        """Validate numeric ID."""
        if isinstance(id_value, int):
            if id_value < 0:
                raise ValidationError("ID must be positive")
            return id_value
        
        if isinstance(id_value, str):
            if not re.match(PATTERNS['numeric_id'], id_value):
                raise ValidationError("ID must be numeric")
            
            try:
                id_int = int(id_value)
                if id_int < 0:
                    raise ValidationError("ID must be positive")
                return id_int
            except ValueError:
                raise ValidationError("Invalid ID")
        
        raise ValidationError("ID must be numeric")
    
    @staticmethod
    def validate_file_path(file_path: str, base_dir: Optional[str] = None) -> str:
        """
        Validate file path to prevent path traversal attacks.
        
        Args:
            file_path: Path to validate
            base_dir: Base directory to restrict access to
            
        Returns:
            Safe file path
        """
        if not file_path or not isinstance(file_path, str):
            raise ValidationError("File path must be a non-empty string")
        
        # Normalize the path
        file_path = os.path.normpath(file_path)
        
        # Check for path traversal attempts
        if '..' in file_path or file_path.startswith('/'):
            logger.warning(f"Path traversal attempt: {file_path}")
            raise ValidationError("Invalid file path")
        
        # If base_dir provided, ensure path is within it
        if base_dir:
            base_dir = os.path.abspath(base_dir)
            full_path = os.path.abspath(os.path.join(base_dir, file_path))
            
            if not full_path.startswith(base_dir):
                logger.warning(f"Path escape attempt: {full_path}")
                raise ValidationError("File path outside allowed directory")
            
            return full_path
        
        return file_path
    
    @staticmethod
    def validate_url(url: str, allowed_domains: Optional[List[str]] = None) -> str:
        """
        Validate URL format and optionally restrict to allowed domains.
        
        Args:
            url: URL to validate
            allowed_domains: List of allowed domains
            
        Returns:
            Validated URL
        """
        if not url or not isinstance(url, str):
            raise ValidationError("URL must be a non-empty string")
        
        try:
            parsed = urlparse(url)
            
            # Check scheme
            if parsed.scheme not in ['http', 'https']:
                raise ValidationError("URL must use HTTP or HTTPS")
            
            # Check domain
            if not parsed.netloc:
                raise ValidationError("Invalid URL format")
            
            # Check against allowed domains
            if allowed_domains and parsed.netloc not in allowed_domains:
                raise ValidationError(f"Domain not allowed: {parsed.netloc}")
            
            return url
            
        except Exception as e:
            raise ValidationError(f"Invalid URL: {e}")
    
    @staticmethod
    def validate_ip_address(ip: str) -> str:
        """Validate IP address format."""
        if not ip or not isinstance(ip, str):
            raise ValidationError("IP address must be a non-empty string")
        
        try:
            # This validates both IPv4 and IPv6
            ipaddress.ip_address(ip)
            return ip
        except ValueError:
            raise ValidationError("Invalid IP address")
    
    @staticmethod
    def sanitize_json(data: Union[Dict, List]) -> Union[Dict, List]:
        """
        Recursively sanitize JSON data.
        
        Args:
            data: JSON data to sanitize
            
        Returns:
            Sanitized data
        """
        if isinstance(data, dict):
            return {
                InputValidator._sanitize_string(k): InputValidator.sanitize_json(v)
                for k, v in data.items()
            }
        elif isinstance(data, list):
            return [InputValidator.sanitize_json(item) for item in data]
        elif isinstance(data, str):
            return InputValidator._sanitize_string(data)
        else:
            return data
    
    @staticmethod
    def _sanitize_string(text: str) -> str:
        """Sanitize string for safe output."""
        if not isinstance(text, str):
            return text
        
        # HTML escape
        text = html.escape(text)
        
        # Remove null bytes
        text = text.replace('\x00', '')
        
        # Remove control characters
        text = ''.join(char for char in text if ord(char) >= 32 or char == '\n')
        
        return text
    
    @staticmethod
    def _contains_sql_injection(text: str) -> bool:
        """Check if text contains potential SQL injection."""
        text_lower = text.lower()
        
        # Check for SQL keywords
        for keyword in SQL_BLACKLIST:
            if keyword in text_lower:
                return True
        
        # Check for common SQL injection patterns
        sql_patterns = [
            r"(\b(or|and)\b\s*\d+\s*=\s*\d+)",  # OR 1=1
            r"('|\"|;|--|\*/|/\*|\bxp_|\bsp_)",  # Common injection characters
            r"(\bunion\b.*\bselect\b)",          # UNION SELECT
            r"(\bexec\b|\bexecute\b)",           # EXEC commands
        ]
        
        for pattern in sql_patterns:
            if re.search(pattern, text_lower):
                return True
        
        return False


class SecureRequestValidator:
    """
    Validate entire request objects for security.
    """
    
    @staticmethod
    def validate_prediction_request(
        home_team: str,
        away_team: str,
        include_details: bool = True
    ) -> Dict[str, Any]:
        """
        Validate prediction request parameters.
        
        Returns:
            Validated and sanitized parameters
        """
        try:
            home_team = InputValidator.validate_team_name(home_team, strict=True)
            away_team = InputValidator.validate_team_name(away_team, strict=True)
            
            if home_team == away_team:
                raise ValidationError("Home and away teams must be different")
            
            return {
                "home_team": home_team,
                "away_team": away_team,
                "include_details": bool(include_details)
            }
            
        except ValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    
    @staticmethod
    def validate_natural_language_query(query: str) -> str:
        """
        Validate natural language query for safety.
        
        Args:
            query: User query
            
        Returns:
            Sanitized query
        """
        if not query or not isinstance(query, str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Query must be a non-empty string"
            )
        
        # Check length
        if len(query) > 500:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Query too long (max 500 characters)"
            )
        
        # Check for injection attempts
        if InputValidator._contains_sql_injection(query):
            logger.warning(f"Potential injection in query: {query}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Query contains invalid characters"
            )
        
        # Sanitize
        return InputValidator._sanitize_string(query)
    
    @staticmethod
    def validate_file_upload(
        filename: str,
        content_type: str,
        file_size: int,
        allowed_extensions: List[str] = None,
        max_size: int = 10 * 1024 * 1024  # 10MB default
    ) -> bool:
        """
        Validate file upload for security.
        
        Args:
            filename: Name of uploaded file
            content_type: MIME type
            file_size: Size in bytes
            allowed_extensions: Allowed file extensions
            max_size: Maximum file size in bytes
            
        Returns:
            True if valid
        """
        # Check file size
        if file_size > max_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large (max {max_size / 1024 / 1024}MB)"
            )
        
        # Check filename
        if not filename or '..' in filename or '/' in filename or '\\' in filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid filename"
            )
        
        # Check extension
        if allowed_extensions:
            ext = Path(filename).suffix.lower()
            if ext not in allowed_extensions:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File type not allowed. Allowed: {allowed_extensions}"
                )
        
        # Check MIME type
        safe_mime_types = [
            'application/json',
            'text/csv',
            'application/pdf',
            'image/jpeg',
            'image/png'
        ]
        
        if content_type not in safe_mime_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File type not allowed"
            )
        
        return True


# Pydantic models with built-in validation

class SecurePredictionRequest(BaseModel):
    """Secure prediction request model."""
    home_team: str = Field(..., min_length=2, max_length=50)
    away_team: str = Field(..., min_length=2, max_length=50)
    include_details: bool = Field(default=True)
    
    @validator('home_team', 'away_team')
    def validate_teams(cls, v):
        return InputValidator.validate_team_name(v, strict=True)
    
    @validator('away_team')
    def teams_different(cls, v, values):
        if 'home_team' in values and v == values['home_team']:
            raise ValueError('Home and away teams must be different')
        return v


class SecureNaturalLanguageRequest(BaseModel):
    """Secure natural language request model."""
    query: str = Field(..., min_length=1, max_length=500)
    
    @validator('query')
    def validate_query(cls, v):
        if InputValidator._contains_sql_injection(v):
            raise ValueError('Invalid query')
        return InputValidator._sanitize_string(v)


class SecureUserRegistration(BaseModel):
    """Secure user registration model."""
    username: str = Field(..., min_length=3, max_length=32)
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    
    @validator('username')
    def validate_username(cls, v):
        return InputValidator.validate_username(v)
    
    @validator('email')
    def validate_email(cls, v):
        return InputValidator.validate_email(v)
    
    @validator('password')
    def validate_password(cls, v):
        return InputValidator.validate_password(v)


# Example usage
if __name__ == "__main__":
    # Test validators
    validator = InputValidator()
    
    # Test team name validation
    try:
        team = validator.validate_team_name("Arsenal FC")
        print(f"✅ Valid team: {team}")
        
        # This should fail
        bad_team = validator.validate_team_name("'; DROP TABLE users; --")
    except ValidationError as e:
        print(f"❌ Invalid team: {e}")
    
    # Test email validation
    try:
        email = validator.validate_email("user@example.com")
        print(f"✅ Valid email: {email}")
    except ValidationError as e:
        print(f"❌ Invalid email: {e}")
    
    # Test password validation
    try:
        password = validator.validate_password("SecureP@ssw0rd!")
        print(f"✅ Valid password: [hidden]")
    except ValidationError as e:
        print(f"❌ Invalid password: {e}")
    
    print("\n🛡️ Input validation ready!")
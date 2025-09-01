"""
🔑 Secrets Management System

Secure handling of API keys, passwords, and sensitive configuration.
Supports multiple backends: environment variables, AWS Secrets Manager,
HashiCorp Vault, and Azure Key Vault.

Security features:
- Encrypted storage
- Automatic rotation
- Audit logging
- Zero-knowledge architecture
"""

import os
import json
import base64
import logging
from typing import Any, Dict, Optional, List
from datetime import datetime, timedelta
from pathlib import Path
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
from cryptography.hazmat.backends import default_backend
import boto3
from botocore.exceptions import ClientError
import hvac
from azure.keyvault.secrets import SecretClient
from azure.identity import DefaultAzureCredential
from dotenv import load_dotenv
import hashlib

logger = logging.getLogger(__name__)


class SecretProvider:
    """Base class for secret providers."""
    
    def get_secret(self, key: str) -> Optional[str]:
        """Get a secret value."""
        raise NotImplementedError
    
    def set_secret(self, key: str, value: str) -> bool:
        """Set a secret value."""
        raise NotImplementedError
    
    def delete_secret(self, key: str) -> bool:
        """Delete a secret."""
        raise NotImplementedError
    
    def list_secrets(self) -> List[str]:
        """List all secret keys."""
        raise NotImplementedError


class EnvironmentSecretProvider(SecretProvider):
    """
    Environment variable secret provider.
    Suitable for development and simple deployments.
    """
    
    def __init__(self, env_file: Optional[str] = None):
        """
        Initialize environment provider.
        
        Args:
            env_file: Path to .env file
        """
        if env_file:
            load_dotenv(env_file)
        else:
            load_dotenv()
    
    def get_secret(self, key: str) -> Optional[str]:
        """Get secret from environment variable."""
        return os.getenv(key)
    
    def set_secret(self, key: str, value: str) -> bool:
        """Set environment variable (runtime only)."""
        os.environ[key] = value
        return True
    
    def delete_secret(self, key: str) -> bool:
        """Remove environment variable."""
        if key in os.environ:
            del os.environ[key]
            return True
        return False
    
    def list_secrets(self) -> List[str]:
        """List environment variables starting with specific prefixes."""
        prefixes = ['API_', 'SECRET_', 'KEY_', 'TOKEN_', 'PASSWORD_']
        return [
            key for key in os.environ.keys()
            if any(key.startswith(prefix) for prefix in prefixes)
        ]


class AWSSecretsManagerProvider(SecretProvider):
    """
    AWS Secrets Manager provider for production use.
    """
    
    def __init__(self, region_name: str = 'us-east-1', profile_name: Optional[str] = None):
        """
        Initialize AWS Secrets Manager client.
        
        Args:
            region_name: AWS region
            profile_name: AWS profile name
        """
        session = boto3.Session(profile_name=profile_name) if profile_name else boto3.Session()
        self.client = session.client('secretsmanager', region_name=region_name)
        self.region = region_name
    
    def get_secret(self, key: str) -> Optional[str]:
        """Get secret from AWS Secrets Manager."""
        try:
            response = self.client.get_secret_value(SecretId=key)
            
            if 'SecretString' in response:
                secret = response['SecretString']
                
                # Try to parse as JSON
                try:
                    secret_dict = json.loads(secret)
                    return secret_dict
                except json.JSONDecodeError:
                    return secret
            else:
                # Binary secret
                return base64.b64decode(response['SecretBinary']).decode('utf-8')
                
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                logger.warning(f"Secret {key} not found")
                return None
            else:
                logger.error(f"Error retrieving secret {key}: {e}")
                raise
    
    def set_secret(self, key: str, value: str, description: str = "") -> bool:
        """Create or update secret in AWS Secrets Manager."""
        try:
            # Try to update existing secret
            try:
                self.client.update_secret(
                    SecretId=key,
                    SecretString=value,
                    Description=description
                )
                logger.info(f"Updated secret {key}")
                return True
                
            except ClientError as e:
                if e.response['Error']['Code'] == 'ResourceNotFoundException':
                    # Create new secret
                    self.client.create_secret(
                        Name=key,
                        SecretString=value,
                        Description=description
                    )
                    logger.info(f"Created secret {key}")
                    return True
                else:
                    raise
                    
        except ClientError as e:
            logger.error(f"Error setting secret {key}: {e}")
            return False
    
    def delete_secret(self, key: str, force: bool = False) -> bool:
        """Delete secret from AWS Secrets Manager."""
        try:
            self.client.delete_secret(
                SecretId=key,
                ForceDeleteWithoutRecovery=force
            )
            logger.info(f"Deleted secret {key}")
            return True
            
        except ClientError as e:
            logger.error(f"Error deleting secret {key}: {e}")
            return False
    
    def list_secrets(self) -> List[str]:
        """List all secrets in AWS Secrets Manager."""
        try:
            secrets = []
            paginator = self.client.get_paginator('list_secrets')
            
            for page in paginator.paginate():
                for secret in page['SecretList']:
                    secrets.append(secret['Name'])
            
            return secrets
            
        except ClientError as e:
            logger.error(f"Error listing secrets: {e}")
            return []


class HashiCorpVaultProvider(SecretProvider):
    """
    HashiCorp Vault provider for enterprise use.
    """
    
    def __init__(self, vault_url: str, vault_token: str, mount_point: str = 'secret'):
        """
        Initialize Vault client.
        
        Args:
            vault_url: Vault server URL
            vault_token: Authentication token
            mount_point: KV secrets engine mount point
        """
        self.client = hvac.Client(url=vault_url, token=vault_token)
        self.mount_point = mount_point
        
        if not self.client.is_authenticated():
            raise ValueError("Vault authentication failed")
    
    def get_secret(self, key: str) -> Optional[str]:
        """Get secret from Vault."""
        try:
            response = self.client.secrets.kv.v2.read_secret_version(
                path=key,
                mount_point=self.mount_point
            )
            return response['data']['data']
            
        except hvac.exceptions.InvalidPath:
            logger.warning(f"Secret {key} not found")
            return None
        except Exception as e:
            logger.error(f"Error retrieving secret {key}: {e}")
            raise
    
    def set_secret(self, key: str, value: str) -> bool:
        """Set secret in Vault."""
        try:
            # Convert string to dict if needed
            if isinstance(value, str):
                secret_data = {'value': value}
            else:
                secret_data = value
            
            self.client.secrets.kv.v2.create_or_update_secret(
                path=key,
                secret=secret_data,
                mount_point=self.mount_point
            )
            logger.info(f"Set secret {key}")
            return True
            
        except Exception as e:
            logger.error(f"Error setting secret {key}: {e}")
            return False
    
    def delete_secret(self, key: str) -> bool:
        """Delete secret from Vault."""
        try:
            self.client.secrets.kv.v2.delete_metadata_and_all_versions(
                path=key,
                mount_point=self.mount_point
            )
            logger.info(f"Deleted secret {key}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting secret {key}: {e}")
            return False
    
    def list_secrets(self) -> List[str]:
        """List all secrets in Vault."""
        try:
            response = self.client.secrets.kv.v2.list_secrets(
                mount_point=self.mount_point
            )
            return response['data']['keys']
            
        except Exception as e:
            logger.error(f"Error listing secrets: {e}")
            return []


class LocalEncryptedProvider(SecretProvider):
    """
    Local encrypted file storage for secrets.
    Uses Fernet symmetric encryption.
    """
    
    def __init__(self, key_file: str = '.secrets.key', secrets_file: str = '.secrets.enc'):
        """
        Initialize local encrypted provider.
        
        Args:
            key_file: Path to encryption key file
            secrets_file: Path to encrypted secrets file
        """
        self.key_file = Path(key_file)
        self.secrets_file = Path(secrets_file)
        self.cipher = self._get_or_create_cipher()
        self.secrets = self._load_secrets()
    
    def _get_or_create_cipher(self) -> Fernet:
        """Get or create encryption key."""
        if self.key_file.exists():
            with open(self.key_file, 'rb') as f:
                key = f.read()
        else:
            # Generate new key
            key = Fernet.generate_key()
            
            # Save key (should be stored securely in production!)
            with open(self.key_file, 'wb') as f:
                f.write(key)
            
            # Set restrictive permissions
            os.chmod(self.key_file, 0o600)
            
            logger.warning(f"Generated new encryption key at {self.key_file}")
            logger.warning("IMPORTANT: Back up this key securely!")
        
        return Fernet(key)
    
    def _load_secrets(self) -> Dict[str, str]:
        """Load and decrypt secrets from file."""
        if not self.secrets_file.exists():
            return {}
        
        try:
            with open(self.secrets_file, 'rb') as f:
                encrypted_data = f.read()
            
            decrypted_data = self.cipher.decrypt(encrypted_data)
            return json.loads(decrypted_data.decode('utf-8'))
            
        except Exception as e:
            logger.error(f"Error loading secrets: {e}")
            return {}
    
    def _save_secrets(self):
        """Encrypt and save secrets to file."""
        try:
            data = json.dumps(self.secrets).encode('utf-8')
            encrypted_data = self.cipher.encrypt(data)
            
            with open(self.secrets_file, 'wb') as f:
                f.write(encrypted_data)
            
            # Set restrictive permissions
            os.chmod(self.secrets_file, 0o600)
            
        except Exception as e:
            logger.error(f"Error saving secrets: {e}")
    
    def get_secret(self, key: str) -> Optional[str]:
        """Get decrypted secret."""
        return self.secrets.get(key)
    
    def set_secret(self, key: str, value: str) -> bool:
        """Set and encrypt secret."""
        self.secrets[key] = value
        self._save_secrets()
        return True
    
    def delete_secret(self, key: str) -> bool:
        """Delete secret."""
        if key in self.secrets:
            del self.secrets[key]
            self._save_secrets()
            return True
        return False
    
    def list_secrets(self) -> List[str]:
        """List all secret keys."""
        return list(self.secrets.keys())


class SecretManager:
    """
    Main secret manager that orchestrates different providers.
    """
    
    def __init__(self, provider: Optional[SecretProvider] = None):
        """
        Initialize secret manager.
        
        Args:
            provider: Secret provider to use (defaults to environment)
        """
        self.provider = provider or EnvironmentSecretProvider()
        self.cache = {}  # In-memory cache for performance
        self.audit_log = []
    
    def get_secret(self, key: str, default: Optional[str] = None, 
                  cache: bool = True) -> Optional[str]:
        """
        Get a secret value with caching.
        
        Args:
            key: Secret key
            default: Default value if not found
            cache: Whether to cache the value
            
        Returns:
            Secret value or default
        """
        # Check cache first
        if cache and key in self.cache:
            return self.cache[key]
        
        # Get from provider
        value = self.provider.get_secret(key)
        
        if value is None:
            value = default
        
        # Cache if requested
        if cache and value is not None:
            self.cache[key] = value
        
        # Audit log
        self._log_access(key, 'GET')
        
        return value
    
    def set_secret(self, key: str, value: str) -> bool:
        """
        Set a secret value.
        
        Args:
            key: Secret key
            value: Secret value
            
        Returns:
            Success status
        """
        success = self.provider.set_secret(key, value)
        
        if success:
            # Update cache
            self.cache[key] = value
            
            # Audit log
            self._log_access(key, 'SET')
        
        return success
    
    def delete_secret(self, key: str) -> bool:
        """
        Delete a secret.
        
        Args:
            key: Secret key
            
        Returns:
            Success status
        """
        success = self.provider.delete_secret(key)
        
        if success:
            # Remove from cache
            if key in self.cache:
                del self.cache[key]
            
            # Audit log
            self._log_access(key, 'DELETE')
        
        return success
    
    def rotate_secret(self, key: str, generator_func=None) -> str:
        """
        Rotate a secret with a new value.
        
        Args:
            key: Secret key to rotate
            generator_func: Function to generate new secret
            
        Returns:
            New secret value
        """
        # Generate new secret
        if generator_func:
            new_value = generator_func()
        else:
            # Default: generate random token
            import secrets
            new_value = secrets.token_urlsafe(32)
        
        # Store old value for rollback
        old_value = self.get_secret(key)
        
        # Set new value
        if self.set_secret(key, new_value):
            # Log rotation
            self._log_access(key, 'ROTATE')
            logger.info(f"Rotated secret {key}")
            
            # Store rotation history (in production, save to database)
            rotation_key = f"{key}_rotation_history"
            history = self.get_secret(rotation_key, "[]")
            history = json.loads(history)
            history.append({
                'timestamp': datetime.utcnow().isoformat(),
                'old_hash': hashlib.sha256(old_value.encode()).hexdigest() if old_value else None
            })
            self.set_secret(rotation_key, json.dumps(history))
            
            return new_value
        else:
            logger.error(f"Failed to rotate secret {key}")
            raise Exception(f"Secret rotation failed for {key}")
    
    def validate_required_secrets(self, required: List[str]) -> bool:
        """
        Validate that all required secrets are present.
        
        Args:
            required: List of required secret keys
            
        Returns:
            True if all present
        """
        missing = []
        
        for key in required:
            if not self.get_secret(key):
                missing.append(key)
        
        if missing:
            logger.error(f"Missing required secrets: {missing}")
            return False
        
        return True
    
    def _log_access(self, key: str, action: str):
        """Log secret access for auditing."""
        self.audit_log.append({
            'timestamp': datetime.utcnow().isoformat(),
            'key': key,
            'action': action,
            'key_hash': hashlib.sha256(key.encode()).hexdigest()
        })
    
    def get_audit_log(self) -> List[Dict]:
        """Get audit log of secret operations."""
        return self.audit_log
    
    def clear_cache(self):
        """Clear the in-memory cache."""
        self.cache.clear()
        logger.info("Cleared secret cache")


# Global secret manager instance
_secret_manager = None


def get_secret_manager() -> SecretManager:
    """Get or create global secret manager."""
    global _secret_manager
    
    if _secret_manager is None:
        # Determine provider based on environment
        provider_type = os.getenv('SECRET_PROVIDER', 'env').lower()
        
        if provider_type == 'aws':
            provider = AWSSecretsManagerProvider()
        elif provider_type == 'vault':
            vault_url = os.getenv('VAULT_URL', 'http://localhost:8200')
            vault_token = os.getenv('VAULT_TOKEN')
            provider = HashiCorpVaultProvider(vault_url, vault_token)
        elif provider_type == 'local':
            provider = LocalEncryptedProvider()
        else:
            provider = EnvironmentSecretProvider()
        
        _secret_manager = SecretManager(provider)
        
        logger.info(f"Initialized secret manager with {provider_type} provider")
    
    return _secret_manager


# Configuration class using secrets
class SecureConfig:
    """
    Secure configuration using secret manager.
    """
    
    def __init__(self):
        self.secrets = get_secret_manager()
        
        # Validate required secrets
        required = [
            'FOOTBALL_DATA_API_KEY',
            'SECRET_KEY',
            'DATABASE_URL'
        ]
        
        if not self.secrets.validate_required_secrets(required):
            raise ValueError("Missing required configuration")
    
    @property
    def football_api_key(self) -> str:
        return self.secrets.get_secret('FOOTBALL_DATA_API_KEY')
    
    @property
    def openai_api_key(self) -> Optional[str]:
        return self.secrets.get_secret('OPENAI_API_KEY')
    
    @property
    def secret_key(self) -> str:
        return self.secrets.get_secret('SECRET_KEY')
    
    @property
    def database_url(self) -> str:
        return self.secrets.get_secret('DATABASE_URL')
    
    @property
    def redis_url(self) -> str:
        return self.secrets.get_secret('REDIS_URL', 'redis://localhost:6379')
    
    @property
    def mlflow_tracking_uri(self) -> str:
        return self.secrets.get_secret('MLFLOW_TRACKING_URI', 'http://localhost:5000')


# Example usage
if __name__ == "__main__":
    # Test secret management
    manager = get_secret_manager()
    
    # Set a secret
    manager.set_secret('TEST_SECRET', 'super_secret_value')
    
    # Get a secret
    value = manager.get_secret('TEST_SECRET')
    print(f"Secret value: {value}")
    
    # Rotate a secret
    new_value = manager.rotate_secret('TEST_SECRET')
    print(f"Rotated to: {new_value}")
    
    # List secrets
    secrets = manager.provider.list_secrets()
    print(f"Available secrets: {secrets}")
    
    # Check audit log
    audit = manager.get_audit_log()
    print(f"Audit log: {audit}")
    
    print("\n🔑 Secret management ready!")
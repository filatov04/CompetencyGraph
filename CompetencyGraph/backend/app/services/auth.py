from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import jwt
import bcrypt
import redis.asyncio as redis

from dependencies.config import Config


class TokenService:
    def __init__(self, redis_client: redis.Redis, config: Config):
        self._redis = redis_client
        self._config = config

    def hash_password(self, password: str) -> str:
        """Хеширование пароля"""
        # Генерируем соль и хешируем пароль
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Проверка пароля"""
        try:
            return bcrypt.checkpw(
                plain_password.encode('utf-8'),
                hashed_password.encode('utf-8')
            )
        except Exception:
            return False

    def create_access_token(self, user_id: int, email: str) -> str:
        """Создание access token"""
        expires_delta = timedelta(seconds=self._config.auth.access_token_expire)
        expires_at = datetime.utcnow() + expires_delta

        payload = {
            "sub": str(user_id),
            "email": email,
            "exp": expires_at,
            "type": "access"
        }
        return jwt.encode(
            payload,
            self._config.auth.secret_key,
            algorithm=self._config.auth.algorithm
        )

    async def create_refresh_token(self, user_id: int, email: str) -> str:
        """Создание refresh token"""
        expires_delta = timedelta(seconds=self._config.auth.refresh_token_expire)
        expires_at = datetime.utcnow() + expires_delta

        payload = {
            "sub": str(user_id),
            "email": email,
            "exp": expires_at,
            "type": "refresh"
        }
        token = jwt.encode(
            payload,
            self._config.auth.secret_key,
            algorithm=self._config.auth.algorithm
        )

        # Сохраняем в Redis
        await self._redis.set(
            f"refresh_token:{user_id}",
            token,
            ex=int(expires_delta.total_seconds())
        )
        return token

    async def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Проверка токена"""
        try:
            payload = jwt.decode(
                token,
                self._config.auth.secret_key,
                algorithms=[self._config.auth.algorithm]
            )

            # Для refresh токена проверяем наличие в Redis
            if payload.get("type") == "refresh":
                user_id = payload.get("sub")
                stored_token = await self._redis.get(f"refresh_token:{user_id}")
                if not stored_token or stored_token != token:
                    return None

            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None

    async def revoke_refresh_token(self, user_id: int) -> None:
        """Отзыв refresh token"""
        await self._redis.delete(f"refresh_token:{user_id}")

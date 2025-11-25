from typing import Optional
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import redis.asyncio as redis

from services.auth import TokenService
from dependencies.config import Config


class AuthMiddleware(BaseHTTPMiddleware):
    """Middleware для аутентификации пользователей"""

    def __init__(self, app, container):
        super().__init__(app)
        self.container = container
        self._config: Optional[Config] = None
        self._redis_client: Optional[redis.Redis] = None
        self._token_service: Optional[TokenService] = None

    async def _init_dependencies(self):
        """Ленивая инициализация зависимостей"""
        if self._token_service is None:
            self._config = self.container.config()
            # Создаем Redis клиент напрямую
            self._redis_client = redis.from_url(
                self._config.redis.url,
                password=self._config.redis.password,
                encoding='utf-8',
                decode_responses=True
            )
            self._token_service = TokenService(self._redis_client, self._config)

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        if self._should_skip_auth(request.url.path):
            return await call_next(request)

        try:
            token = self._extract_token(request)
            if not token:
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Missing authentication token"}
                )

            await self._init_dependencies()

            payload = await self._token_service.verify_token(token)
            if not payload or payload.get("type") != "access":
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Invalid or expired token"}
                )

            request.state.user_id = int(payload.get("sub"))
            request.state.user_email = payload.get("email")

            response = await call_next(request)
            return response

        except Exception as e:
            return JSONResponse(
                status_code=500,
                content={"detail": str(e)}
            )

    def _should_skip_auth(self, path: str) -> bool:
        skip_paths = [
            "/docs",
            "/redoc",
            "/openapi.json",
            "/health",
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/refresh"
        ]
        return any(path.startswith(skip_path) for skip_path in skip_paths)

    def _extract_token(self, request: Request) -> Optional[str]:
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return None

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return None

        return parts[1]

import enum
import logging
import os
from functools import cached_property
from typing import Optional
from pydantic import BaseModel

__all__ = ("Config",)

logger = logging.getLogger(__name__)


class EnvironmentEnum(enum.Enum):
    PRODUCTION = "PRODUCTION"
    DEVELOPMENT = "DEVELOPMENT"

class DatabaseConfig(BaseModel):
    dsn: str
    connections_amount: int


class GraphDBConfig(BaseModel):
    url: str
    repository: str
    username: Optional[str]
    password: Optional[str]


class HealthCheckConfig(BaseModel):
    interval: int = 30  # секунды
    timeout: int = 3 # секунды
    retries: int = 3


class RedisConfig(BaseModel):
    url: str
    password: Optional[str] = None


class AuthConfig(BaseModel):
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire: int = 900  # 15 минут
    refresh_token_expire: int = 604800  # 7 дней


class Config:
    @cached_property
    def environment(self) -> EnvironmentEnum:
        is_dev = bool(os.getenv("DEV_VERSION", False))
        return EnvironmentEnum.DEVELOPMENT if is_dev else EnvironmentEnum.PRODUCTION

    @cached_property
    def graphdb(self) -> GraphDBConfig:
        return GraphDBConfig(
            url=os.getenv("GRAPHDB_URL", "http://localhost:7200"),
            repository=os.getenv("GRAPHDB_REPOSITORY", "competencies"),
            username=os.getenv("GRAPHDB_USERNAME"),
            password=os.getenv("GRAPHDB_PASSWORD"),
        )

    @cached_property
    def healthcheck(self) -> HealthCheckConfig:
        return HealthCheckConfig(
            interval=int(os.getenv("HEALTHCHECK_INTERVAL", 30)),
            timeout=int(os.getenv("HEALTHCHECK_TIMEOUT", 3)),
            retries=int(os.getenv("HEALTHCHECK_RETRIES", 3))
        )

    @cached_property
    def database(self) -> DatabaseConfig:
        return DatabaseConfig(
            dsn=os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/competency_graph"),
            connections_amount=int(os.getenv("DATABASE_CONNECTIONS_AMOUNT", 2))
        )

    @cached_property
    def redis(self) -> RedisConfig:
        return RedisConfig(
            url=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
            password=os.getenv("REDIS_PASSWORD")
        )

    @cached_property
    def auth(self) -> AuthConfig:
        return AuthConfig(
            secret_key=os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-in-production"),
            algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
            access_token_expire=int(os.getenv("ACCESS_TOKEN_EXPIRE", 900)),
            refresh_token_expire=int(os.getenv("REFRESH_TOKEN_EXPIRE", 604800))
        )

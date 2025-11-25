from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from dependency_injector import wiring
import asyncpg
import logging

from services.auth import TokenService
from dependencies.config import Config
import redis.asyncio as redis


router = APIRouter()
logger = logging.getLogger(__name__)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    first_name: str
    last_name: str


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/auth/register", response_model=TokenResponse)
@wiring.inject
async def register(
    data: RegisterRequest,
    db_pool: asyncpg.Pool = Depends(wiring.Provide["db_pool"]),
    redis_client: redis.Redis = Depends(wiring.Provide["redis_client"]),
    config: Config = Depends(wiring.Provide["config"])
):
    """Регистрация нового пользователя"""
    token_service = TokenService(redis_client, config)

    # Проверяем, что пользователь не существует
    existing = await db_pool.fetchrow(
        'SELECT id FROM "user" WHERE email = $1',
        data.email
    )
    if existing:
        logger.warning(f"Registration attempt for existing user: {data.email}")
        raise HTTPException(status_code=400, detail="User already exists")

    # Хешируем пароль
    hashed_password = token_service.hash_password(data.password)

    # Создаем пользователя
    user = await db_pool.fetchrow(
        'INSERT INTO "user" (email, first_name, last_name, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name',
        data.email,
        data.first_name,
        data.last_name,
        hashed_password
    )

    logger.info(f"User registered: {user['email']} (ID: {user['id']})")

    # Генерируем токены
    access_token = token_service.create_access_token(user["id"], user["email"])
    refresh_token = await token_service.create_refresh_token(user["id"], user["email"])

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        first_name=user["first_name"],
        last_name=user["last_name"]
    )


@router.post("/auth/login", response_model=TokenResponse)
@wiring.inject
async def login(
    data: LoginRequest,
    db_pool: asyncpg.Pool = Depends(wiring.Provide["db_pool"]),
    redis_client: redis.Redis = Depends(wiring.Provide["redis_client"]),
    config: Config = Depends(wiring.Provide["config"])
):
    """Вход пользователя"""
    token_service = TokenService(redis_client, config)

    # Ищем пользователя
    user = await db_pool.fetchrow(
        'SELECT id, email, password_hash, first_name, last_name FROM "user" WHERE email = $1',
        data.email
    )
    if not user:
        logger.warning(f"Login attempt for non-existent user: {data.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Проверяем пароль
    if not token_service.verify_password(data.password, user["password_hash"]):
        logger.warning(f"Failed login attempt for user: {data.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    logger.info(f"User logged in: {user['email']}")

    # Генерируем токены
    access_token = token_service.create_access_token(user["id"], user["email"])
    refresh_token = await token_service.create_refresh_token(user["id"], user["email"])

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        first_name=user["first_name"],
        last_name=user["last_name"]
    )


@router.post("/auth/refresh", response_model=TokenResponse)
@wiring.inject
async def refresh(
    data: RefreshRequest,
    db_pool: asyncpg.Pool = Depends(wiring.Provide["db_pool"]),
    redis_client: redis.Redis = Depends(wiring.Provide["redis_client"]),
    config: Config = Depends(wiring.Provide["config"])
):
    """Обновление токенов"""
    token_service = TokenService(redis_client, config)

    # Проверяем refresh token
    payload = await token_service.verify_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        logger.warning("Invalid refresh token attempt")
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = int(payload.get("sub"))
    email = payload.get("email")

    # Получаем данные пользователя из базы
    user = await db_pool.fetchrow(
        'SELECT first_name, last_name FROM "user" WHERE id = $1',
        user_id
    )
    if not user:
        logger.warning(f"Refresh token for non-existent user ID: {user_id}")
        raise HTTPException(status_code=401, detail="User not found")

    logger.info(f"Token refreshed for user: {email}")

    # Генерируем новые токены
    access_token = token_service.create_access_token(user_id, email)
    refresh_token = await token_service.create_refresh_token(user_id, email)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        first_name=user["first_name"],
        last_name=user["last_name"]
    )


@router.post("/auth/logout")
@wiring.inject
async def logout(
    data: RefreshRequest,
    redis_client: redis.Redis = Depends(wiring.Provide["redis_client"]),
    config: Config = Depends(wiring.Provide["config"])
):
    """Выход из системы (отзыв refresh token)"""
    token_service = TokenService(redis_client, config)

    payload = await token_service.verify_token(data.refresh_token)
    if payload:
        user_id = int(payload.get("sub"))
        email = payload.get("email")
        await token_service.revoke_refresh_token(user_id)
        logger.info(f"User logged out: {email}")

    return {"message": "Logged out successfully"}

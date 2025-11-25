from typing import AsyncGenerator
import redis.asyncio as redis
from dependencies.config import Config


async def create_redis_client(config: Config) -> AsyncGenerator[redis.Redis, None]:
    """Создание клиента Redis"""
    client = redis.from_url(
        config.redis.url,
        password=config.redis.password,
        encoding='utf-8',
        decode_responses=True
    )

    try:
        yield client
    finally:
        await client.aclose()

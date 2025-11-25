import asyncpg
import logging
from typing import Optional, Dict, Any, List
from dependency_injector import wiring
from fastapi import Depends

logger = logging.getLogger(__name__)


class UserDAO:
    """DAO для работы с пользователями"""

    @classmethod
    @wiring.inject
    async def get_user_by_id(
        cls,
        user_id: int,
        db_pool: asyncpg.Pool = Depends(wiring.Provide["db_pool"]),
    ) -> Optional[Dict[str, Any]]:
        """Получить пользователя по ID"""
        try:
            row = await db_pool.fetchrow(
                """
                SELECT id, first_name, last_name, email, created_at
                FROM "user"
                WHERE id = $1
                """,
                user_id
            )
            if row:
                return {
                    "id": row["id"],
                    "first_name": row["first_name"],
                    "last_name": row["last_name"],
                    "email": row["email"],
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None
                }
            return None
        except Exception as e:
            logger.error(f"Error getting user by id {user_id}: {e}")
            raise

    @classmethod
    @wiring.inject
    async def get_user_by_email(
        cls,
        email: str,
        db_pool: asyncpg.Pool = Depends(wiring.Provide["db_pool"]),
    ) -> Optional[Dict[str, Any]]:
        """Получить пользователя по email"""
        try:
            row = await db_pool.fetchrow(
                """
                SELECT id, first_name, last_name, email, created_at
                FROM "user"
                WHERE email = $1
                """,
                email
            )
            if row:
                return {
                    "id": row["id"],
                    "first_name": row["first_name"],
                    "last_name": row["last_name"],
                    "email": row["email"],
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None
                }
            return None
        except Exception as e:
            logger.error(f"Error getting user by email {email}: {e}")
            raise

    @classmethod
    @wiring.inject
    async def get_users_by_ids(
        cls,
        user_ids: List[int],
        db_pool: asyncpg.Pool = Depends(wiring.Provide["db_pool"]),
    ) -> List[Dict[str, Any]]:
        """Получить нескольких пользователей по списку ID"""
        if not user_ids:
            return []

        try:
            rows = await db_pool.fetch(
                """
                SELECT id, first_name, last_name, email, created_at
                FROM "user"
                WHERE id = ANY($1::int[])
                """,
                user_ids
            )
            return [
                {
                    "id": row["id"],
                    "first_name": row["first_name"],
                    "last_name": row["last_name"],
                    "email": row["email"],
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None
                }
                for row in rows
            ]
        except Exception as e:
            logger.error(f"Error getting users by ids: {e}")
            raise

    @classmethod
    @wiring.inject
    async def get_user_full_name(
        cls,
        user_id: int,
        db_pool: asyncpg.Pool = Depends(wiring.Provide["db_pool"]),
    ) -> Optional[str]:
        """Получить полное имя пользователя"""
        try:
            row = await db_pool.fetchrow(
                """
                SELECT first_name, last_name
                FROM "user"
                WHERE id = $1
                """,
                user_id
            )
            if row:
                return f"{row['first_name']} {row['last_name']}"
            return None
        except Exception as e:
            logger.error(f"Error getting user full name for id {user_id}: {e}")
            raise

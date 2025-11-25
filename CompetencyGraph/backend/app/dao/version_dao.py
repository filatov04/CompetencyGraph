import asyncpg
import logging
import json
from typing import Optional, Dict, Any
from dependency_injector import wiring
from fastapi import Depends

logger = logging.getLogger(__name__)


class VersionDAO:
    """DAO для работы с версионированием узлов графа"""

    @classmethod
    @wiring.inject
    async def get_node_version(
        cls,
        node_uri: str,
        db_pool: asyncpg.Pool = Depends(wiring.Provide["db_pool"]),
    ) -> Optional[Dict[str, Any]]:
        """Получить текущую версию узла с информацией об авторе последнего изменения"""
        try:
            row = await db_pool.fetchrow(
                """
                SELECT
                    nv.node_uri,
                    nv.version,
                    nv.last_modified,
                    nv.last_modified_by,
                    u.first_name,
                    u.last_name,
                    u.email
                FROM node_version nv
                LEFT JOIN "user" u ON nv.last_modified_by = u.id
                WHERE nv.node_uri = $1
                """,
                node_uri
            )
            if row:
                result = {
                    "node_uri": row["node_uri"],
                    "version": row["version"],
                    "last_modified": row["last_modified"].isoformat() if row["last_modified"] else None
                }

                # Добавляем информацию об авторе, если она есть
                if row["last_modified_by"]:
                    result["last_modified_by"] = {
                        "id": row["last_modified_by"],
                        "first_name": row["first_name"],
                        "last_name": row["last_name"],
                        "email": row["email"],
                        "full_name": f"{row['first_name']} {row['last_name']}"
                    }
                else:
                    result["last_modified_by"] = None

                return result
            return None
        except Exception as e:
            logger.error(f"Error getting node version: {e}")
            raise

    @classmethod
    @wiring.inject
    async def create_or_update_version(
        cls,
        node_uri: str,
        user_id: int,
        change_type: str,  # CREATE, UPDATE, DELETE
        old_value: Optional[Dict] = None,  # Игнорируем
        new_value: Optional[Dict] = None,  # Игнорируем
        db_pool: asyncpg.Pool = Depends(wiring.Provide["db_pool"]),
    ) -> int:
        """
        Создать или обновить версию узла и записать в историю
        Возвращает новую версию
        """
        try:
            logger.info(f"Updating version for {node_uri} by user {user_id}")

            async with db_pool.acquire() as conn:
                async with conn.transaction():
                    # Проверяем существование пользователя
                    user_exists = await conn.fetchval(
                        'SELECT EXISTS(SELECT 1 FROM "user" WHERE id = $1)',
                        user_id
                    )

                    if not user_exists:
                        error_msg = f"User {user_id} not found in database. Cannot create version."
                        logger.error(error_msg)
                        raise ValueError(error_msg)

                    # Обновляем версию узла с ссылкой на пользователя
                    row = await conn.fetchrow(
                        """
                        INSERT INTO node_version (node_uri, version, last_modified, last_modified_by)
                        VALUES ($1, 1, CURRENT_TIMESTAMP, $2)
                        ON CONFLICT (node_uri)
                        DO UPDATE SET
                            version = node_version.version + 1,
                            last_modified = CURRENT_TIMESTAMP,
                            last_modified_by = $2
                        RETURNING version
                        """,
                        node_uri,
                        user_id
                    )

                    new_version = row["version"]

                    # Записываем в историю
                    await conn.execute(
                        """
                        INSERT INTO node_change_history
                        (node_uri, user_id, change_type, version, changed_at)
                        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                        """,
                        node_uri,
                        user_id,
                        change_type,
                        new_version
                    )

                    logger.info(f"Successfully updated version for {node_uri}: v{new_version}")
                    return new_version

        except Exception as e:
            logger.error(f"Error updating node version: {e}")
            raise

    @classmethod
    @wiring.inject
    async def get_node_history(
        cls,
        node_uri: str,
        limit: int = 10,
        db_pool: asyncpg.Pool = Depends(wiring.Provide["db_pool"]),
    ) -> list[Dict[str, Any]]:
        """Получить историю изменений узла с информацией об авторах"""
        try:
            rows = await db_pool.fetch(
                """
                SELECT
                    nch.id,
                    nch.node_uri,
                    nch.user_id,
                    nch.change_type,
                    nch.version,
                    nch.changed_at,
                    u.first_name,
                    u.last_name,
                    u.email
                FROM node_change_history nch
                LEFT JOIN "user" u ON nch.user_id = u.id
                WHERE nch.node_uri = $1
                ORDER BY nch.changed_at DESC
                LIMIT $2
                """,
                node_uri,
                limit
            )
            return [
                {
                    "id": row["id"],
                    "node_uri": row["node_uri"],
                    "user_id": row["user_id"],
                    "change_type": row["change_type"],
                    "version": row["version"],
                    "changed_at": row["changed_at"].isoformat(),
                    "user": {
                        "id": row["user_id"],
                        "first_name": row["first_name"],
                        "last_name": row["last_name"],
                        "email": row["email"],
                        "full_name": f"{row['first_name']} {row['last_name']}" if row["first_name"] else None
                    } if row["user_id"] else None
                }
                for row in rows
            ]
        except Exception as e:
            logger.error(f"Error getting node history: {e}")
            raise

    @classmethod
    @wiring.inject
    async def check_version_conflict(
        cls,
        node_uri: str,
        expected_version: int,
        db_pool: asyncpg.Pool = Depends(wiring.Provide["db_pool"]),
    ) -> bool:
        """
        Проверить конфликт версий
        Возвращает True, если версия совпадает (нет конфликта)
        """
        try:
            row = await db_pool.fetchrow(
                """
                SELECT version
                FROM node_version
                WHERE node_uri = $1
                """,
                node_uri
            )
            if row is None:
                # Узла нет в БД - нет конфликта
                return True

            current_version = row["version"]
            return current_version == expected_version

        except Exception as e:
            logger.error(f"Error checking version conflict: {e}")
            raise

    @classmethod
    @wiring.inject
    async def get_nodes_versions(
        cls,
        node_uris: list[str],
        db_pool: asyncpg.Pool = Depends(wiring.Provide["db_pool"]),
    ) -> list[Dict[str, Any]]:
        """
        Получить версии нескольких узлов одновременно (batch operation)
        Полезно для фронтенда при загрузке графа
        """
        if not node_uris:
            return []

        try:
            rows = await db_pool.fetch(
                """
                SELECT
                    nv.node_uri,
                    nv.version,
                    nv.last_modified,
                    nv.last_modified_by,
                    u.first_name,
                    u.last_name,
                    u.email
                FROM node_version nv
                LEFT JOIN "user" u ON nv.last_modified_by = u.id
                WHERE nv.node_uri = ANY($1::text[])
                """,
                node_uris
            )

            results = []
            for row in rows:
                result = {
                    "node_uri": row["node_uri"],
                    "version": row["version"],
                    "last_modified": row["last_modified"].isoformat() if row["last_modified"] else None
                }

                # Добавляем информацию об авторе, если она есть
                if row["last_modified_by"]:
                    result["last_modified_by"] = {
                        "id": row["last_modified_by"],
                        "first_name": row["first_name"],
                        "last_name": row["last_name"],
                        "email": row["email"],
                        "full_name": f"{row['first_name']} {row['last_name']}"
                    }
                else:
                    result["last_modified_by"] = None

                results.append(result)

            return results
        except Exception as e:
            logger.error(f"Error getting nodes versions: {e}")
            raise

    @classmethod
    @wiring.inject
    async def get_version_statistics(
        cls,
        db_pool: asyncpg.Pool = Depends(wiring.Provide["db_pool"]),
    ) -> Dict[str, Any]:
        """
        Получить статистику по версионированию:
        - Общее количество версионированных узлов
        - Общее количество изменений
        - Топ активных пользователей
        - Последние изменения
        """
        try:
            # Общая статистика
            stats = await db_pool.fetchrow("""
                SELECT
                    COUNT(DISTINCT node_uri) as total_nodes,
                    SUM(version) as total_versions
                FROM node_version
            """)

            # Количество изменений
            changes_count = await db_pool.fetchval("""
                SELECT COUNT(*) FROM node_change_history
            """)

            # Топ активных пользователей (по количеству изменений)
            top_users = await db_pool.fetch("""
                SELECT
                    u.id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    COUNT(*) as changes_count
                FROM node_change_history nch
                JOIN "user" u ON nch.user_id = u.id
                GROUP BY u.id, u.first_name, u.last_name, u.email
                ORDER BY changes_count DESC
                LIMIT 10
            """)

            # Последние изменения
            recent_changes = await db_pool.fetch("""
                SELECT
                    nch.node_uri,
                    nch.change_type,
                    nch.changed_at,
                    u.first_name,
                    u.last_name,
                    u.email
                FROM node_change_history nch
                LEFT JOIN "user" u ON nch.user_id = u.id
                ORDER BY nch.changed_at DESC
                LIMIT 10
            """)

            return {
                "total_nodes": stats["total_nodes"] or 0,
                "total_versions": stats["total_versions"] or 0,
                "total_changes": changes_count or 0,
                "top_users": [
                    {
                        "id": row["id"],
                        "full_name": f"{row['first_name']} {row['last_name']}",
                        "email": row["email"],
                        "changes_count": row["changes_count"]
                    }
                    for row in top_users
                ],
                "recent_changes": [
                    {
                        "node_uri": row["node_uri"],
                        "change_type": row["change_type"],
                        "changed_at": row["changed_at"].isoformat(),
                        "user": f"{row['first_name']} {row['last_name']}" if row["first_name"] else "Unknown"
                    }
                    for row in recent_changes
                ]
            }
        except Exception as e:
            logger.error(f"Error getting version statistics: {e}")
            raise

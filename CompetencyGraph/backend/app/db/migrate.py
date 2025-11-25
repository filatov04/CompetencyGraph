#!/usr/bin/env python3
"""
Скрипт для применения миграций базы данных
Использование: python -m app.db.migrate
"""
import asyncio
import asyncpg
import os
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def get_db_connection() -> asyncpg.Connection:
    """Создать подключение к базе данных из переменных окружения"""
    db_host = os.getenv("POSTGRES_HOST", "localhost")
    db_port = int(os.getenv("POSTGRES_PORT", "5432"))
    db_name = os.getenv("POSTGRES_DB", "competency_graph")
    db_user = os.getenv("POSTGRES_USER", "postgres")
    db_password = os.getenv("POSTGRES_PASSWORD", "postgres")

    logger.info(f"Connecting to database at {db_host}:{db_port}/{db_name}")

    conn = await asyncpg.connect(
        host=db_host,
        port=db_port,
        database=db_name,
        user=db_user,
        password=db_password
    )

    return conn


async def create_migrations_table(conn: asyncpg.Connection):
    """Создать таблицу для отслеживания примененных миграций"""
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            migration_name VARCHAR(255) UNIQUE NOT NULL,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """)
    logger.info("Migrations table ready")


async def get_applied_migrations(conn: asyncpg.Connection) -> set:
    """Получить список примененных миграций"""
    rows = await conn.fetch("SELECT migration_name FROM schema_migrations")
    return {row["migration_name"] for row in rows}


async def apply_migration(conn: asyncpg.Connection, migration_file: Path):
    """Применить одну миграцию"""
    migration_name = migration_file.name

    logger.info(f"Applying migration: {migration_name}")

    # Читаем SQL из файла
    sql = migration_file.read_text(encoding="utf-8")

    try:
        # Выполняем миграцию в транзакции
        async with conn.transaction():
            await conn.execute(sql)

            # Записываем информацию о применении миграции
            await conn.execute(
                "INSERT INTO schema_migrations (migration_name) VALUES ($1)",
                migration_name
            )

        logger.info(f"✓ Migration {migration_name} applied successfully")
        return True
    except Exception as e:
        logger.error(f"✗ Failed to apply migration {migration_name}: {e}")
        raise


async def run_migrations():
    """Запустить все неприменённые миграции"""
    # Получаем путь к директории с миграциями
    migrations_dir = Path(__file__).parent / "migrations"

    if not migrations_dir.exists():
        logger.error(f"Migrations directory not found: {migrations_dir}")
        return

    # Получаем список файлов миграций (отсортированный)
    migration_files = sorted(migrations_dir.glob("*.sql"))

    if not migration_files:
        logger.info("No migration files found")
        return

    # Подключаемся к БД
    conn = await get_db_connection()

    try:
        # Создаём таблицу для отслеживания миграций
        await create_migrations_table(conn)

        # Получаем список уже применённых миграций
        applied = await get_applied_migrations(conn)
        logger.info(f"Applied migrations: {len(applied)}")

        # Применяем новые миграции
        new_migrations = 0
        for migration_file in migration_files:
            if migration_file.name not in applied:
                await apply_migration(conn, migration_file)
                new_migrations += 1

        if new_migrations == 0:
            logger.info("✓ All migrations are up to date")
        else:
            logger.info(f"✓ Applied {new_migrations} new migration(s)")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(run_migrations())

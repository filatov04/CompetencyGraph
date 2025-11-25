from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
import uvicorn
import logging

from api.v1 import router as api_router
from dependencies import Container
from middlewares.auth import AuthMiddleware

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def custom_openapi(app: FastAPI):
    """Кастомная схема OpenAPI с JWT авторизацией"""
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title="Competency Graph API",
        version="1.0.0",
        description="API для работы с графом компетенций",
        routes=app.routes,
    )

    # Добавляем схему безопасности
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Введите JWT access токен (без префикса 'Bearer')"
        }
    }

    # Применяем схему безопасности ко всем эндпоинтам, кроме публичных
    public_paths = ["/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/refresh"]

    for path, path_item in openapi_schema.get("paths", {}).items():
        # Пропускаем публичные эндпоинты
        if path in public_paths:
            continue

        # Применяем авторизацию ко всем методам в этом пути
        for method in path_item.values():
            if isinstance(method, dict) and "security" not in method:
                method["security"] = [{"BearerAuth": []}]

    app.openapi_schema = openapi_schema
    return app.openapi_schema


def create_app() -> FastAPI:
    container = Container()
    container.wire(packages=["api.v1", "dao"])

    app = FastAPI(
        title="Competency Graph API",
        description="API для работы с графом компетенций",
        version="1.0.0",
        swagger_ui_parameters={
            "persistAuthorization": True,  # Сохранять токен между обновлениями
        }
    )

    # Устанавливаем кастомную OpenAPI схему
    app.openapi = lambda: custom_openapi(app)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Добавляем middleware авторизации
    # Передаем контейнер для получения зависимостей внутри middleware
    app.add_middleware(AuthMiddleware, container=container)

    # Сохраняем контейнер в state приложения для доступа из middleware
    app.state.container = container

    app.include_router(
        api_router,
        prefix="/api/v1"
    )

    return app


app = create_app()


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=80)

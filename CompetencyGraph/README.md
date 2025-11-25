# CompetencyGraph

Единый контейнер для приложения CompetencyGraph, содержащий Frontend (React + Vite) и Backend (FastAPI + Python).

## Архитектура

Проект использует Docker Compose для оркестрации следующих сервисов:
- **CompetencyGraph** - основной контейнер с frontend (Nginx) и backend (FastAPI)
- **CompetencyGraph-GraphDB** - база данных GraphDB для хранения графов компетенций
- **CompetencyGraph-PostgreSQL** - реляционная база данных PostgreSQL
- **CompetencyGraph-Redis** - кэш и хранилище сессий Redis
- **CompetencyGraph-GraphDB-Init** - служебный контейнер для инициализации GraphDB

## Быстрый старт

### Сборка и запуск

```bash
# Сборка образов
docker-compose build

# Запуск всех контейнеров
docker-compose up -d

# Проверка статуса
docker-compose ps

# Просмотр логов
docker logs CompetencyGraph
```

### Остановка

```bash
# Остановка всех контейнеров
docker-compose down

# Остановка и удаление всех данных (volumes)
docker-compose down -v
```

## Доступ к сервисам

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:80/api/v1
- **API Documentation**: http://localhost:80/docs
- **GraphDB**: http://localhost:7200
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Структура проекта

```
.
├── frontend/          # React + TypeScript приложение
├── backend/          # FastAPI + Python приложение
├── Dockerfile        # Multi-stage Dockerfile для сборки всего проекта
├── docker-compose.yml # Оркестрация всех сервисов
├── nginx.conf        # Конфигурация Nginx (раздача статики + проксирование API)
└── entrypoint.sh     # Скрипт запуска Nginx и Backend
```

## Технологии

### Frontend
- React 19
- TypeScript
- Vite
- D3.js для визуализации графов
- Axios для HTTP запросов

### Backend
- FastAPI
- Python 3.13
- AsyncPG для работы с PostgreSQL
- SPARQLWrapper для работы с GraphDB
- JWT авторизация
- Redis для кэширования

### Инфраструктура
- Docker & Docker Compose
- Nginx (веб-сервер + reverse proxy)
- GraphDB 10.6.1
- PostgreSQL 16
- Redis 7

## Разработка

### Переменные окружения

Основные переменные окружения настроены в `docker-compose.yml`:
- `GRAPHDB_URL` - URL для подключения к GraphDB
- `DATABASE_URL` - URL для подключения к PostgreSQL
- `REDIS_URL` - URL для подключения к Redis
- `JWT_SECRET_KEY` - секретный ключ для JWT токенов
- `JWT_ALGORITHM` - алгоритм шифрования JWT
- `ACCESS_TOKEN_EXPIRE` - время жизни access токена (секунды)
- `REFRESH_TOKEN_EXPIRE` - время жизни refresh токена (секунды)

### Логи

```bash
# Логи основного контейнера
docker logs CompetencyGraph

# Логи с отслеживанием в реальном времени
docker logs -f CompetencyGraph

# Логи всех сервисов
docker-compose logs

# Логи конкретного сервиса
docker-compose logs graphdb
docker-compose logs postgres
docker-compose logs redis
```

## Troubleshooting

### Контейнер не запускается

```bash
# Проверьте логи
docker logs CompetencyGraph

# Проверьте статус зависимых сервисов
docker-compose ps
```

### Проблемы с портами

Убедитесь, что порты 80, 5173, 5432, 6379 и 7200 не заняты другими приложениями:

```bash
lsof -i :80
lsof -i :5173
lsof -i :5432
lsof -i :6379
lsof -i :7200
```

### Пересборка после изменений

```bash
# Пересборка и перезапуск
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

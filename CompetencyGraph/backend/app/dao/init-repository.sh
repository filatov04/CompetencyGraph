#!/bin/sh

echo "Waiting for GraphDB to be ready..."
sleep 5

# Получаем список всех репозиториев
REPO_LIST=$(curl -s "http://graphdb:7200/rest/repositories")

echo "Checking if repository 'competencies' exists..."
echo "Response: $REPO_LIST"

# Проверяем, есть ли 'competencies' в списке
if echo "$REPO_LIST" | grep -q '"id":"competencies"'; then
  echo "Repository 'competencies' already exists"
  exit 0
else
  echo "Repository 'competencies' not found. Creating..."
  # Создаем репозиторий из конфигурации
  RESPONSE=$(curl -s -X POST \
    -H "Content-Type: multipart/form-data" \
    -F "config=@/tmp/repository-config.ttl" \
    "http://graphdb:7200/rest/repositories")

  echo "Response: $RESPONSE"

  # Проверяем создание
  sleep 2
  if curl -s "http://graphdb:7200/rest/repositories" | grep -q '"id":"competencies"'; then
    echo "Repository 'competencies' created successfully!"
    exit 0
  else
    echo "Failed to create repository"
    exit 1
  fi
fi

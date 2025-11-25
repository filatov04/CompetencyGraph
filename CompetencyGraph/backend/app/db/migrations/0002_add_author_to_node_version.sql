-- Добавление информации об авторе последнего изменения в node_version
-- Эта миграция добавляет поле last_modified_by для отслеживания автора изменений

-- Добавляем поле last_modified_by с внешним ключом на таблицу user
ALTER TABLE node_version
ADD COLUMN IF NOT EXISTS last_modified_by INTEGER REFERENCES "user"(id);

-- Создаем индекс для оптимизации запросов по автору
CREATE INDEX IF NOT EXISTS idx_node_version_author ON node_version(last_modified_by);

-- Обновляем существующие записи, заполняя last_modified_by из последней записи в истории
-- Это нужно для существующих данных
UPDATE node_version nv
SET last_modified_by = (
    SELECT nch.user_id
    FROM node_change_history nch
    WHERE nch.node_uri = nv.node_uri
    ORDER BY nch.changed_at DESC
    LIMIT 1
)
WHERE last_modified_by IS NULL;

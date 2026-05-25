-- 006_lessons_content.sql
-- Добавляем поле content для текстового содержания урока
ALTER TABLE lessons
    ADD COLUMN IF NOT EXISTS content text;

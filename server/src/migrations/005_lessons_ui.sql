-- 005_lessons_ui.sql
-- Добавляем ui_variant и ui_title для уроков (аналогично курсам и модулям)
ALTER TABLE lessons
    ADD COLUMN IF NOT EXISTS ui_variant text,
    ADD COLUMN IF NOT EXISTS ui_title text;

-- 004_lessons_modules.sql
-- 1) Убираем старую уникальность по курсу, чтобы order_index был в рамках module_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lessons_course_id_order_index_key'
  ) THEN
ALTER TABLE lessons DROP CONSTRAINT lessons_course_id_order_index_key;
END IF;
END $$;

-- 2) Новый уникальный индекс/ограничение: порядок уроков внутри модуля
CREATE UNIQUE INDEX IF NOT EXISTS uq_lessons_module_order
    ON lessons(module_id, order_index)
    WHERE module_id IS NOT NULL;

-- 3) (опционально) индекс для выборок уроков модуля
CREATE INDEX IF NOT EXISTS idx_lessons_module_order
    ON lessons(module_id, order_index);
ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS ui_variant text,
    ADD COLUMN IF NOT EXISTS ui_title text;

CREATE INDEX IF NOT EXISTS idx_courses_ui_variant ON courses(ui_variant);
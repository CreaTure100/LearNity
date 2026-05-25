CREATE TABLE IF NOT EXISTS modules (
                                       id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    position int NOT NULL DEFAULT 1,
    ui_variant text,
    ui_title text,
    created_at timestamptz NOT NULL DEFAULT now()
    );

CREATE INDEX IF NOT EXISTS idx_modules_course_id ON modules(course_id);
CREATE INDEX IF NOT EXISTS idx_modules_course_pos ON modules(course_id, position);

ALTER TABLE lessons
    ADD COLUMN IF NOT EXISTS module_id uuid REFERENCES modules(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_lessons_module_id ON lessons(module_id);
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('student', 'teacher', 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_type') THEN
    CREATE TYPE assignment_type AS ENUM ('single_choice');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'word_source_type') THEN
    CREATE TYPE word_source_type AS ENUM ('common', 'personal');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  login text NOT NULL,
  password_hash text NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_ci ON users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_login_ci ON users (lower(login));

CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  level text,
  cover_image_url text,
  owner_teacher_id uuid REFERENCES users(id) ON DELETE SET NULL,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  order_index integer NOT NULL CHECK(order_index > 0),
  title text NOT NULL,
  description text,
  video_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, order_index)
);

CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  type assignment_type NOT NULL DEFAULT 'single_choice',
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  correct_option_id text NOT NULL,
  score integer NOT NULL DEFAULT 1 CHECK(score >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  selected_option_id text NOT NULL,
  is_correct boolean NOT NULL,
  earned_score integer NOT NULL DEFAULT 0,
  answered_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS common_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text NOT NULL,
  transcription text,
  translation text,
  example text,
  definition text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_common_word_ci ON common_words (lower(word));

CREATE TABLE IF NOT EXISTS personal_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  common_word_id uuid REFERENCES common_words(id) ON DELETE SET NULL,
  word text NOT NULL,
  transcription text,
  translation text,
  example text,
  definition text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, word)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_personal_word_ci ON personal_words(user_id, lower(word));

CREATE TABLE IF NOT EXISTS user_word_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type word_source_type NOT NULL,
  common_word_id uuid REFERENCES common_words(id) ON DELETE CASCADE,
  personal_word_id uuid REFERENCES personal_words(id) ON DELETE CASCADE,
  interval_days integer NOT NULL DEFAULT 0 CHECK(interval_days >= 0),
  repetitions integer NOT NULL DEFAULT 0 CHECK(repetitions >= 0),
  easiness_factor numeric(4,2) NOT NULL DEFAULT 2.50 CHECK(easiness_factor >= 1.30),
  next_review_date date NOT NULL DEFAULT CURRENT_DATE,
  last_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (source_type = 'common' AND common_word_id IS NOT NULL AND personal_word_id IS NULL) OR
    (source_type = 'personal' AND personal_word_id IS NOT NULL AND common_word_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_progress_common ON user_word_progress(user_id, common_word_id) WHERE source_type='common';
CREATE UNIQUE INDEX IF NOT EXISTS uq_progress_personal ON user_word_progress(user_id, personal_word_id) WHERE source_type='personal';

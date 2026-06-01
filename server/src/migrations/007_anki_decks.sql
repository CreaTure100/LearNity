DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'card_state') THEN
    CREATE TYPE card_state AS ENUM ('new', 'learning', 'review', 'relearning');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deck_type') THEN
    CREATE TYPE deck_type AS ENUM ('common', 'personal');
  END IF;
END $$;

ALTER TABLE user_word_progress
  ADD COLUMN IF NOT EXISTS state card_state NOT NULL DEFAULT 'review',
  ADD COLUMN IF NOT EXISTS step_index integer NOT NULL DEFAULT 0 CHECK (step_index >= 0),
  ADD COLUMN IF NOT EXISTS next_review_at timestamptz;

UPDATE user_word_progress
SET next_review_at = COALESCE(next_review_at, next_review_date::timestamptz, now())
WHERE next_review_at IS NULL;

ALTER TABLE user_word_progress
  ALTER COLUMN next_review_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_progress_user_source_state_next_at
  ON user_word_progress(user_id, source_type, state, next_review_at);

CREATE TABLE IF NOT EXISTS deck_settings (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck deck_type NOT NULL,
  new_per_day integer NOT NULL DEFAULT 20 CHECK (new_per_day >= 0),
  learning_steps_minutes integer[] NOT NULL DEFAULT ARRAY[2,16],
  graduating_interval_days integer NOT NULL DEFAULT 1 CHECK (graduating_interval_days > 0),
  easy_interval_days integer NOT NULL DEFAULT 4 CHECK (easy_interval_days > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, deck)
);

INSERT INTO deck_settings (user_id, deck)
SELECT u.id, d.deck::deck_type
FROM users u
CROSS JOIN (VALUES ('common'), ('personal')) AS d(deck)
ON CONFLICT (user_id, deck) DO NOTHING;

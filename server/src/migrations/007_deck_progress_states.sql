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
SET next_review_at = next_review_date::timestamptz
WHERE next_review_at IS NULL;

ALTER TABLE user_word_progress
  ALTER COLUMN next_review_at SET NOT NULL;

ALTER TABLE user_word_progress
  ALTER COLUMN next_review_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_progress_due_by_user_state ON user_word_progress(user_id, source_type, state, next_review_at);

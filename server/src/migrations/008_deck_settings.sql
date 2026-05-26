CREATE TABLE IF NOT EXISTS deck_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck deck_type NOT NULL,
  new_per_day integer NOT NULL DEFAULT 20 CHECK (new_per_day > 0),
  learning_steps_minutes integer[] NOT NULL DEFAULT ARRAY[2, 16]::integer[],
  graduating_interval_days integer NOT NULL DEFAULT 1 CHECK (graduating_interval_days > 0),
  easy_interval_days integer NOT NULL DEFAULT 4 CHECK (easy_interval_days > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, deck)
);

INSERT INTO deck_settings(user_id, deck)
SELECT u.id, d.deck
FROM users u
CROSS JOIN (VALUES ('common'::deck_type), ('personal'::deck_type)) AS d(deck)
ON CONFLICT (user_id, deck) DO NOTHING;

const express = require('express');
const { body, param } = require('express-validator');
const db = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { calculateNextReview } = require('../utils/sm2');

const router = express.Router();

const DECKS = ['common', 'personal'];
const DEFAULT_STEPS = [2, 16];

function normalizeSteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return DEFAULT_STEPS;
  }
  return steps.map((step) => Number(step)).filter((step) => Number.isInteger(step) && step > 0);
}

async function ensureDeckSettings(client, userId) {
  await client.query(
    `INSERT INTO deck_settings (user_id, deck)
     SELECT $1, d.deck::deck_type
     FROM (VALUES ('common'), ('personal')) AS d(deck)
     ON CONFLICT (user_id, deck) DO NOTHING`,
    [userId],
  );
}

async function getDeckSettings(client, userId, deck) {
  await ensureDeckSettings(client, userId);
  const result = await client.query(
    `SELECT user_id, deck, new_per_day, learning_steps_minutes, graduating_interval_days, easy_interval_days
     FROM deck_settings
     WHERE user_id=$1 AND deck=$2::deck_type`,
    [userId, deck],
  );
  return result.rows[0];
}

function serializeSettings(settings) {
  return {
    deck: settings.deck,
    new_per_day: settings.new_per_day,
    learning_steps_minutes: settings.learning_steps_minutes,
    graduating_interval_days: settings.graduating_interval_days,
    easy_interval_days: settings.easy_interval_days,
  };
}

async function countIntroducedToday(client, userId, deck) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM user_word_progress
     WHERE user_id=$1
       AND source_type=$2::word_source_type
       AND created_at::date=CURRENT_DATE`,
    [userId, deck],
  );
  return result.rows[0].count;
}

async function countNewAvailable(client, userId, deck) {
  if (deck === 'common') {
    const result = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM common_words cw
       LEFT JOIN user_word_progress p
         ON p.user_id=$1 AND p.source_type='common' AND p.common_word_id=cw.id
       WHERE p.id IS NULL`,
      [userId],
    );
    return result.rows[0].count;
  }

  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM personal_words pw
     LEFT JOIN user_word_progress p
       ON p.user_id=$1 AND p.source_type='personal' AND p.personal_word_id=pw.id
     WHERE pw.user_id=$1 AND p.id IS NULL`,
    [userId],
  );
  return result.rows[0].count;
}

async function getDueCount(client, userId, deck, states) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM user_word_progress p
     WHERE p.user_id=$1
       AND p.source_type=$2::word_source_type
       AND p.state = ANY($3::card_state[])
       AND p.next_review_at::date <= CURRENT_DATE`,
    [userId, deck, states],
  );
  return result.rows[0].count;
}

async function getDueProgressCard(client, userId, deck, stateClause, excludeProgressId = null) {
  if (deck === 'common') {
    const params = excludeProgressId ? [userId, excludeProgressId] : [userId];
    const excludeClause = excludeProgressId ? 'AND p.id <> $2' : '';
    const result = await client.query(
      `SELECT p.id AS progress_id,
              p.state,
              p.step_index,
              p.next_review_at,
              p.interval_days,
              p.repetitions,
              p.easiness_factor,
              cw.id AS word_id,
              cw.word,
              cw.translation,
              cw.transcription,
              cw.example_en,
              cw.definition_en,
              cw.definition_ru
       FROM user_word_progress p
       JOIN common_words cw ON cw.id = p.common_word_id
       WHERE p.user_id=$1
         AND p.source_type='common'
         ${excludeClause}
         AND ${stateClause}
       ORDER BY p.next_review_at ASC, p.created_at ASC
       LIMIT 1`,
      params,
    );
    return result.rows[0] || null;
  }

  const params = excludeProgressId ? [userId, excludeProgressId] : [userId];
  const excludeClause = excludeProgressId ? 'AND p.id <> $2' : '';
  const result = await client.query(
    `SELECT p.id AS progress_id,
            p.state,
            p.step_index,
            p.next_review_at,
            p.interval_days,
            p.repetitions,
            p.easiness_factor,
            pw.id AS word_id,
            pw.word,
            pw.translation,
            pw.transcription,
            pw.example,
            pw.definition
     FROM user_word_progress p
     JOIN personal_words pw ON pw.id = p.personal_word_id
     WHERE p.user_id=$1
       AND p.source_type='personal'
       AND pw.user_id=$1
       ${excludeClause}
       AND ${stateClause}
     ORDER BY p.next_review_at ASC, p.created_at ASC
     LIMIT 1`,
    params,
  );
  return result.rows[0] || null;
}

async function getNewWordCard(client, userId, deck) {
  if (deck === 'common') {
    const result = await client.query(
      `SELECT cw.id AS word_id,
              cw.word,
              cw.translation,
              cw.transcription,
              cw.example_en,
              cw.definition_en,
              cw.definition_ru
       FROM common_words cw
       LEFT JOIN user_word_progress p
         ON p.user_id=$1 AND p.source_type='common' AND p.common_word_id=cw.id
       WHERE p.id IS NULL
       ORDER BY cw.created_at ASC
       LIMIT 1`,
      [userId],
    );
    return result.rows[0] || null;
  }

  const result = await client.query(
    `SELECT pw.id AS word_id,
            pw.word,
            pw.translation,
            pw.transcription,
            pw.example,
            pw.definition
     FROM personal_words pw
     LEFT JOIN user_word_progress p
       ON p.user_id=$1 AND p.source_type='personal' AND p.personal_word_id=pw.id
     WHERE pw.user_id=$1 AND p.id IS NULL
     ORDER BY pw.created_at ASC
     LIMIT 1`,
    [userId],
  );
  return result.rows[0] || null;
}

async function selectNextCard(client, userId, deck, settings, excludeProgressId = null) {
  const dueReview = await getDueProgressCard(
    client,
    userId,
    deck,
    "p.state='review' AND p.next_review_at <= NOW()",
    excludeProgressId,
  );
  if (dueReview) {
    return dueReview;
  }

  const dueLearning = await getDueProgressCard(
    client,
    userId,
    deck,
    "p.state IN ('learning', 'relearning') AND p.next_review_at <= NOW()",
    excludeProgressId,
  );
  if (dueLearning) {
    return dueLearning;
  }

  const introducedToday = await countIntroducedToday(client, userId, deck);
  const availableNew = await countNewAvailable(client, userId, deck);
  const newRemaining = Math.max((settings.new_per_day || 0) - introducedToday, 0);
  const dueLaterToday = await getDueProgressCard(
    client,
    userId,
    deck,
    "p.state IN ('learning', 'relearning', 'review') AND p.next_review_at::date = CURRENT_DATE AND p.next_review_at > NOW()",
    excludeProgressId,
  );

  if (newRemaining <= 0 || availableNew === 0) {
    if (dueLaterToday) {
      return dueLaterToday;
    }
    return null;
  }

  const newCard = await getNewWordCard(client, userId, deck);
  if (newCard) {
    return {
      ...newCard,
      progress_id: null,
      state: 'new',
      step_index: 0,
      next_review_at: null,
      interval_days: 0,
      repetitions: 0,
      easiness_factor: 2.5,
    };
  }

  if (dueLaterToday) {
    return dueLaterToday;
  }

  return null;
}

async function getNextDueAt(client, userId, deck) {
  const result = await client.query(
    `SELECT MIN(p.next_review_at) AS next_due_at
     FROM user_word_progress p
     WHERE p.user_id=$1
       AND p.source_type=$2::word_source_type
       AND p.state IN ('learning', 'relearning', 'review')
       AND p.next_review_at > NOW()`,
    [userId, deck],
  );
  return result.rows[0]?.next_due_at || null;
}

async function getWord(client, userId, deck, wordId) {
  if (deck === 'common') {
    const word = await client.query(
      `SELECT id, word, translation, transcription, example_en, definition_en, definition_ru
       FROM common_words
       WHERE id=$1`,
      [wordId],
    );
    return word.rows[0] || null;
  }

  const word = await client.query(
    `SELECT id, word, translation, transcription, example, definition
     FROM personal_words
     WHERE id=$1 AND user_id=$2`,
    [wordId, userId],
  );
  return word.rows[0] || null;
}

async function findProgress(client, userId, deck, wordId) {
  if (deck === 'common') {
    const result = await client.query(
      `SELECT *
       FROM user_word_progress
       WHERE user_id=$1 AND source_type='common' AND common_word_id=$2`,
      [userId, wordId],
    );
    return result.rows[0] || null;
  }

  const result = await client.query(
    `SELECT *
     FROM user_word_progress
     WHERE user_id=$1 AND source_type='personal' AND personal_word_id=$2`,
    [userId, wordId],
  );
  return result.rows[0] || null;
}

async function createProgress(client, userId, deck, wordId) {
  if (deck === 'common') {
    const inserted = await client.query(
      `INSERT INTO user_word_progress(user_id, source_type, common_word_id, state, step_index, next_review_at, next_review_date)
       VALUES($1, 'common', $2, 'new', 0, NOW(), CURRENT_DATE)
       RETURNING *`,
      [userId, wordId],
    );
    return inserted.rows[0];
  }

  const inserted = await client.query(
    `INSERT INTO user_word_progress(user_id, source_type, personal_word_id, state, step_index, next_review_at, next_review_date)
     VALUES($1, 'personal', $2, 'new', 0, NOW(), CURRENT_DATE)
     RETURNING *`,
    [userId, wordId],
  );
  return inserted.rows[0];
}

function getOverdueDays(progress, now) {
  if (!progress?.next_review_at || progress.state !== 'review') {
    return 0;
  }
  const diffMs = now.getTime() - new Date(progress.next_review_at).getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return 0;
  }
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

function formatDelay(from, to) {
  if (!from || !to) {
    return null;
  }
  const diffMs = Math.max(0, to.getTime() - from.getTime());
  const dayMs = 24 * 60 * 60 * 1000;
  if (diffMs >= dayMs) {
    const days = Math.max(1, Math.round(diffMs / dayMs));
    return { unit: 'day', value: days, label: `${days} д` };
  }
  const minutes = Math.max(1, Math.round(diffMs / (60 * 1000)));
  return { unit: 'minute', value: minutes, label: `${minutes} мин` };
}

function normalizeStudyCard(card) {
  if (!card) {
    return null;
  }
  return {
    ...card,
    definition: card.definition ?? card.definition_ru ?? card.definition_en ?? null,
    example: card.example ?? card.example_en ?? null,
  };
}

function buildAnswerDelays(card, settings) {
  if (!card || !settings) {
    return null;
  }
  const now = new Date();
  const progress = {
    state: card.state || 'new',
    step_index: card.step_index ?? 0,
    repetitions: card.repetitions ?? 0,
    interval_days: card.interval_days ?? 0,
    easiness_factor: card.easiness_factor ?? 2.5,
    next_review_at: card.next_review_at ?? null,
  };
  const overdueDays = getOverdueDays(progress, now);
  const transitions = {
    again: calculateNextReview(progress, 'again', settings, overdueDays),
    hard: calculateNextReview(progress, 'hard', settings, overdueDays),
    good: calculateNextReview(progress, 'good', settings, overdueDays),
    easy: calculateNextReview(progress, 'easy', settings, overdueDays),
  };

  return Object.fromEntries(
    Object.entries(transitions).map(([rating, transition]) => [rating, formatDelay(now, transition.next_review_at)]),
  );
}

function decorateStudyCard(card, settings) {
  const normalized = normalizeStudyCard(card);
  if (!normalized) {
    return null;
  }
  return {
    ...normalized,
    answer_delays: buildAnswerDelays(normalized, settings),
  };
}

router.get('/decks/summary', authRequired, async (req, res, next) => {
  const client = await db.getClient();
  try {
    await ensureDeckSettings(client, req.user.id);

    const result = [];
    for (const deck of DECKS) {
      const settings = await getDeckSettings(client, req.user.id, deck);
      const learning = await getDueCount(client, req.user.id, deck, ['learning', 'relearning']);
      const review = await getDueCount(client, req.user.id, deck, ['review']);
      const availableNew = await countNewAvailable(client, req.user.id, deck);
      const introducedToday = await countIntroducedToday(client, req.user.id, deck);
      const newRemaining = Math.max(settings.new_per_day - introducedToday, 0);

      result.push({
        deck,
        new: Math.min(availableNew, newRemaining),
        learning,
        review,
      });
    }

    return res.json(result);
  } catch (error) {
    return next(error);
  } finally {
    client.release();
  }
});

router.get('/decks/:deck/settings', authRequired, [param('deck').isIn(DECKS)], validate, async (req, res, next) => {
  const client = await db.getClient();
  try {
    const settings = await getDeckSettings(client, req.user.id, req.params.deck);
    return res.json(serializeSettings(settings));
  } catch (error) {
    return next(error);
  } finally {
    client.release();
  }
});

router.patch(
  '/decks/:deck/settings',
  authRequired,
  [
    param('deck').isIn(DECKS),
    body('new_per_day').optional().isInt({ min: 0, max: 500 }),
    body('learning_steps_minutes')
      .optional()
      .isArray({ min: 1 })
      .withMessage('learning_steps_minutes должен быть массивом'),
    body('learning_steps_minutes.*').optional().isInt({ min: 1, max: 1440 }),
    body('graduating_interval_days').optional().isInt({ min: 1, max: 3650 }),
    body('easy_interval_days').optional().isInt({ min: 1, max: 3650 }),
  ],
  validate,
  async (req, res, next) => {
    const client = await db.getClient();
    try {
      const current = await getDeckSettings(client, req.user.id, req.params.deck);

      const payload = {
        new_per_day: req.body.new_per_day ?? current.new_per_day,
        learning_steps_minutes: normalizeSteps(req.body.learning_steps_minutes ?? current.learning_steps_minutes),
        graduating_interval_days: req.body.graduating_interval_days ?? current.graduating_interval_days,
        easy_interval_days: req.body.easy_interval_days ?? current.easy_interval_days,
      };

      if (payload.easy_interval_days < payload.graduating_interval_days) {
        return res.status(400).json({ message: 'easy_interval_days должен быть не меньше graduating_interval_days' });
      }

      const updated = await client.query(
        `UPDATE deck_settings
         SET new_per_day=$1,
             learning_steps_minutes=$2,
             graduating_interval_days=$3,
             easy_interval_days=$4,
             updated_at=NOW()
         WHERE user_id=$5 AND deck=$6::deck_type
         RETURNING user_id, deck, new_per_day, learning_steps_minutes, graduating_interval_days, easy_interval_days`,
        [
          payload.new_per_day,
          payload.learning_steps_minutes,
          payload.graduating_interval_days,
          payload.easy_interval_days,
          req.user.id,
          req.params.deck,
        ],
      );

      return res.json(serializeSettings(updated.rows[0]));
    } catch (error) {
      return next(error);
    } finally {
      client.release();
    }
  },
);

router.post('/decks/:deck/study/next', authRequired, [param('deck').isIn(DECKS)], validate, async (req, res, next) => {
  const client = await db.getClient();
  try {
    const settings = await getDeckSettings(client, req.user.id, req.params.deck);
    const card = await selectNextCard(client, req.user.id, req.params.deck, settings);
    if (!card) {
      const nextDueAt = await getNextDueAt(client, req.user.id, req.params.deck);
      return res.json({ card: null, next_due_at: nextDueAt });
    }
    return res.json({ card: decorateStudyCard(card, settings), next_due_at: null });
  } catch (error) {
    return next(error);
  } finally {
    client.release();
  }
});

router.post(
  '/decks/:deck/study/answer',
  authRequired,
  [param('deck').isIn(DECKS), body('word_id').isUUID(), body('rating').isIn(['again', 'hard', 'good', 'easy'])],
  validate,
  async (req, res, next) => {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const deck = req.params.deck;
      const settings = await getDeckSettings(client, req.user.id, deck);
      const word = await getWord(client, req.user.id, deck, req.body.word_id);

      if (!word) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Карточка не найдена' });
      }

      let progress = await findProgress(client, req.user.id, deck, word.id);
      if (!progress) {
        progress = await createProgress(client, req.user.id, deck, word.id);
      }

      const now = new Date();
      const overdueDays = getOverdueDays(progress, now);
      const transition = calculateNextReview(progress, req.body.rating, settings, overdueDays);

      const updated = await client.query(
        `UPDATE user_word_progress
         SET state=$1,
             step_index=$2,
             next_review_at=$3,
             next_review_date=$4,
             interval_days=$5,
             repetitions=$6,
             easiness_factor=$7,
             last_reviewed_at=NOW(),
             updated_at=NOW()
         WHERE id=$8
         RETURNING *`,
        [
          transition.state,
          transition.step_index,
          transition.next_review_at,
          transition.next_review_date,
          transition.interval_days,
          transition.repetitions,
          transition.easiness_factor,
          progress.id,
        ],
      );

      const nextCard = await selectNextCard(client, req.user.id, deck, settings, progress.id);

      await client.query('COMMIT');
      if (!nextCard) {
        const nextDueAt = await getNextDueAt(client, req.user.id, deck);
        return res.json({ progress: updated.rows[0], card: null, next_due_at: nextDueAt });
      }
      return res.json({ progress: updated.rows[0], card: decorateStudyCard(nextCard, settings), next_due_at: null });
    } catch (error) {
      await client.query('ROLLBACK');
      return next(error);
    } finally {
      client.release();
    }
  },
);

module.exports = router;

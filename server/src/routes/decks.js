const express = require('express');
const { body, param } = require('express-validator');
const db = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { calculateNextReview } = require('../utils/sm2');

const router = express.Router();

const DEFAULT_SETTINGS = {
  new_per_day: 20,
  learning_steps_minutes: [2, 16],
  graduating_interval_days: 1,
  easy_interval_days: 4,
};

function getWordJoinSql() {
  return `COALESCE(cw.word, pw.word) AS word,
          COALESCE(cw.translation, pw.translation) AS translation,
          COALESCE(cw.transcription, pw.transcription) AS transcription,
          COALESCE(cw.example_en, pw.example) AS example,
          COALESCE(cw.definition_en, pw.definition) AS definition`;
}

function getSourceFilter(deck) {
  return deck === 'common' ? "p.source_type='common'" : "p.source_type='personal'";
}

function parseLearningSteps(value) {
  if (Array.isArray(value)) {
    return value.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0);
  }
  if (typeof value === 'string') {
    return value
      .trim()
      .split(/\s+/)
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n > 0);
  }
  return [];
}

async function ensureDeckSettings(client, userId, deck) {
  await client.query(
    `INSERT INTO deck_settings(user_id, deck, new_per_day, learning_steps_minutes, graduating_interval_days, easy_interval_days)
     VALUES($1, $2::deck_type, $3, $4::integer[], $5, $6)
     ON CONFLICT (user_id, deck) DO NOTHING`,
    [userId, deck, DEFAULT_SETTINGS.new_per_day, DEFAULT_SETTINGS.learning_steps_minutes, DEFAULT_SETTINGS.graduating_interval_days, DEFAULT_SETTINGS.easy_interval_days],
  );

  const settings = await client.query('SELECT * FROM deck_settings WHERE user_id=$1 AND deck=$2::deck_type', [userId, deck]);
  return settings.rows[0];
}

async function getNewRemaining(client, userId, deck, newPerDay) {
  const introduced = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM user_word_progress
     WHERE user_id=$1
       AND source_type=$2::word_source_type
       AND created_at::date = CURRENT_DATE
       AND state <> 'new'`,
    [userId, deck],
  );
  return Math.max(newPerDay - introduced.rows[0].count, 0);
}

async function getExistingNewCount(client, userId, deck) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM user_word_progress p
     WHERE p.user_id=$1
       AND ${getSourceFilter(deck)}
       AND p.state='new'`,
    [userId],
  );
  return result.rows[0].count;
}

async function getUnseenNewCount(client, userId, deck) {
  if (deck === 'common') {
    const result = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM common_words cw
       WHERE NOT EXISTS (
         SELECT 1
         FROM user_word_progress p
         WHERE p.user_id=$1 AND p.source_type='common' AND p.common_word_id=cw.id
       )`,
      [userId],
    );
    return result.rows[0].count;
  }

  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM personal_words pw
     WHERE pw.user_id=$1
       AND NOT EXISTS (
         SELECT 1
         FROM user_word_progress p
         WHERE p.user_id=$1 AND p.source_type='personal' AND p.personal_word_id=pw.id
       )`,
    [userId],
  );
  return result.rows[0].count;
}

async function getDueCount(client, userId, deck, states) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM user_word_progress p
     WHERE p.user_id=$1
       AND ${getSourceFilter(deck)}
       AND p.state = ANY($2::card_state[])
       AND p.next_review_at <= NOW()`,
    [userId, states],
  );
  return result.rows[0].count;
}

async function getProgressCardById(client, userId, progressId) {
  const result = await client.query(
    `SELECT p.id AS progress_id,
            p.source_type,
            p.state,
            p.step_index,
            p.next_review_at,
            p.repetitions,
            p.interval_days,
            p.easiness_factor,
            p.common_word_id,
            p.personal_word_id,
            ${getWordJoinSql()}
     FROM user_word_progress p
     LEFT JOIN common_words cw ON cw.id = p.common_word_id
     LEFT JOIN personal_words pw ON pw.id = p.personal_word_id
     WHERE p.id=$1 AND p.user_id=$2`,
    [progressId, userId],
  );

  return result.rows[0] || null;
}

async function pickDueCard(client, userId, deck, states) {
  const result = await client.query(
    `SELECT p.id AS progress_id
     FROM user_word_progress p
     WHERE p.user_id=$1
       AND ${getSourceFilter(deck)}
       AND p.state = ANY($2::card_state[])
       AND p.next_review_at <= NOW()
     ORDER BY p.next_review_at ASC, p.created_at ASC
     LIMIT 1`,
    [userId, states],
  );

  if (!result.rowCount) {
    return null;
  }

  return getProgressCardById(client, userId, result.rows[0].progress_id);
}

async function pickExistingNewCard(client, userId, deck) {
  const result = await client.query(
    `SELECT p.id AS progress_id
     FROM user_word_progress p
     WHERE p.user_id=$1
       AND ${getSourceFilter(deck)}
       AND p.state='new'
     ORDER BY p.created_at ASC
     LIMIT 1`,
    [userId],
  );

  if (!result.rowCount) {
    return null;
  }

  return getProgressCardById(client, userId, result.rows[0].progress_id);
}

async function createNewProgressFromSource(client, userId, deck) {
  if (deck === 'common') {
    const source = await client.query(
      `SELECT cw.id
       FROM common_words cw
       WHERE NOT EXISTS (
         SELECT 1
         FROM user_word_progress p
         WHERE p.user_id=$1 AND p.source_type='common' AND p.common_word_id=cw.id
       )
       ORDER BY cw.created_at ASC
       LIMIT 1`,
      [userId],
    );

    if (!source.rowCount) {
      return null;
    }

    const inserted = await client.query(
      `INSERT INTO user_word_progress(user_id, source_type, common_word_id, state, step_index, next_review_at, next_review_date)
       VALUES($1, 'common', $2, 'new', 0, NOW(), CURRENT_DATE)
       ON CONFLICT (user_id, common_word_id) WHERE source_type='common'
       DO NOTHING
       RETURNING id`,
      [userId, source.rows[0].id],
    );

    if (!inserted.rowCount) {
      return null;
    }

    return getProgressCardById(client, userId, inserted.rows[0].id);
  }

  const source = await client.query(
    `SELECT pw.id
     FROM personal_words pw
     WHERE pw.user_id=$1
       AND NOT EXISTS (
         SELECT 1
         FROM user_word_progress p
         WHERE p.user_id=$1 AND p.source_type='personal' AND p.personal_word_id=pw.id
       )
     ORDER BY pw.created_at ASC
     LIMIT 1`,
    [userId],
  );

  if (!source.rowCount) {
    return null;
  }

  const inserted = await client.query(
    `INSERT INTO user_word_progress(user_id, source_type, personal_word_id, state, step_index, next_review_at, next_review_date)
     VALUES($1, 'personal', $2, 'new', 0, NOW(), CURRENT_DATE)
     ON CONFLICT (user_id, personal_word_id) WHERE source_type='personal'
     DO NOTHING
     RETURNING id`,
    [userId, source.rows[0].id],
  );

  if (!inserted.rowCount) {
    return null;
  }

  return getProgressCardById(client, userId, inserted.rows[0].id);
}

async function getNextDeckCard(client, userId, deck) {
  const dueReview = await pickDueCard(client, userId, deck, ['review']);
  if (dueReview) {
    return dueReview;
  }

  const dueLearning = await pickDueCard(client, userId, deck, ['learning', 'relearning']);
  if (dueLearning) {
    return dueLearning;
  }

  const existingNew = await pickExistingNewCard(client, userId, deck);
  if (existingNew) {
    return existingNew;
  }

  const settings = await ensureDeckSettings(client, userId, deck);
  const remaining = await getNewRemaining(client, userId, deck, settings.new_per_day);
  if (remaining <= 0) {
    return null;
  }

  return createNewProgressFromSource(client, userId, deck);
}

router.get('/decks/summary', authRequired, async (req, res, next) => {
  const client = await db.getClient();
  try {
    const decks = ['common', 'personal'];
    const summary = [];

    for (const deck of decks) {
      const settings = await ensureDeckSettings(client, req.user.id, deck);
      const review = await getDueCount(client, req.user.id, deck, ['review']);
      const learning = await getDueCount(client, req.user.id, deck, ['learning', 'relearning']);
      const existingNew = await getExistingNewCount(client, req.user.id, deck);
      const unseenNew = await getUnseenNewCount(client, req.user.id, deck);
      const remaining = await getNewRemaining(client, req.user.id, deck, settings.new_per_day);

      summary.push({
        deck,
        new: existingNew + Math.min(unseenNew, remaining),
        learning,
        review,
      });
    }

    return res.json(summary);
  } catch (error) {
    return next(error);
  } finally {
    client.release();
  }
});

router.get('/decks/:deck/settings', authRequired, [param('deck').isIn(['common', 'personal'])], validate, async (req, res, next) => {
  const client = await db.getClient();
  try {
    const settings = await ensureDeckSettings(client, req.user.id, req.params.deck);
    return res.json(settings);
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
    param('deck').isIn(['common', 'personal']),
    body('new_per_day').optional().isInt({ min: 1, max: 999 }),
    body('learning_steps_minutes').optional().custom((value) => parseLearningSteps(value).length > 0),
    body('graduating_interval_days').optional().isInt({ min: 1, max: 3650 }),
    body('easy_interval_days').optional().isInt({ min: 1, max: 3650 }),
  ],
  validate,
  async (req, res, next) => {
    const updates = [];
    const values = [req.user.id, req.params.deck];
    let idx = values.length + 1;

    if (req.body.new_per_day !== undefined) {
      updates.push(`new_per_day=$${idx++}`);
      values.push(Number(req.body.new_per_day));
    }
    if (req.body.learning_steps_minutes !== undefined) {
      updates.push(`learning_steps_minutes=$${idx++}::integer[]`);
      values.push(parseLearningSteps(req.body.learning_steps_minutes));
    }
    if (req.body.graduating_interval_days !== undefined) {
      updates.push(`graduating_interval_days=$${idx++}`);
      values.push(Number(req.body.graduating_interval_days));
    }
    if (req.body.easy_interval_days !== undefined) {
      updates.push(`easy_interval_days=$${idx++}`);
      values.push(Number(req.body.easy_interval_days));
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'Нет полей для обновления' });
    }

    const client = await db.getClient();
    try {
      await ensureDeckSettings(client, req.user.id, req.params.deck);
      const updated = await client.query(
        `UPDATE deck_settings
         SET ${updates.join(', ')}, updated_at=NOW()
         WHERE user_id=$1 AND deck=$2::deck_type
         RETURNING *`,
        values,
      );
      return res.json(updated.rows[0]);
    } catch (error) {
      return next(error);
    } finally {
      client.release();
    }
  },
);

router.post('/decks/:deck/study/next', authRequired, [param('deck').isIn(['common', 'personal'])], validate, async (req, res, next) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const card = await getNextDeckCard(client, req.user.id, req.params.deck);
    await client.query('COMMIT');
    return res.json({ card });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

router.post(
  '/decks/:deck/study/answer',
  authRequired,
  [
    param('deck').isIn(['common', 'personal']),
    body('progress_id').isUUID(),
    body('answer').isIn(['again', 'hard', 'good', 'easy']),
  ],
  validate,
  async (req, res, next) => {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const settings = await ensureDeckSettings(client, req.user.id, req.params.deck);
      const steps = settings.learning_steps_minutes?.length ? settings.learning_steps_minutes : DEFAULT_SETTINGS.learning_steps_minutes;

      const progressResult = await client.query(
        `SELECT *
         FROM user_word_progress
         WHERE id=$1 AND user_id=$2 AND source_type=$3::word_source_type
         FOR UPDATE`,
        [req.body.progress_id, req.user.id, req.params.deck],
      );

      if (!progressResult.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Карточка не найдена' });
      }

      const progress = progressResult.rows[0];
      const answer = req.body.answer;

      let state = progress.state;
      let stepIndex = progress.step_index || 0;
      let repetitions = progress.repetitions;
      let intervalDays = progress.interval_days;
      let easinessFactor = progress.easiness_factor;
      let nextReviewAt = null;
      let nextReviewDate = null;

      if (progress.state === 'review') {
        if (answer === 'again') {
          state = 'relearning';
          stepIndex = 0;
          repetitions = 0;
          intervalDays = 1;
          nextReviewAt = new Date(Date.now() + (steps[0] || 2) * 60 * 1000);
        } else {
          const quality = answer === 'hard' ? 3 : answer === 'good' ? 4 : 5;
          const next = calculateNextReview(progress, quality);
          state = 'review';
          stepIndex = 0;
          repetitions = next.repetitions;
          intervalDays = next.intervalDays;
          easinessFactor = next.easinessFactor;
          nextReviewAt = new Date(Date.now() + next.intervalDays * 24 * 60 * 60 * 1000);
        }
      } else {
        const learningState = progress.state === 'relearning' ? 'relearning' : 'learning';
        if (answer === 'again') {
          state = learningState;
          stepIndex = 0;
          nextReviewAt = new Date(Date.now() + (steps[0] || 2) * 60 * 1000);
        } else if (answer === 'hard') {
          state = learningState;
          nextReviewAt = new Date(Date.now() + 8 * 60 * 1000);
        } else if (answer === 'easy') {
          state = 'review';
          stepIndex = 0;
          intervalDays = settings.easy_interval_days;
          repetitions = 1;
          nextReviewAt = new Date(Date.now() + settings.easy_interval_days * 24 * 60 * 60 * 1000);
        } else {
          const nextStep = stepIndex + 1;
          if (nextStep >= steps.length) {
            state = 'review';
            stepIndex = 0;
            intervalDays = settings.graduating_interval_days;
            repetitions = 1;
            nextReviewAt = new Date(Date.now() + settings.graduating_interval_days * 24 * 60 * 60 * 1000);
          } else {
            state = learningState;
            stepIndex = nextStep;
            nextReviewAt = new Date(Date.now() + steps[nextStep] * 60 * 1000);
          }
        }
      }

      nextReviewDate = nextReviewAt.toISOString().slice(0, 10);

      await client.query(
        `UPDATE user_word_progress
         SET state=$1,
             step_index=$2,
             repetitions=$3,
             interval_days=$4,
             easiness_factor=$5,
             next_review_at=$6,
             next_review_date=$7,
             last_reviewed_at=NOW(),
             updated_at=NOW()
         WHERE id=$8`,
        [state, stepIndex, repetitions, intervalDays, easinessFactor, nextReviewAt.toISOString(), nextReviewDate, progress.id],
      );

      const card = await getNextDeckCard(client, req.user.id, req.params.deck);
      await client.query('COMMIT');
      return res.json({ card });
    } catch (error) {
      await client.query('ROLLBACK');
      return next(error);
    } finally {
      client.release();
    }
  },
);

module.exports = router;

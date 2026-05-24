const express = require('express');
const { body, param, query } = require('express-validator');
const db = require('../config/db');
const { authRequired, requireRoles } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.get('/common-words', authRequired, async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM common_words ORDER BY created_at DESC');
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.post(
  '/common-words',
  authRequired,
  requireRoles('teacher', 'admin'),
  [body('word').notEmpty().withMessage('Слово обязательно')],
  validate,
  async (req, res, next) => {
    try {
      const { word, transcription = null, audio_url = null, translation = null, example = null, definition = null } = req.body;
      const result = await db.query(
        'INSERT INTO common_words(word, transcription, audio_url, translation, example, definition) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
        [word, transcription, audio_url, translation, example, definition],
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ message: 'Такое слово уже есть в общей колоде' });
      }
      return next(error);
    }
  },
);

router.delete('/common-words/:id', authRequired, requireRoles('teacher', 'admin'), [param('id').isUUID()], validate, async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM common_words WHERE id=$1', [req.params.id]);
    if (!result.rowCount) {
      return res.status(404).json({ message: 'Слово не найдено' });
    }
    return res.json({ message: 'Слово удалено из общей колоды' });
  } catch (error) {
    return next(error);
  }
});

router.get('/personal-words/my', authRequired, async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM personal_words WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]);
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.post(
  '/personal-words/my',
  authRequired,
  [
    body('word').optional().isString(),
    body('common_word_id').optional().isUUID().withMessage('common_word_id должен быть UUID'),
    body().custom((value) => {
      if (!value.word && !value.common_word_id) {
        throw new Error('Нужно передать word или common_word_id');
      }
      return true;
    }),
  ],
  validate,
  async (req, res, next) => {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      let wordData = {
        word: req.body.word,
        transcription: req.body.transcription || null,
        audio_url: req.body.audio_url || null,
        translation: req.body.translation || null,
        example: req.body.example || null,
        definition: req.body.definition || null,
        common_word_id: req.body.common_word_id || null,
      };

      if (req.body.common_word_id) {
        const common = await client.query('SELECT * FROM common_words WHERE id=$1', [req.body.common_word_id]);
        if (!common.rowCount) {
          await client.query('ROLLBACK');
          return res.status(404).json({ message: 'Слово из общей колоды не найдено' });
        }
        const cw = common.rows[0];
        wordData = {
          word: req.body.word || cw.word,
          transcription: req.body.transcription || cw.transcription,
          audio_url: req.body.audio_url || cw.audio_url,
          translation: req.body.translation || cw.translation,
          example: req.body.example || cw.example,
          definition: req.body.definition || cw.definition,
          common_word_id: cw.id,
        };
      }

      const inserted = await client.query(
        'INSERT INTO personal_words(user_id, common_word_id, word, transcription, audio_url, translation, example, definition) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [
          req.user.id,
          wordData.common_word_id,
          wordData.word,
          wordData.transcription,
          wordData.audio_url,
          wordData.translation,
          wordData.example,
          wordData.definition,
        ],
      );

      const personalWord = inserted.rows[0];
      await client.query(
        `INSERT INTO user_word_progress(user_id, source_type, personal_word_id, next_review_date)
         VALUES($1, 'personal', $2, CURRENT_DATE)
         ON CONFLICT (user_id, personal_word_id) WHERE source_type='personal' DO NOTHING`,
        [req.user.id, personalWord.id],
      );

      await client.query('COMMIT');
      return res.status(201).json(personalWord);
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') {
        return res.status(409).json({ message: 'Это слово уже есть в вашей личной колоде' });
      }
      return next(error);
    } finally {
      client.release();
    }
  },
);

router.delete('/personal-words/my/:id', authRequired, [param('id').isUUID()], validate, async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM personal_words WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!result.rowCount) {
      return res.status(404).json({ message: 'Слово не найдено в личной колоде' });
    }
    return res.json({ message: 'Слово удалено из личной колоды' });
  } catch (error) {
    return next(error);
  }
});

router.post('/common-words/:id/add-to-my', authRequired, [param('id').isUUID()], validate, async (req, res, next) => {
  try {
    const common = await db.query('SELECT * FROM common_words WHERE id=$1', [req.params.id]);
    if (!common.rowCount) {
      return res.status(404).json({ message: 'Слово не найдено' });
    }
    const word = common.rows[0];
    const progress = await db.query(
      `INSERT INTO user_word_progress(user_id, source_type, common_word_id, next_review_date)
       VALUES($1, 'common', $2, CURRENT_DATE)
       ON CONFLICT (user_id, common_word_id) WHERE source_type='common'
       DO UPDATE SET next_review_date = LEAST(user_word_progress.next_review_date, CURRENT_DATE)
       RETURNING *`,
      [req.user.id, word.id],
    );
    return res.status(201).json({ message: 'Слово добавлено в повторение', progress: progress.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.get('/repetition/today', authRequired, [query('source').optional().isIn(['all', 'common', 'personal'])], validate, async (req, res, next) => {
  try {
    const source = req.query.source || 'all';
    const values = [req.user.id];
    let sourceSql = '';
    if (source === 'common') {
      sourceSql = "AND p.source_type='common'";
    } else if (source === 'personal') {
      sourceSql = "AND p.source_type='personal'";
    }

    const result = await db.query(
      `SELECT p.*, 
              COALESCE(cw.word, pw.word) AS word,
              COALESCE(cw.translation, pw.translation) AS translation,
              COALESCE(cw.transcription, pw.transcription) AS transcription,
              COALESCE(cw.example, pw.example) AS example,
              COALESCE(cw.definition, pw.definition) AS definition
       FROM user_word_progress p
       LEFT JOIN common_words cw ON cw.id = p.common_word_id
       LEFT JOIN personal_words pw ON pw.id = p.personal_word_id
       WHERE p.user_id=$1 AND p.next_review_date <= CURRENT_DATE ${sourceSql}
       ORDER BY p.next_review_date ASC, p.created_at ASC`,
      values,
    );

    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

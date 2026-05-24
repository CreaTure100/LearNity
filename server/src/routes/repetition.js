const express = require('express');
const { body } = require('express-validator');
const db = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { calculateNextReview } = require('../utils/sm2');

const router = express.Router();

router.post('/repetition/review', authRequired, [body('progress_id').isUUID(), body('quality').isInt({ min: 0, max: 5 })], validate, async (req, res, next) => {
  try {
    const progressResult = await db.query('SELECT * FROM user_word_progress WHERE id=$1 AND user_id=$2', [req.body.progress_id, req.user.id]);
    if (!progressResult.rowCount) {
      return res.status(404).json({ message: 'Прогресс слова не найден' });
    }

    const progress = progressResult.rows[0];
    const next = calculateNextReview(progress, req.body.quality);
    const updated = await db.query(
      `UPDATE user_word_progress
       SET repetitions=$1, interval_days=$2, easiness_factor=$3, next_review_date=$4, last_reviewed_at=NOW()
       WHERE id=$5 RETURNING *`,
      [next.repetitions, next.intervalDays, next.easinessFactor, next.nextReviewDate, progress.id],
    );

    return res.json({ message: 'Результат повторения сохранён', progress: updated.rows[0] });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

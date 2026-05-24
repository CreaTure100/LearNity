const express = require('express');
const db = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/stats/my', authRequired, async (req, res, next) => {
  try {
    const [personal, common, repeatedToday, lessonProgress] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS count FROM personal_words WHERE user_id=$1', [req.user.id]),
      db.query("SELECT COUNT(*)::int AS count FROM user_word_progress WHERE user_id=$1 AND source_type='common'", [req.user.id]),
      db.query('SELECT COUNT(*)::int AS count FROM user_word_progress WHERE user_id=$1 AND last_reviewed_at::date=CURRENT_DATE', [req.user.id]),
      db.query(
        `SELECT
            COALESCE(ROUND((COUNT(DISTINCT ua.assignment_id)::numeric / NULLIF(COUNT(DISTINCT a.id),0)) * 100), 0)::int AS progress_percent
         FROM lessons l
         LEFT JOIN assignments a ON a.lesson_id=l.id
         LEFT JOIN user_answers ua ON ua.assignment_id=a.id AND ua.user_id=$1`,
        [req.user.id],
      ),
    ]);

    return res.json({
      personal_words_total: personal.rows[0].count,
      common_in_repetition_total: common.rows[0].count,
      repeated_today: repeatedToday.rows[0].count,
      lessons_progress_percent: lessonProgress.rows[0].progress_percent,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

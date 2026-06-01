const express = require('express');
const db = require('../config/db');
const { authRequired, requireRoles } = require('../middleware/auth');

const router = express.Router();

async function loadTotals() {
  const [totalCommonWords, totalAssignments] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS count FROM common_words'),
    db.query('SELECT COUNT(*)::int AS count FROM assignments'),
  ]);

  return {
    totalCommonWords: totalCommonWords.rows[0].count,
    totalAssignments: totalAssignments.rows[0].count,
  };
}

async function buildUserStats(userId, totals) {
  const [
    learnedWords,
    totalPersonalWords,
    repeatedToday,
    completedAssignments,
    lessonStats,
    moduleStats,
    courseStats,
  ] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS count FROM user_word_progress WHERE user_id=$1', [userId]),
    db.query('SELECT COUNT(*)::int AS count FROM personal_words WHERE user_id=$1', [userId]),
    db.query('SELECT COUNT(*)::int AS count FROM user_word_progress WHERE user_id=$1 AND last_reviewed_at::date=CURRENT_DATE', [userId]),
    db.query(
      `WITH latest AS (
        SELECT DISTINCT ON (assignment_id) assignment_id, is_correct
        FROM user_answers
        WHERE user_id=$1
        ORDER BY assignment_id, answered_at DESC
      )
      SELECT COUNT(*)::int AS count
      FROM latest
      WHERE is_correct=true`,
      [userId],
    ),
    db.query(
      `WITH latest AS (
        SELECT DISTINCT ON (assignment_id) assignment_id, is_correct
        FROM user_answers
        WHERE user_id=$1
        ORDER BY assignment_id, answered_at DESC
      ),
      lesson_totals AS (
        SELECT a.lesson_id, COUNT(*)::int AS total
        FROM assignments a
        GROUP BY a.lesson_id
      ),
      lesson_correct AS (
        SELECT a.lesson_id, COUNT(*)::int AS correct
        FROM assignments a
        JOIN latest la ON la.assignment_id=a.id AND la.is_correct=true
        GROUP BY a.lesson_id
      )
      SELECT
        COUNT(*) FILTER (WHERE lt.total = COALESCE(lc.correct, 0))::int AS completed,
        COUNT(*)::int AS total
      FROM lesson_totals lt
      LEFT JOIN lesson_correct lc ON lc.lesson_id=lt.lesson_id`,
      [userId],
    ),
    db.query(
      `WITH latest AS (
        SELECT DISTINCT ON (assignment_id) assignment_id, is_correct
        FROM user_answers
        WHERE user_id=$1
        ORDER BY assignment_id, answered_at DESC
      ),
      lesson_totals AS (
        SELECT l.id AS lesson_id, l.module_id, COUNT(a.id)::int AS total
        FROM lessons l
        JOIN assignments a ON a.lesson_id=l.id
        GROUP BY l.id, l.module_id
      ),
      lesson_correct AS (
        SELECT a.lesson_id, COUNT(*)::int AS correct
        FROM assignments a
        JOIN latest la ON la.assignment_id=a.id AND la.is_correct=true
        GROUP BY a.lesson_id
      ),
      completed_lessons AS (
        SELECT lt.lesson_id, lt.module_id
        FROM lesson_totals lt
        LEFT JOIN lesson_correct lc ON lc.lesson_id=lt.lesson_id
        WHERE lt.total = COALESCE(lc.correct, 0)
      ),
      module_totals AS (
        SELECT module_id, COUNT(*)::int AS total
        FROM lesson_totals
        WHERE module_id IS NOT NULL
        GROUP BY module_id
      ),
      module_completed AS (
        SELECT module_id, COUNT(*)::int AS completed
        FROM completed_lessons
        WHERE module_id IS NOT NULL
        GROUP BY module_id
      )
      SELECT
        COUNT(*) FILTER (WHERE mt.total = COALESCE(mc.completed, 0))::int AS completed,
        COUNT(*)::int AS total
      FROM module_totals mt
      LEFT JOIN module_completed mc ON mc.module_id=mt.module_id`,
      [userId],
    ),
    db.query(
      `WITH latest AS (
        SELECT DISTINCT ON (assignment_id) assignment_id, is_correct
        FROM user_answers
        WHERE user_id=$1
        ORDER BY assignment_id, answered_at DESC
      ),
      lesson_totals AS (
        SELECT l.id AS lesson_id, l.course_id, COUNT(a.id)::int AS total
        FROM lessons l
        JOIN assignments a ON a.lesson_id=l.id
        GROUP BY l.id, l.course_id
      ),
      lesson_correct AS (
        SELECT a.lesson_id, COUNT(*)::int AS correct
        FROM assignments a
        JOIN latest la ON la.assignment_id=a.id AND la.is_correct=true
        GROUP BY a.lesson_id
      ),
      completed_lessons AS (
        SELECT lt.lesson_id, lt.course_id
        FROM lesson_totals lt
        LEFT JOIN lesson_correct lc ON lc.lesson_id=lt.lesson_id
        WHERE lt.total = COALESCE(lc.correct, 0)
      ),
      course_totals AS (
        SELECT course_id, COUNT(*)::int AS total
        FROM lesson_totals
        GROUP BY course_id
      ),
      course_completed AS (
        SELECT course_id, COUNT(*)::int AS completed
        FROM completed_lessons
        GROUP BY course_id
      )
      SELECT
        COUNT(*) FILTER (WHERE ct.total = COALESCE(cc.completed, 0))::int AS completed,
        COUNT(*)::int AS total
      FROM course_totals ct
      LEFT JOIN course_completed cc ON cc.course_id=ct.course_id`,
      [userId],
    ),
  ]);

  const totalWords = totals.totalCommonWords + totalPersonalWords.rows[0].count;

  return {
    learned_words_total: learnedWords.rows[0].count,
    total_words: totalWords,
    repeated_today: repeatedToday.rows[0].count,
    completed_assignments: completedAssignments.rows[0].count,
    total_assignments: totals.totalAssignments,
    completed_lessons: lessonStats.rows[0].completed,
    total_lessons: lessonStats.rows[0].total,
    completed_modules: moduleStats.rows[0].completed,
    total_modules: moduleStats.rows[0].total,
    completed_courses: courseStats.rows[0].completed,
    total_courses: courseStats.rows[0].total,
  };
}

router.get('/stats/my', authRequired, async (req, res, next) => {
  try {
    const totals = await loadTotals();
    const stats = await buildUserStats(req.user.id, totals);
    return res.json(stats);
  } catch (error) {
    return next(error);
  }
});

router.get('/stats/students', authRequired, requireRoles('teacher', 'admin'), async (req, res, next) => {
  try {
    const totals = await loadTotals();
    const students = await db.query(
      'SELECT id, login, email FROM users WHERE role=$1 ORDER BY login',
      ['student'],
    );

    const stats = await Promise.all(
      students.rows.map(async (student) => ({
        user_id: student.id,
        login: student.login,
        email: student.email,
        ...(await buildUserStats(student.id, totals)),
      })),
    );

    return res.json({ students: stats });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

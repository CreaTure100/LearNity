const express = require('express');
const { body, param } = require('express-validator');
const db = require('../config/db');
const { authRequired, requireRoles } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.get('/lessons/:lessonId/assignments', authRequired, [param('lessonId').isUUID()], validate, async (req, res, next) => {
  try {
    const result = await db.query('SELECT id, lesson_id, type, prompt, options, score, created_at, updated_at FROM assignments WHERE lesson_id=$1 ORDER BY created_at', [req.params.lessonId]);
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.post(
  '/lessons/:lessonId/assignments',
  authRequired,
  requireRoles('teacher', 'admin'),
  [
    param('lessonId').isUUID(),
    body('prompt').notEmpty().withMessage('Текст задания обязателен'),
    body('options').isArray({ min: 2 }).withMessage('Нужно минимум 2 варианта'),
    body('correct_option_id').notEmpty().withMessage('Нужен правильный вариант'),
    body('score').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { prompt, options, correct_option_id, score = 1 } = req.body;
      const result = await db.query(
        'INSERT INTO assignments(lesson_id, prompt, options, correct_option_id, score) VALUES($1,$2,$3,$4,$5) RETURNING *',
        [req.params.lessonId, prompt, JSON.stringify(options), correct_option_id, score],
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      return next(error);
    }
  },
);

router.patch(
  '/assignments/:id',
  authRequired,
  requireRoles('teacher', 'admin'),
  [param('id').isUUID()],
  validate,
  async (req, res, next) => {
    try {
      const current = await db.query('SELECT * FROM assignments WHERE id=$1', [req.params.id]);
      if (!current.rowCount) {
        return res.status(404).json({ message: 'Задание не найдено' });
      }
      const merged = { ...current.rows[0], ...req.body };
      const result = await db.query(
        'UPDATE assignments SET prompt=$1, options=$2, correct_option_id=$3, score=$4 WHERE id=$5 RETURNING *',
        [merged.prompt, JSON.stringify(merged.options), merged.correct_option_id, merged.score, req.params.id],
      );
      return res.json(result.rows[0]);
    } catch (error) {
      return next(error);
    }
  },
);

router.delete('/assignments/:id', authRequired, requireRoles('teacher', 'admin'), [param('id').isUUID()], validate, async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM assignments WHERE id=$1', [req.params.id]);
    if (!result.rowCount) {
      return res.status(404).json({ message: 'Задание не найдено' });
    }
    return res.json({ message: 'Задание удалено' });
  } catch (error) {
    return next(error);
  }
});

router.post(
  '/assignments/:id/submit',
  authRequired,
  [param('id').isUUID(), body('selected_option_id').notEmpty().withMessage('Выберите ответ')],
  validate,
  async (req, res, next) => {
    try {
      const assignmentResult = await db.query('SELECT * FROM assignments WHERE id=$1', [req.params.id]);
      if (!assignmentResult.rowCount) {
        return res.status(404).json({ message: 'Задание не найдено' });
      }
      const assignment = assignmentResult.rows[0];
      const isCorrect = assignment.correct_option_id === req.body.selected_option_id;
      const earnedScore = isCorrect ? assignment.score : 0;
      await db.query(
        'INSERT INTO user_answers(user_id, assignment_id, selected_option_id, is_correct, earned_score) VALUES($1,$2,$3,$4,$5)',
        [req.user.id, req.params.id, req.body.selected_option_id, isCorrect, earnedScore],
      );
      return res.json({ is_correct: isCorrect, earned_score: earnedScore, message: isCorrect ? 'Верно!' : 'Неверно' });
    } catch (error) {
      return next(error);
    }
  },
);

module.exports = router;

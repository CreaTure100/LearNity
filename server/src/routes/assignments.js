const express = require('express');
const { body, param } = require('express-validator');
const db = require('../config/db');
const { authRequired, requireRoles } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

const ASSIGNMENT_TYPES = ['single_choice', 'drag_and_drop'];
const MAX_GAPS = 40;

function parseSlotKeys(prompt) {
  if (!prompt) return [];
  const keys = [];
  const re = /{{\s*(\d+)\s*}}/g;
  let match = re.exec(prompt);
  while (match) {
    keys.push(Number(match[1]));
    match = re.exec(prompt);
  }
  return keys;
}

function normalizeOptionIds(value) {
  if (Array.isArray(value)) {
    return value.map((id) => String(id));
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.map((id) => String(id)) : null;
    } catch {
      return null;
    }
  }
  return [trimmed];
}

function validateDragAssignment(prompt, options, correctIds) {
  const slotKeys = parseSlotKeys(prompt);
  const uniqueKeys = [...new Set(slotKeys)];
  const maxKey = uniqueKeys.length ? Math.max(...uniqueKeys) : 0;

  if (uniqueKeys.length === 0) {
    return { ok: false, message: 'В prompt должны быть слоты вида {{1}}' };
  }
  if (uniqueKeys.length > MAX_GAPS) {
    return { ok: false, message: `Максимум ${MAX_GAPS} пропусков` };
  }
  if (uniqueKeys.length !== slotKeys.length) {
    return { ok: false, message: 'Номера слотов должны быть уникальными' };
  }
  if (maxKey !== uniqueKeys.length || !uniqueKeys.every((key) => key >= 1)) {
    return { ok: false, message: 'Слоты должны быть пронумерованы подряд: {{1}}, {{2}}, ...' };
  }

  if (!Array.isArray(options) || options.length < 2) {
    return { ok: false, message: 'Нужно минимум 2 варианта' };
  }

  if (!Array.isArray(correctIds) || correctIds.length !== uniqueKeys.length) {
    return { ok: false, message: 'Ответы должны быть для каждого слота по порядку' };
  }

  const optionIds = new Set(options.map((opt) => String(opt.id)));
  const invalid = correctIds.find((id) => !optionIds.has(String(id)));
  if (invalid) {
    return { ok: false, message: 'Ответы должны ссылаться на существующие варианты' };
  }

  return { ok: true };
}

router.get('/lessons/:lessonId/assignments', authRequired, [param('lessonId').isUUID()], validate, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, lesson_id, type, prompt, options, correct_option_id, score, created_at, updated_at FROM assignments WHERE lesson_id=$1 ORDER BY created_at',
      [req.params.lessonId],
    );
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
    body('type').optional().isIn(ASSIGNMENT_TYPES),
    body('correct_option_id').optional(),
    body('correct_option_ids').optional().isArray({ min: 1 }),
    body('score').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { prompt, options, score = 1 } = req.body;
      const type = req.body.type || 'single_choice';
      let correctOptionId = req.body.correct_option_id;

      if (type === 'drag_and_drop') {
        const correctIds = normalizeOptionIds(req.body.correct_option_ids);
        const validation = validateDragAssignment(prompt, options, correctIds);
        if (!validation.ok) {
          return res.status(400).json({ message: validation.message });
        }
        correctOptionId = JSON.stringify(correctIds);
      } else if (!correctOptionId) {
        return res.status(400).json({ message: 'Нужен правильный вариант' });
      }

      const result = await db.query(
        'INSERT INTO assignments(lesson_id, type, prompt, options, correct_option_id, score) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
        [req.params.lessonId, type, prompt, JSON.stringify(options), correctOptionId, score],
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
  [param('id').isUUID(), body('type').optional().isIn(ASSIGNMENT_TYPES)],
  validate,
  async (req, res, next) => {
    try {
      const current = await db.query('SELECT * FROM assignments WHERE id=$1', [req.params.id]);
      if (!current.rowCount) {
        return res.status(404).json({ message: 'Задание не найдено' });
      }
      const merged = { ...current.rows[0], ...req.body };
      const nextType = merged.type || 'single_choice';
      let correctOptionId = merged.correct_option_id;

      if (nextType === 'drag_and_drop') {
        const bodyIds = normalizeOptionIds(req.body.correct_option_ids);
        const storedIds = normalizeOptionIds(merged.correct_option_id);
        const correctIds = bodyIds || storedIds;
        const validation = validateDragAssignment(merged.prompt, merged.options, correctIds);
        if (!validation.ok) {
          return res.status(400).json({ message: validation.message });
        }
        correctOptionId = JSON.stringify(correctIds);
      } else if (!correctOptionId) {
        return res.status(400).json({ message: 'Нужен правильный вариант' });
      }

      const result = await db.query(
        'UPDATE assignments SET type=$1, prompt=$2, options=$3, correct_option_id=$4, score=$5 WHERE id=$6 RETURNING *',
        [nextType, merged.prompt, JSON.stringify(merged.options), correctOptionId, merged.score, req.params.id],
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
  [
    param('id').isUUID(),
    body('selected_option_id')
      .custom((value) => (Array.isArray(value) ? value.length > 0 : String(value || '').trim() !== ''))
      .withMessage('Выберите ответ'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const assignmentResult = await db.query('SELECT * FROM assignments WHERE id=$1', [req.params.id]);
      if (!assignmentResult.rowCount) {
        return res.status(404).json({ message: 'Задание не найдено' });
      }
      const assignment = assignmentResult.rows[0];
      let isCorrect = false;
      let selectedOptionId = req.body.selected_option_id;

      if (assignment.type === 'drag_and_drop') {
        const selectedIds = normalizeOptionIds(req.body.selected_option_id);
        const correctIds = normalizeOptionIds(assignment.correct_option_id);
        if (!selectedIds || !correctIds) {
          return res.status(400).json({ message: 'Некорректный формат ответа' });
        }
        isCorrect = selectedIds.length === correctIds.length
          && selectedIds.every((id, idx) => String(id) === String(correctIds[idx]));
        selectedOptionId = JSON.stringify(selectedIds);
      } else {
        isCorrect = assignment.correct_option_id === req.body.selected_option_id;
      }

      const earnedScore = isCorrect ? assignment.score : 0;
      await db.query(
        'INSERT INTO user_answers(user_id, assignment_id, selected_option_id, is_correct, earned_score) VALUES($1,$2,$3,$4,$5)',
        [req.user.id, req.params.id, selectedOptionId, isCorrect, earnedScore],
      );
      return res.json({ is_correct: isCorrect, earned_score: earnedScore, message: isCorrect ? 'Верно!' : 'Неверно' });
    } catch (error) {
      return next(error);
    }
  },
);

module.exports = router;

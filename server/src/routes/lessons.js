const express = require('express');
const { body, param } = require('express-validator');
const db = require('../config/db');
const { authRequired, requireRoles } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.get(
  '/modules/:moduleId/lessons',
  authRequired,
  [param('moduleId').isUUID()],
  validate,
  async (req, res, next) => {
    try {
      const result = await db.query(
        'SELECT * FROM lessons WHERE module_id=$1 ORDER BY order_index ASC',
        [req.params.moduleId],
      );
      return res.json(result.rows);
    } catch (e) {
      return next(e);
    }
  },
);

router.post(
  '/modules/:moduleId/lessons',
  authRequired,
  requireRoles('teacher', 'admin'),
  [
    param('moduleId').isUUID(),
    body('title').notEmpty(),
    body('order_index').optional().isInt({ min: 1 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { title, description = null, video_url = null, content = null, ui_variant = null, ui_title = null } = req.body;
      let { order_index } = req.body;

      // Auto-compute order_index if not provided
      if (!order_index) {
        const maxIdx = await db.query(
          'SELECT COALESCE(MAX(order_index), 0) + 1 AS next_idx FROM lessons WHERE module_id=$1',
          [req.params.moduleId],
        );
        order_index = maxIdx.rows[0].next_idx;
      }

      // узнаём course_id модуля, чтобы сохранить совместимость (course_id всё ещё NOT NULL)
      const mod = await db.query('SELECT course_id FROM modules WHERE id=$1', [req.params.moduleId]);
      if (!mod.rowCount) return res.status(404).json({ message: 'Модуль не найден' });

      const courseId = mod.rows[0].course_id;

      const result = await db.query(
        `INSERT INTO lessons(course_id, module_id, title, description, video_url, content, order_index, ui_variant, ui_title)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [courseId, req.params.moduleId, title, description, video_url, content, order_index, ui_variant, ui_title],
      );

      return res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ message: 'Урок с таким порядковым номером уже существует в этом модуле' });
      }
      return next(error);
    }
  },
);
/**
 * GET /api/lessons/:id — single lesson
 */
router.get('/lessons/:id', authRequired, [param('id').isUUID()], validate, async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM lessons WHERE id=$1', [req.params.id]);
    if (!result.rowCount) {
      return res.status(404).json({ message: 'Урок не найден' });
    }
    return res.json(result.rows[0]);
  } catch (e) {
    return next(e);
  }
});

router.patch('/lessons/:id', authRequired, requireRoles('teacher', 'admin'), [param('id').isUUID()], validate, async (req, res, next) => {
  try {
    const current = await db.query('SELECT * FROM lessons WHERE id=$1', [req.params.id]);
    if (!current.rowCount) {
      return res.status(404).json({ message: 'Урок не найден' });
    }
    const merged = { ...current.rows[0], ...req.body };
    const result = await db.query(
      'UPDATE lessons SET title=$1, description=$2, video_url=$3, order_index=$4, content=$5, ui_variant=$6, ui_title=$7 WHERE id=$8 RETURNING *',
      [merged.title, merged.description, merged.video_url, merged.order_index, merged.content || null, merged.ui_variant || null, merged.ui_title || null, req.params.id],
    );
    return res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Урок с таким порядковым номером уже существует в этом курсе' });
    }
    return next(error);
  }
});

router.delete('/lessons/:id', authRequired, requireRoles('teacher', 'admin'), [param('id').isUUID()], validate, async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM lessons WHERE id=$1', [req.params.id]);
    if (!result.rowCount) {
      return res.status(404).json({ message: 'Урок не найден' });
    }
    return res.json({ message: 'Урок удалён' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

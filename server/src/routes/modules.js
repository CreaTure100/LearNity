const express = require('express');
const { body, param } = require('express-validator');
const db = require('../config/db');
const { authRequired, requireRoles } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

/**
 * GET /api/courses/:courseId/modules
 */
router.get(
  '/courses/:courseId/modules',
  authRequired,
  [param('courseId').isUUID()],
  validate,
  async (req, res, next) => {
    try {
      const result = await db.query(
        `SELECT *
         FROM modules
         WHERE course_id=$1
         ORDER BY position ASC, created_at ASC`,
        [req.params.courseId],
      );
      return res.json(result.rows);
    } catch (e) {
      return next(e);
    }
  },
);

/**
 * POST /api/courses/:courseId/modules  (teacher/admin)
 */
router.post(
  '/courses/:courseId/modules',
  authRequired,
  requireRoles('teacher', 'admin'),
  [
    param('courseId').isUUID(),
    body('title').notEmpty().withMessage('Название модуля обязательно'),
    body('position').optional().isInt({ min: 1 }),
    body('ui_variant').optional().isString(),
    body('ui_title').optional().isString(),
    body('description').optional().isString(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { title, description = null, ui_variant = null, ui_title = null } = req.body;
      let { position } = req.body;

      // Auto-compute position if not provided
      if (!position) {
        const maxPos = await db.query(
          'SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM modules WHERE course_id=$1',
          [req.params.courseId],
        );
        position = maxPos.rows[0].next_pos;
      }

      const result = await db.query(
        `INSERT INTO modules(course_id, title, description, position, ui_variant, ui_title)
         VALUES($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [req.params.courseId, title, description, Number(position), ui_variant, ui_title],
      );
      return res.status(201).json(result.rows[0]);
    } catch (e) {
      return next(e);
    }
  },
);

/**
 * PATCH /api/modules/:id (teacher/admin)
 */
router.patch(
  '/modules/:id',
  authRequired,
  requireRoles('teacher', 'admin'),
  [param('id').isUUID()],
  validate,
  async (req, res, next) => {
    try {
      const current = await db.query('SELECT * FROM modules WHERE id=$1', [req.params.id]);
      if (!current.rowCount) return res.status(404).json({ message: 'Модуль не найден' });

      const merged = { ...current.rows[0], ...req.body };
      const updated = await db.query(
        `UPDATE modules
         SET title=$1, description=$2, position=$3, ui_variant=$4, ui_title=$5
         WHERE id=$6
         RETURNING *`,
        [merged.title, merged.description, merged.position, merged.ui_variant, merged.ui_title, req.params.id],
      );

      return res.json(updated.rows[0]);
    } catch (e) {
      return next(e);
    }
  },
);

/**
 * DELETE /api/modules/:id (teacher/admin)
 */
router.delete(
  '/modules/:id',
  authRequired,
  requireRoles('teacher', 'admin'),
  [param('id').isUUID()],
  validate,
  async (req, res, next) => {
    try {
      const result = await db.query('DELETE FROM modules WHERE id=$1', [req.params.id]);
      if (!result.rowCount) return res.status(404).json({ message: 'Модуль не найден' });
      return res.json({ message: 'Модуль удалён' });
    } catch (e) {
      return next(e);
    }
  },
);

module.exports = router;
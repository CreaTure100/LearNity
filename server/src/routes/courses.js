const express = require('express');
const { body, param } = require('express-validator');
const db = require('../config/db');
const { authRequired, requireRoles } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.get('/', authRequired, async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM courses ORDER BY created_at DESC');
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', authRequired, [param('id').isUUID().withMessage('Некорректный id курса')], validate, async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM courses WHERE id=$1', [req.params.id]);
    if (!result.rowCount) {
      return res.status(404).json({ message: 'Курс не найден' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

router.post(
  '/',
  authRequired,
  requireRoles('teacher', 'admin'),
  [body('title').notEmpty().withMessage('Название курса обязательно')],
  validate,
  async (req, res, next) => {
    try {
      const { title, description = null, level = null, cover_image_url = null, is_published = true, ui_variant = null, ui_title = null } = req.body;
      const ownerId = req.user.role === 'teacher' ? req.user.id : req.body.owner_teacher_id || null;
      const result = await db.query(
        'INSERT INTO courses(title, description, level, cover_image_url, owner_teacher_id, is_published, ui_variant, ui_title) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [title, description, level, cover_image_url, ownerId, is_published, ui_variant, ui_title],
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      return next(error);
    }
  },
);

router.patch(
  '/:id',
  authRequired,
  requireRoles('teacher', 'admin'),
  [param('id').isUUID().withMessage('Некорректный id курса')],
  validate,
  async (req, res, next) => {
    try {
      const id = req.params.id;
      const current = await db.query('SELECT * FROM courses WHERE id=$1', [id]);
      if (!current.rowCount) {
        return res.status(404).json({ message: 'Курс не найден' });
      }
      if (req.user.role === 'teacher' && current.rows[0].owner_teacher_id !== req.user.id) {
        return res.status(403).json({ message: 'Можно редактировать только свои курсы' });
      }

      const merged = { ...current.rows[0], ...req.body };
      const updated = await db.query(
        'UPDATE courses SET title=$1, description=$2, level=$3, cover_image_url=$4, is_published=$5, owner_teacher_id=$6, ui_variant=$7, ui_title=$8 WHERE id=$9 RETURNING *',
        [
          merged.title,
          merged.description,
          merged.level,
          merged.cover_image_url,
          merged.is_published,
          merged.owner_teacher_id,
          merged.ui_variant || null,
          merged.ui_title || null,
          id,
        ],
      );
      return res.json(updated.rows[0]);
    } catch (error) {
      return next(error);
    }
  },
);

router.delete('/:id', authRequired, requireRoles('teacher', 'admin'), [param('id').isUUID()], validate, async (req, res, next) => {
  try {
    const course = await db.query('SELECT owner_teacher_id FROM courses WHERE id=$1', [req.params.id]);
    if (!course.rowCount) {
      return res.status(404).json({ message: 'Курс не найден' });
    }
    if (req.user.role === 'teacher' && course.rows[0].owner_teacher_id !== req.user.id) {
      return res.status(403).json({ message: 'Можно удалять только свои курсы' });
    }
    await db.query('DELETE FROM courses WHERE id=$1', [req.params.id]);
    return res.json({ message: 'Курс удалён' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

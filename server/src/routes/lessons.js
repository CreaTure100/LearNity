const express = require('express');
const { body, param } = require('express-validator');
const db = require('../config/db');
const { authRequired, requireRoles } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.get('/courses/:courseId/lessons', authRequired, [param('courseId').isUUID()], validate, async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM lessons WHERE course_id=$1 ORDER BY order_index ASC', [req.params.courseId]);
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.post(
  '/courses/:courseId/lessons',
  authRequired,
  requireRoles('teacher', 'admin'),
  [param('courseId').isUUID(), body('title').notEmpty(), body('order_index').isInt({ min: 1 })],
  validate,
  async (req, res, next) => {
    try {
      const { title, description = null, video_url = null, order_index } = req.body;
      const result = await db.query(
        'INSERT INTO lessons(course_id, title, description, video_url, order_index) VALUES($1,$2,$3,$4,$5) RETURNING *',
        [req.params.courseId, title, description, video_url, order_index],
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ message: 'Урок с таким порядковым номером уже существует в этом курсе' });
      }
      return next(error);
    }
  },
);

router.patch('/lessons/:id', authRequired, requireRoles('teacher', 'admin'), [param('id').isUUID()], validate, async (req, res, next) => {
  try {
    const current = await db.query('SELECT * FROM lessons WHERE id=$1', [req.params.id]);
    if (!current.rowCount) {
      return res.status(404).json({ message: 'Урок не найден' });
    }
    const merged = { ...current.rows[0], ...req.body };
    const result = await db.query(
      'UPDATE lessons SET title=$1, description=$2, video_url=$3, order_index=$4 WHERE id=$5 RETURNING *',
      [merged.title, merged.description, merged.video_url, merged.order_index, req.params.id],
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

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const db = require('../config/db');
const { validate } = require('../middleware/validate');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Некорректный email'),
    body('login').isLength({ min: 3 }).withMessage('Логин должен быть не короче 3 символов'),
    body('password').isLength({ min: 6 }).withMessage('Пароль должен быть не короче 6 символов'),
    body('role').optional().isIn(['student', 'teacher', 'admin']).withMessage('Недопустимая роль'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, login, password, role = 'student' } = req.body;
      const existing = await db.query(
        'SELECT id FROM users WHERE lower(email)=lower($1) OR lower(login)=lower($2)',
        [email, login],
      );
      if (existing.rowCount) {
        return res.status(409).json({ message: 'Пользователь с таким email или login уже существует' });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const created = await db.query(
        'INSERT INTO users(email, login, password_hash, role) VALUES($1,$2,$3,$4) RETURNING id, email, login, role',
        [email, login, passwordHash, role],
      );
      const user = created.rows[0];
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
      return res.status(201).json({ token, user });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  '/login',
  [body('login').notEmpty().withMessage('Введите login или email'), body('password').notEmpty().withMessage('Введите пароль')],
  validate,
  async (req, res, next) => {
    try {
      const { login, password } = req.body;
      const userResult = await db.query(
        'SELECT id, email, login, role, password_hash FROM users WHERE lower(login)=lower($1) OR lower(email)=lower($1)',
        [login],
      );
      if (!userResult.rowCount) {
        return res.status(401).json({ message: 'Неверный логин/email или пароль' });
      }
      const user = userResult.rows[0];
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) {
        return res.status(401).json({ message: 'Неверный логин/email или пароль' });
      }
      const payload = { id: user.id, email: user.email, login: user.login, role: user.role };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
      return res.json({ token, user: payload });
    } catch (error) {
      return next(error);
    }
  },
);

router.get('/me', authRequired, async (req, res, next) => {
  try {
    const result = await db.query('SELECT id, email, login, role FROM users WHERE id=$1', [req.user.id]);
    if (!result.rowCount) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

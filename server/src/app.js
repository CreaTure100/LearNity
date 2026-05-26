const express = require('express');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const path = require('path');
const authRoutes = require('./routes/auth');
const coursesRoutes = require('./routes/courses');
const lessonsRoutes = require('./routes/lessons');
const assignmentsRoutes = require('./routes/assignments');
const dictionaryRoutes = require('./routes/dictionary');
const repetitionRoutes = require('./routes/repetition');
const statsRoutes = require('./routes/stats');
const modulesRoutes = require('./routes/modules');
const decksRoutes = require('./routes/decks');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Слишком много запросов. Попробуйте позже.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Слишком много попыток входа. Попробуйте позже.' },
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin запрещён политикой CORS'));
    },
  }),
);
app.use(express.json());
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);

app.get('/api/health', (req, res) => res.json({ ok: true, message: 'LearNity API работает' }));

app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api', lessonsRoutes);
app.use('/api', assignmentsRoutes);
app.use('/api', dictionaryRoutes);
app.use('/api', repetitionRoutes);
app.use('/api', statsRoutes);
app.use('/api', modulesRoutes);
app.use('/api', decksRoutes);
app.use((req, res) => {
  res.status(404).json({ message: 'Маршрут не найден' });
});
app.use('/videos', express.static(path.join(__dirname, '..', 'public', 'videos')));
app.use((error, req, res, next) => {
  console.error(error);
  const status = error.status || 500;
  const message = status === 500 ? 'Внутренняя ошибка сервера' : error.message;
  res.status(status).json({ message });
});

module.exports = app;

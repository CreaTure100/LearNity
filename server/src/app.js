const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const coursesRoutes = require('./routes/courses');
const lessonsRoutes = require('./routes/lessons');
const assignmentsRoutes = require('./routes/assignments');
const dictionaryRoutes = require('./routes/dictionary');
const repetitionRoutes = require('./routes/repetition');
const statsRoutes = require('./routes/stats');

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
  }),
);
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, message: 'LearNity API работает' }));

app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api', lessonsRoutes);
app.use('/api', assignmentsRoutes);
app.use('/api', dictionaryRoutes);
app.use('/api', repetitionRoutes);
app.use('/api', statsRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Маршрут не найден' });
});

app.use((error, req, res, next) => {
  console.error(error);
  const status = error.status || 500;
  const message = status === 500 ? 'Внутренняя ошибка сервера' : error.message;
  res.status(status).json({ message });
});

module.exports = app;

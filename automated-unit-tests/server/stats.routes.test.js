const request = require('supertest');
const db = require('../../server/src/config/db');
const { createTestApp } = require('./helpers/createTestApp');

jest.mock('../../server/src/config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../../server/src/middleware/auth', () => ({
  authRequired: (req, res, next) => {
    req.user = { id: 'user-1', role: 'teacher' };
    next();
  },
  requireRoles: () => (req, res, next) => next(),
}));

const statsRouter = require('../../server/src/routes/stats');

describe('stats routes', () => {
  const app = createTestApp(statsRouter, '/api');

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('возвращает статистику пользователя', async () => {
    // Описание: /stats/my собирает агрегаты из нескольких запросов.
    db.query
      .mockResolvedValueOnce({ rows: [{ count: 10 }] })
      .mockResolvedValueOnce({ rows: [{ count: 5 }] })
      .mockResolvedValueOnce({ rows: [{ count: 2 }] })
      .mockResolvedValueOnce({ rows: [{ count: 5 }] })
      .mockResolvedValueOnce({ rows: [{ count: 3 }] })
      .mockResolvedValueOnce({ rows: [{ count: 4 }] })
      .mockResolvedValueOnce({ rows: [{ completed: 1, total: 2 }] })
      .mockResolvedValueOnce({ rows: [{ completed: 1, total: 2 }] })
      .mockResolvedValueOnce({ rows: [{ completed: 1, total: 2 }] });

    const res = await request(app).get('/api/stats/my');

    expect(res.statusCode).toBe(200);
    expect(res.body.total_words).toBe(15);
    expect(res.body.completed_lessons).toBe(1);
    expect(res.body.total_assignments).toBe(5);
  });

  it('возвращает статистику учеников', async () => {
    // Описание: /stats/students возвращает массив студентов со статистикой.
    db.query
      .mockResolvedValueOnce({ rows: [{ count: 10 }] })
      .mockResolvedValueOnce({ rows: [{ count: 5 }] })
      .mockResolvedValueOnce({ rows: [{ id: 's1', login: 'stud', email: 's@x.com' }] })
      .mockResolvedValueOnce({ rows: [{ count: 2 }] })
      .mockResolvedValueOnce({ rows: [{ count: 3 }] })
      .mockResolvedValueOnce({ rows: [{ count: 4 }] })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] })
      .mockResolvedValueOnce({ rows: [{ completed: 1, total: 2 }] })
      .mockResolvedValueOnce({ rows: [{ completed: 1, total: 2 }] })
      .mockResolvedValueOnce({ rows: [{ completed: 1, total: 2 }] });

    const res = await request(app).get('/api/stats/students');

    expect(res.statusCode).toBe(200);
    expect(res.body.students).toHaveLength(1);
    expect(res.body.students[0].login).toBe('stud');
  });
});

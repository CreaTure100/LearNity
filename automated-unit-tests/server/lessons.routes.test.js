const request = require('supertest');
const db = require('../../server/src/config/db');
const { createTestApp } = require('./helpers/createTestApp');

jest.mock('../../server/src/config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../../server/src/middleware/auth', () => ({
  authRequired: (req, res, next) => {
    req.user = { id: 'teacher-1', role: 'teacher' };
    next();
  },
  requireRoles: () => (req, res, next) => next(),
}));

const lessonsRouter = require('../../server/src/routes/lessons');

describe('lessons routes', () => {
  const app = createTestApp(lessonsRouter, '/api');

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('возвращает 404 при получении несуществующего урока', async () => {
    // Описание: GET /lessons/:id -> 404 если нет.
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(app).get('/api/lessons/00000000-0000-0000-0000-000000000000');

    expect(res.statusCode).toBe(404);
  });

  it('возвращает 404 если модуль не найден при создании урока', async () => {
    // Описание: POST /modules/:id/lessons -> 404 когда модуль отсутствует.
    db.query
      .mockResolvedValueOnce({ rows: [{ next_idx: 2 }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(app)
      .post('/api/modules/00000000-0000-0000-0000-000000000000/lessons')
      .send({ title: 'Lesson' });

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toMatch('Модуль не найден');
  });

  it('возвращает 409 при конфликте order_index', async () => {
    // Описание: конфликт уникальности -> 409.
    const err = new Error('duplicate');
    err.code = '23505';
    db.query
      .mockResolvedValueOnce({ rows: [{ next_idx: 1 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ course_id: 'c1' }] })
      .mockRejectedValueOnce(err);

    const res = await request(app)
      .post('/api/modules/00000000-0000-0000-0000-000000000000/lessons')
      .send({ title: 'Lesson' });

    expect(res.statusCode).toBe(409);
  });
});

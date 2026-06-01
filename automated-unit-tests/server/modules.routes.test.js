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

const modulesRouter = require('../../server/src/routes/modules');

describe('modules routes', () => {
  const app = createTestApp(modulesRouter, '/api');

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('автоматически вычисляет position при создании', async () => {
    // Описание: если position не передан, берется max+1.
    db.query
      .mockResolvedValueOnce({ rows: [{ next_pos: 3 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'm1', position: 3 }] });

    const res = await request(app)
      .post('/api/courses/00000000-0000-0000-0000-000000000000/modules')
      .send({ title: 'Module' });

    expect(res.statusCode).toBe(201);
    expect(res.body.position).toBe(3);
  });

  it('возвращает 404 при обновлении отсутствующего модуля', async () => {
    // Описание: PATCH /modules/:id -> 404 если нет строки.
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(app)
      .patch('/api/modules/00000000-0000-0000-0000-000000000000')
      .send({ title: 'X' });

    expect(res.statusCode).toBe(404);
  });

  it('возвращает 404 при удалении отсутствующего модуля', async () => {
    // Описание: DELETE /modules/:id -> 404 если нет строки.
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(app)
      .delete('/api/modules/00000000-0000-0000-0000-000000000000');

    expect(res.statusCode).toBe(404);
  });
});

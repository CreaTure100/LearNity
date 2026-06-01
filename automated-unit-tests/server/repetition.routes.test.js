const request = require('supertest');
const db = require('../../server/src/config/db');
const { createTestApp } = require('./helpers/createTestApp');

jest.mock('../../server/src/config/db', () => ({
  query: jest.fn(),
}));

jest.mock('../../server/src/middleware/auth', () => ({
  authRequired: (req, res, next) => {
    req.user = { id: 'user-1', role: 'student' };
    next();
  },
}));

const repetitionRouter = require('../../server/src/routes/repetition');

describe('repetition routes', () => {
  const app = createTestApp(repetitionRouter, '/api');

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('возвращает 404 при отсутствии прогресса', async () => {
    // Описание: /repetition/review -> 404 если записи нет.
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(app)
      .post('/api/repetition/review')
      .send({ progress_id: '00000000-0000-0000-0000-000000000000', quality: 3 });

    expect(res.statusCode).toBe(404);
  });
});

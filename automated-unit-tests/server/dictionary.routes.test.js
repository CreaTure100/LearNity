const request = require('supertest');
const { createTestApp } = require('./helpers/createTestApp');

const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

jest.mock('../../server/src/config/db', () => ({
  query: jest.fn(),
  getClient: jest.fn(() => mockClient),
}));

const db = require('../../server/src/config/db');

jest.mock('../../server/src/middleware/auth', () => ({
  authRequired: (req, res, next) => {
    req.user = { id: 'user-1', role: 'student' };
    next();
  },
  requireRoles: () => (req, res, next) => next(),
}));

const dictionaryRouter = require('../../server/src/routes/dictionary');

describe('dictionary routes', () => {
  const app = createTestApp(dictionaryRouter, '/api');

  afterEach(() => {
    jest.clearAllMocks();
    mockClient.query.mockReset();
  });

  it('возвращает список общих слов', async () => {
    // Описание: GET /common-words -> массив.
    db.query.mockResolvedValueOnce({ rows: [{ id: 'w1', word: 'test' }] });

    const res = await request(app).get('/api/common-words');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ id: 'w1', word: 'test' }]);
  });

  it('возвращает 409 при дубликате общего слова', async () => {
    // Описание: конфликт уникальности -> 409.
    const err = new Error('dup');
    err.code = '23505';
    db.query.mockRejectedValueOnce(err);

    const res = await request(app)
      .post('/api/common-words')
      .send({ word: 'test' });

    expect(res.statusCode).toBe(409);
  });

  it('возвращает 404 если common_word_id не найден', async () => {
    // Описание: при добавлении из общей колоды -> 404, rollback.
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({});

    const res = await request(app)
      .post('/api/personal-words/my')
      .send({ common_word_id: '00000000-0000-0000-0000-000000000000' });

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toMatch('не найдено');
  });

  it('возвращает 400 если нет полей для обновления', async () => {
    // Описание: PATCH без полей -> 400.
    const res = await request(app)
      .patch('/api/personal-words/my/00000000-0000-0000-0000-000000000000')
      .send({});

    expect(res.statusCode).toBe(400);
  });
});

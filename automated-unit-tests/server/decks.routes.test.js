const request = require('supertest');
const { createTestApp } = require('./helpers/createTestApp');

const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

jest.mock('../../server/src/config/db', () => ({
  getClient: jest.fn(() => mockClient),
}));

jest.mock('../../server/src/middleware/auth', () => ({
  authRequired: (req, res, next) => {
    req.user = { id: 'user-1', role: 'student' };
    next();
  },
}));

const decksRouter = require('../../server/src/routes/decks');

describe('decks routes', () => {
  const app = createTestApp(decksRouter, '/api');

  afterEach(() => {
    jest.clearAllMocks();
    mockClient.query.mockReset();
  });

  it('возвращает настройки колоды', async () => {
    // Описание: GET /decks/:deck/settings -> текущие настройки.
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{
          deck: 'common',
          new_per_day: 10,
          learning_steps_minutes: [2, 16],
          graduating_interval_days: 2,
          easy_interval_days: 4,
        }],
      });

    const res = await request(app)
      .get('/api/decks/common/settings');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      deck: 'common',
      new_per_day: 10,
      learning_steps_minutes: [2, 16],
      graduating_interval_days: 2,
      easy_interval_days: 4,
    });
  });

  it('отклоняет некорректные интервалы настроек', async () => {
    // Описание: easy_interval_days меньше graduating -> 400.
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [{
          deck: 'common',
          new_per_day: 10,
          learning_steps_minutes: [2, 16],
          graduating_interval_days: 5,
          easy_interval_days: 7,
        }],
      });

    const res = await request(app)
      .patch('/api/decks/common/settings')
      .send({ easy_interval_days: 3, graduating_interval_days: 5 });

    expect(res.statusCode).toBe(400);
  });

  it('возвращает 404 если карточка не найдена при ответе', async () => {
    // Описание: /decks/:deck/study/answer -> 404 при отсутствии карточки.
    mockClient.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{
        deck: 'common',
        new_per_day: 10,
        learning_steps_minutes: [2, 16],
        graduating_interval_days: 2,
        easy_interval_days: 4,
      }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/decks/common/study/answer')
      .send({ word_id: '00000000-0000-0000-0000-000000000000', rating: 'good' });

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toMatch('Карточка не найдена');
  });
});

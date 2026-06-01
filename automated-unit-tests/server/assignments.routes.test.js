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

const assignmentsRouter = require('../../server/src/routes/assignments');

describe('assignments routes', () => {
  const app = createTestApp(assignmentsRouter, '/api');

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('отклоняет drag_and_drop без слотов', async () => {
    // Описание: prompt без {{1}} -> 400.
    const res = await request(app)
      .post('/api/lessons/00000000-0000-0000-0000-000000000000/assignments')
      .send({
        type: 'drag_and_drop',
        prompt: 'no slots',
        options: [{ id: '0', text: 'A' }, { id: '1', text: 'B' }],
        correct_option_ids: ['0'],
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch('слоты');
  });

  it('создает single_choice при валидном запросе', async () => {
    // Описание: single_choice создается и возвращается.
    db.query.mockResolvedValueOnce({ rows: [{ id: 'a1', type: 'single_choice' }] });

    const res = await request(app)
      .post('/api/lessons/00000000-0000-0000-0000-000000000000/assignments')
      .send({
        prompt: 'Q?',
        options: [{ id: '0', text: 'A' }, { id: '1', text: 'B' }],
        correct_option_id: '0',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.type).toBe('single_choice');
  });

  it('возвращает 404 при отправке ответа на отсутствующее задание', async () => {
    // Описание: submit без задания -> 404.
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(app)
      .post('/api/assignments/00000000-0000-0000-0000-000000000000/submit')
      .send({ selected_option_id: '0' });

    expect(res.statusCode).toBe(404);
  });

  it('сохраняет ответ и возвращает результат', async () => {
    // Описание: корректный ответ -> запись в user_answers и is_correct.
    db.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'a1', type: 'single_choice', correct_option_id: '0', score: 2 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const res = await request(app)
      .post('/api/assignments/00000000-0000-0000-0000-000000000000/submit')
      .send({ selected_option_id: '0' });

    expect(res.statusCode).toBe(200);
    expect(res.body.is_correct).toBe(true);
    expect(res.body.earned_score).toBe(2);
  });
});

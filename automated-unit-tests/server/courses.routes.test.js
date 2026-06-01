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

const coursesRouter = require('../../server/src/routes/courses');

describe('courses routes', () => {
  const app = createTestApp(coursesRouter, '/api/courses');
  const courseId = '00000000-0000-4000-8000-000000000001';

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('возвращает список курсов', async () => {
    // Описание: GET /courses -> массив курсов.
    db.query.mockResolvedValueOnce({ rows: [{ id: 'c1', title: 'Course' }] });

    const res = await request(app).get('/api/courses');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ id: 'c1', title: 'Course' }]);
  });

  it('возвращает 404 для отсутствующего курса', async () => {
    // Описание: GET /courses/:id -> 404 если не найден.
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(app).get('/api/courses/00000000-0000-0000-0000-000000000000');

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toMatch('не найден');
  });

  it('создает курс с владельцем преподавателем', async () => {
    // Описание: при роли teacher owner_teacher_id = req.user.id.
    db.query.mockResolvedValueOnce({ rows: [{ id: 'c1', title: 'Course', owner_teacher_id: 'teacher-1' }] });

    const res = await request(app)
      .post('/api/courses')
      .send({ title: 'Course' });

    expect(res.statusCode).toBe(201);
    expect(res.body.owner_teacher_id).toBe('teacher-1');
    expect(db.query).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO courses/i),
      expect.arrayContaining(['Course', null, null, null, 'teacher-1', true, null, null]),
    );
  });

  it('запрещает обновление чужого курса преподавателю', async () => {
    // Описание: teacher не может править чужой курс -> 403.
    db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'c1', owner_teacher_id: 'other' }] });

    const res = await request(app)
      .patch(`/api/courses/${courseId}`)
      .send({ title: 'New' });

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toMatch('свои курсы');
  });

  it('возвращает 404 при удалении отсутствующего курса', async () => {
    // Описание: DELETE /courses/:id -> 404 если курса нет.
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(app)
      .delete(`/api/courses/${courseId}`);

    expect(res.statusCode).toBe(404);
  });
});

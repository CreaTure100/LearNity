const request = require('supertest');
const db = require('../../server/src/config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createTestApp } = require('./helpers/createTestApp');

jest.mock('../../server/src/config/db', () => ({
  query: jest.fn(),
}));

jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

jest.mock('../../server/src/middleware/auth', () => ({
  authRequired: (req, res, next) => {
    req.user = { id: 'user-1', role: 'student' };
    next();
  },
}));

const authRouter = require('../../server/src/routes/auth');

describe('auth routes', () => {
  const app = createTestApp(authRouter, '/api/auth');

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('отклоняет регистрацию при существующем пользователе', async () => {
    // Описание: конфликт email/login -> 409.
    db.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', login: 'user', password: 'secret123' });

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toMatch('существует');
  });

  it('создает пользователя и возвращает токен', async () => {
    // Описание: успешная регистрация -> 201 + token + user.
    db.query
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'u1', email: 'a@b.com', login: 'user', role: 'student' }] });
    bcrypt.hash.mockResolvedValue('hash');
    jwt.sign.mockReturnValue('token');

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', login: 'user', password: 'secret123' });

    expect(res.statusCode).toBe(201);
    expect(res.body.token).toBe('token');
    expect(res.body.user).toEqual({ id: 'u1', email: 'a@b.com', login: 'user', role: 'student' });
  });

  it('отклоняет вход при неверном логине', async () => {
    // Описание: пользователь не найден -> 401.
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'nope', password: 'secret123' });

    expect(res.statusCode).toBe(401);
  });

  it('отклоняет вход при неверном пароле', async () => {
    // Описание: пароль не совпал -> 401.
    db.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 'u1', email: 'a@b.com', login: 'user', role: 'student', password_hash: 'hash' }],
    });
    bcrypt.compare.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'user', password: 'bad' });

    expect(res.statusCode).toBe(401);
  });

  it('возвращает токен при успешном входе', async () => {
    // Описание: корректные креды -> token + user.
    db.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 'u1', email: 'a@b.com', login: 'user', role: 'student', password_hash: 'hash' }],
    });
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue('token');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'user', password: 'secret123' });

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBe('token');
    expect(res.body.user).toEqual({ id: 'u1', email: 'a@b.com', login: 'user', role: 'student' });
  });

  it('возвращает профиль текущего пользователя', async () => {
    // Описание: /me берет пользователя по req.user.id.
    db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'user-1', email: 'a@b.com', login: 'u', role: 'student' }] });

    const res = await request(app).get('/api/auth/me');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ id: 'user-1', email: 'a@b.com', login: 'u', role: 'student' });
  });
});

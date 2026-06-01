const jwt = require('jsonwebtoken');
const { authRequired, requireRoles } = require('../../server/src/middleware/auth');

describe('auth middleware', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('отклоняет запрос без токена', () => {
    // Описание: без заголовка Authorization возвращаем 401.
    const req = { headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    authRequired(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Требуется авторизация' });
    expect(next).not.toHaveBeenCalled();
  });

  it('отклоняет запрос с некорректным токеном', () => {
    // Описание: неверный токен -> 401.
    jest.spyOn(jwt, 'verify').mockImplementation(() => {
      throw new Error('bad');
    });

    const req = { headers: { authorization: 'Bearer bad' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    authRequired(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Недействительный токен' });
    expect(next).not.toHaveBeenCalled();
  });

  it('пропускает запрос с валидным токеном', () => {
    // Описание: валидный токен -> пользователь в req.user и вызов next.
    const payload = { id: 'u1', role: 'student' };
    jest.spyOn(jwt, 'verify').mockReturnValue(payload);

    const req = { headers: { authorization: 'Bearer ok' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    authRequired(req, res, next);

    expect(req.user).toEqual(payload);
    expect(next).toHaveBeenCalled();
  });

  it('requireRoles запрещает роль вне списка', () => {
    // Описание: роль не входит в список -> 403.
    const req = { user: { role: 'student' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    requireRoles('teacher')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Недостаточно прав' });
    expect(next).not.toHaveBeenCalled();
  });

  it('requireRoles пропускает подходящую роль', () => {
    // Описание: роль входит в список -> next.
    const req = { user: { role: 'teacher' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    requireRoles('teacher', 'admin')(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

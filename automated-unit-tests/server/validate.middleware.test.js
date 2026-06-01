const { validationResult } = require('express-validator');
const { validate } = require('../../server/src/middleware/validate');

jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
}));

describe('validate middleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('возвращает 400 при ошибках валидации', () => {
    // Описание: ошибки преобразуются в поле errors.
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ path: 'email', msg: 'bad email' }],
    });

    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Ошибка валидации',
      errors: [{ field: 'email', message: 'bad email' }],
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('пропускает запрос без ошибок валидации', () => {
    // Описание: пустой результат -> next.
    validationResult.mockReturnValue({
      isEmpty: () => true,
      array: () => [],
    });

    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    validate(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

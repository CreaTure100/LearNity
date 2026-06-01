import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../../client/src/pages/LoginPage.jsx';

const navigateMock = vi.fn();
let loginMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../client/src/context/AuthContext.jsx', () => ({
  useAuth: () => ({ login: loginMock }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    loginMock = vi.fn();
  });

  it('переходит на главную после успешного входа', async () => {
    // Описание: успешный login вызывает navigate('/').
    loginMock.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('Login или Email'), { target: { value: 'user' } });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await screen.findByText('Вход');
    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('показывает ошибку при неудачном входе', async () => {
    // Описание: ошибка login отображается в UI.
    loginMock.mockRejectedValue(new Error('Ошибка входа'));

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('Login или Email'), { target: { value: 'user' } });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByText('Ошибка входа')).toBeInTheDocument();
  });
});

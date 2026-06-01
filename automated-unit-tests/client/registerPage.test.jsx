import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RegisterPage } from '../../client/src/pages/RegisterPage.jsx';

const navigateMock = vi.fn();
let registerMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../client/src/context/AuthContext.jsx', () => ({
  useAuth: () => ({ register: registerMock }),
}));

describe('RegisterPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    registerMock = vi.fn();
  });

  it('переходит на главную после регистрации', async () => {
    // Описание: успешная регистрация вызывает navigate('/').
    registerMock.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('Login'), { target: { value: 'user' } });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    await screen.findByText('Регистрация');
    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('показывает ошибку при неудачной регистрации', async () => {
    // Описание: ошибка регистрации отображается.
    registerMock.mockRejectedValue(new Error('Ошибка регистрации'));

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('Login'), { target: { value: 'user' } });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    expect(await screen.findByText('Ошибка регистрации')).toBeInTheDocument();
  });
});

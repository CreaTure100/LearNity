import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../../client/src/context/AuthContext.jsx';
import { http } from '../../client/src/api/http.js';

vi.mock('../../client/src/api/http.js', () => ({
  http: vi.fn(),
}));

function TestConsumer() {
  const { user, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="user">{user ? user.login : 'none'}</div>
      <button onClick={() => login('user', 'pass')}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    http.mockReset();
  });

  it('логин сохраняет пользователя и токен', async () => {
    // Описание: login сохраняет данные и обновляет контекст.
    http.mockResolvedValue({ token: 't1', user: { id: 'u1', login: 'user' } });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await act(async () => {
      screen.getByText('login').click();
    });

    expect(screen.getByTestId('user').textContent).toBe('user');
    expect(localStorage.getItem('token')).toBe('t1');
  });

  it('logout очищает localStorage', async () => {
    // Описание: logout удаляет токен и пользователя.
    localStorage.setItem('token', 't1');
    localStorage.setItem('user', JSON.stringify({ id: 'u1' }));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await act(async () => {
      screen.getByText('logout').click();
    });

    expect(localStorage.getItem('token')).toBe(null);
    expect(localStorage.getItem('user')).toBe(null);
  });
});

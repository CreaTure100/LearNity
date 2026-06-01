import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../../client/src/components/ProtectedRoute.jsx';

let mockAuth = { isAuthenticated: false, user: null };

vi.mock('../../client/src/context/AuthContext.jsx', () => ({
  useAuth: () => mockAuth,
}));

beforeEach(() => {
  mockAuth = { isAuthenticated: false, user: null };
});

describe('ProtectedRoute', () => {
  it('redirects to login when unauthenticated', () => {
    // Описание: неавторизованный пользователь уходит на /login.
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/"
            element={(
              <ProtectedRoute>
                <div>Private Page</div>
              </ProtectedRoute>
            )}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Login Page')).not.toBeNull();
  });

  it('renders children when authenticated and role matches', () => {
    // Описание: при валидной роли контент отображается.
    mockAuth = { isAuthenticated: true, user: { role: 'student' } };

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={(
              <ProtectedRoute roles={['student']}>
                <div>Private Page</div>
              </ProtectedRoute>
            )}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Private Page')).not.toBeNull();
  });
});

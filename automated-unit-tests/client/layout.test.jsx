import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '../../client/src/components/Layout.jsx';

const logoutMock = vi.fn();

vi.mock('../../client/src/context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { role: 'student' }, logout: logoutMock }),
}));

describe('Layout', () => {
  it('показывает роль и вызывает logout', () => {
    // Описание: отображается роль и срабатывает logout.
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<div>Child</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Роль: student')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Выйти'));
    expect(logoutMock).toHaveBeenCalled();
  });
});

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CoursesPage } from '../../client/src/pages/CoursesPage.jsx';
import { http } from '../../client/src/api/http.js';

vi.mock('../../client/src/api/http.js', () => ({
  http: vi.fn(),
}));

vi.mock('../../client/src/context/AuthContext.jsx', () => ({
  useAuth: () => ({ token: 't1', user: { role: 'teacher' } }),
}));

describe('CoursesPage', () => {
  beforeEach(() => {
    http.mockReset();
  });

  it('загружает и показывает курсы', async () => {
    // Описание: список курсов отображается после загрузки.
    http.mockResolvedValueOnce([{ id: 'c1', title: 'Course 1' }]);

    render(
      <MemoryRouter>
        <CoursesPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Course 1')).toBeInTheDocument();
  });

  it('показывает ошибку при неудачной загрузке', async () => {
    // Описание: ошибка http отображается на странице.
    http.mockRejectedValueOnce(new Error('Ошибка'));

    render(
      <MemoryRouter>
        <CoursesPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Ошибка')).toBeInTheDocument();
  });
});

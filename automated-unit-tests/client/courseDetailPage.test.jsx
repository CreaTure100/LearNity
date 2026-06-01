import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CourseDetailPage } from '../../client/src/pages/CourseDetailPage.jsx';
import { http } from '../../client/src/api/http.js';

vi.mock('../../client/src/api/http.js', () => ({
  http: vi.fn(),
}));

vi.mock('../../client/src/context/AuthContext.jsx', () => ({
  useAuth: () => ({ token: 't1', user: { role: 'student' } }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'course-1' }),
  };
});

describe('CourseDetailPage', () => {
  beforeEach(() => {
    http.mockReset();
  });

  it('показывает модули и уроки курса', async () => {
    // Описание: отображаются модули и список уроков.
    http
      .mockResolvedValueOnce({ id: 'course-1', title: 'Course' })
      .mockResolvedValueOnce([
        { id: 'm1', title: 'Module 1' },
        { id: 'm2', title: 'Module 2' },
      ])
      .mockResolvedValueOnce([{ id: 'l1', title: 'Lesson 1', order_index: 1 }])
      .mockResolvedValueOnce([{ id: 'l2', title: 'Lesson 2', order_index: 1 }]);

    render(
      <MemoryRouter>
        <CourseDetailPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Module 1')).toBeInTheDocument();
    expect(await screen.findByText('Lesson 1')).toBeInTheDocument();
  });
});

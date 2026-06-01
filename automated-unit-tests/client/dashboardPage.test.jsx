import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardPage } from '../../client/src/pages/DashboardPage.jsx';
import { http } from '../../client/src/api/http.js';

vi.mock('../../client/src/api/http.js', () => ({
  http: vi.fn(),
}));

let mockUser = { role: 'student' };

vi.mock('../../client/src/context/AuthContext.jsx', () => ({
  useAuth: () => ({ token: 't1', user: mockUser }),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    http.mockReset();
    mockUser = { role: 'student' };
  });

  it('показывает дашборд студента', async () => {
    // Описание: роль student -> метрики прогресса.
    http.mockResolvedValueOnce({
      learned_words_total: 1,
      total_words: 2,
      completed_assignments: 1,
      total_assignments: 2,
      completed_lessons: 1,
      total_lessons: 2,
      completed_modules: 1,
      total_modules: 2,
      completed_courses: 1,
      total_courses: 2,
      repeated_today: 3,
    });

    render(<DashboardPage />);

    expect(await screen.findByText('Дашборд студента')).toBeInTheDocument();
    expect(await screen.findByText('Выученные слова')).toBeInTheDocument();
  });

  it('показывает дашборд преподавателя', async () => {
    // Описание: роль teacher -> таблица учеников.
    mockUser = { role: 'teacher' };
    http.mockResolvedValueOnce({
      students: [{ user_id: 's1', login: 'stud', email: 's@x.com', learned_words_total: 1, total_words: 2, completed_assignments: 0, total_assignments: 1, completed_lessons: 0, total_lessons: 1, completed_modules: 0, total_modules: 1, completed_courses: 0, total_courses: 1, repeated_today: 0 }],
    });

    render(<DashboardPage />);

    expect(await screen.findByText('Дашборд преподавателя')).toBeInTheDocument();
    expect(await screen.findByText('stud')).toBeInTheDocument();
  });
});

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DictionaryPage } from '../../client/src/pages/DictionaryPage.jsx';
import { http } from '../../client/src/api/http.js';

vi.mock('../../client/src/api/http.js', () => ({
  http: vi.fn(),
}));

let mockUser = { role: 'teacher' };

vi.mock('../../client/src/context/AuthContext.jsx', () => ({
  useAuth: () => ({ token: 't1', user: mockUser }),
}));

describe('DictionaryPage', () => {
  beforeEach(() => {
    http.mockReset();
    mockUser = { role: 'teacher' };
  });

  it('показывает общую колоду для преподавателя', async () => {
    // Описание: teacher видит общий список и форму добавления.
    http.mockResolvedValueOnce([{ id: 'w1', word: 'apple', translation: 'яблоко' }]);

    render(
      <MemoryRouter>
        <DictionaryPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Общая колода')).toBeInTheDocument();
    expect(await screen.findByText('Добавить')).toBeInTheDocument();
  });
});

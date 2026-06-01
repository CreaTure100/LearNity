import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DeckStudyPage } from '../../client/src/pages/DeckStudyPage.jsx';
import { http } from '../../client/src/api/http.js';

vi.mock('../../client/src/api/http.js', () => ({
  http: vi.fn(),
}));

vi.mock('../../client/src/context/AuthContext.jsx', () => ({
  useAuth: () => ({ token: 't1' }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ deck: 'common' }),
  };
});

describe('DeckStudyPage', () => {
  beforeEach(() => {
    http.mockReset();
  });

  it('показывает пустое состояние без карточек', async () => {
    // Описание: если card=null, показывается сообщение об отсутствии карточек.
    http
      .mockResolvedValueOnce({ card: null, next_due_at: null })
      .mockResolvedValueOnce([{ deck: 'common', new: 0, learning: 0, review: 0 }]);

    render(
      <MemoryRouter>
        <DeckStudyPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('На сейчас карточек для изучения нет 🎉')).toBeInTheDocument();
  });
});

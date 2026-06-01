import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LessonPage } from '../../client/src/pages/LessonPage.jsx';
import { http } from '../../client/src/api/http.js';

vi.mock('../../client/src/api/http.js', () => ({
  http: vi.fn(),
}));

vi.mock('../../client/src/context/AuthContext.jsx', () => ({
  useAuth: () => ({ token: 't1', user: { role: 'student', id: 'u1' } }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'course-1', lessonId: 'lesson-1' }),
  };
});

describe('LessonPage', () => {
  beforeEach(() => {
    http.mockReset();
    localStorage.clear();
  });

  it('рендерит YouTube embed для youtu.be', async () => {
    // Описание: короткий YouTube URL превращается в embed iframe.
    http
      .mockResolvedValueOnce({ id: 'lesson-1', title: 'Lesson', video_url: 'https://youtu.be/abc12345' })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: 'course-1', title: 'Course' });

    render(
      <MemoryRouter>
        <LessonPage />
      </MemoryRouter>,
    );

    const iframe = await screen.findByTitle('Lesson video');
    expect(iframe.getAttribute('src')).toBe('https://www.youtube.com/embed/abc12345');
  });

  it('рендерит video для mp4', async () => {
    // Описание: mp4 URL отображается в теге video.
    http
      .mockResolvedValueOnce({ id: 'lesson-1', title: 'Lesson', video_url: 'https://cdn.example.com/video.mp4' })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: 'course-1', title: 'Course' });

    render(
      <MemoryRouter>
        <LessonPage />
      </MemoryRouter>,
    );

    const video = await screen.findByRole('video', { hidden: true }).catch(() => null);
    const videoEl = video || document.querySelector('video');
    expect(videoEl).not.toBeNull();
    expect(videoEl.getAttribute('src')).toBe('https://cdn.example.com/video.mp4');
  });
});

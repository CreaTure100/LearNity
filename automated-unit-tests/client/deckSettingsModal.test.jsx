import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeckSettingsModal } from '../../client/src/components/DeckSettingsModal.jsx';
import { http } from '../../client/src/api/http.js';

vi.mock('../../client/src/api/http.js', () => ({
  http: vi.fn(),
}));

describe('DeckSettingsModal', () => {
  beforeEach(() => {
    http.mockReset();
  });

  it('показывает ошибку при пустых шагах изучения', async () => {
    // Описание: пустые шаги -> ошибка валидации.
    http.mockResolvedValueOnce({
      new_per_day: 10,
      learning_steps_minutes: [2, 16],
      graduating_interval_days: 2,
      easy_interval_days: 4,
    });

    render(
      <DeckSettingsModal
        deck="common"
        token="t1"
        onClose={() => {}}
        onSaved={async () => {}}
      />,
    );

    const stepsInput = await screen.findByLabelText('Шаги изучения (минуты)');
    fireEvent.change(stepsInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText('Укажите хотя бы один шаг изучения в минутах')).toBeInTheDocument();
  });
});

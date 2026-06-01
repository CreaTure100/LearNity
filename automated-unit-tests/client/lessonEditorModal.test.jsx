import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LessonEditorModal } from '../../client/src/components/LessonEditorModal.jsx';

describe('LessonEditorModal', () => {
  it('конвертирует order_index и удаляет пустые поля', () => {
    // Описание: order_index число, пустые поля не отправляются.
    const onSave = vi.fn();

    render(<LessonEditorModal lesson={null} onSave={onSave} onClose={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText('Название урока'), { target: { value: 'Lesson' } });
    fireEvent.change(screen.getByPlaceholderText('Авто'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ order_index: 2 }));
    expect(onSave).toHaveBeenCalledWith(expect.not.objectContaining({ video_url: '' }));
  });
});

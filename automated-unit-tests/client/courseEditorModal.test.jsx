import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CourseEditorModal } from '../../client/src/components/CourseEditorModal.jsx';

describe('CourseEditorModal', () => {
  it('вызывает onSave с данными формы', () => {
    // Описание: submit отправляет заполненную форму.
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(<CourseEditorModal course={null} onSave={onSave} onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText('Название курса'), { target: { value: 'Course' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Course', is_published: true }),
    );
  });

  it('закрывает модалку по клику на оверлей', () => {
    // Описание: клик по overlay вызывает onClose.
    const onSave = vi.fn();
    const onClose = vi.fn();

    const { container } = render(<CourseEditorModal course={null} onSave={onSave} onClose={onClose} />);
    const overlay = container.querySelector('.modal-overlay');

    fireEvent.click(overlay);

    expect(onClose).toHaveBeenCalled();
  });
});

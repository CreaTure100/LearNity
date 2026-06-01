import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModuleEditorModal } from '../../client/src/components/ModuleEditorModal.jsx';

describe('ModuleEditorModal', () => {
  it('конвертирует position в число', () => {
    // Описание: position отправляется как число.
    const onSave = vi.fn();

    render(<ModuleEditorModal module={null} onSave={onSave} onClose={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText('Название модуля'), { target: { value: 'Module' } });
    fireEvent.change(screen.getByPlaceholderText('Авто'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ position: 3 }));
  });

  it('не отправляет пустую position', () => {
    // Описание: пустая position удаляется из payload.
    const onSave = vi.fn();

    render(<ModuleEditorModal module={null} onSave={onSave} onClose={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText('Название модуля'), { target: { value: 'Module' } });
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));

    expect(onSave).toHaveBeenCalledWith(expect.not.objectContaining({ position: '' }));
  });
});

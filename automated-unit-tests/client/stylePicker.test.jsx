import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StylePicker } from '../../client/src/components/StylePicker.jsx';

describe('StylePicker', () => {
  it('вызывает onChange при выборе стиля', () => {
    // Описание: клик по варианту вызывает onChange с value.
    const onChange = vi.fn();

    render(<StylePicker type="lesson" value="sky" onChange={onChange} />);

    fireEvent.click(screen.getByTitle('Лимон'));

    expect(onChange).toHaveBeenCalledWith('lemon');
  });
});

import { useMemo } from 'react';

const PRESETS = {
  course: [
    { value: 'peach',    label: 'Персик',     paper: '#f6c9b6', under: '#b9b2ff' },
    { value: 'lavender', label: 'Сирень',     paper: '#cbc4ef', under: '#f0db88' },
    { value: 'sand',     label: 'Песок',      paper: '#f6dd95', under: '#43b5e8' },
    { value: 'purple',   label: 'Фиолетовый', paper: '#c98ae0', under: '#ff8fb0' },
    { value: 'pink',     label: 'Розовый',    paper: '#ff8db5', under: '#43b5e8' },
    { value: 'green',    label: 'Зелёный',    paper: '#62c16f', under: '#0ea0ff' },
  ],
  module: [
    { value: 'blue',     label: 'Голубой',    paper: '#86c9d6', under: '#b9d06a' },
    { value: 'green',    label: 'Зелёный',    paper: '#c6dc8a', under: '#f6c9b6' },
    { value: 'lavender', label: 'Сирень',     paper: '#cbc4ef', under: '#f0db88' },
    { value: 'sand',     label: 'Песок',      paper: '#f6dd95', under: '#ff9dbf' },
    { value: 'pink',     label: 'Розовый',    paper: '#f5b3c6', under: '#cfc6f1' },
  ],
  lesson: [
    { value: 'sky',      label: 'Небо',       paper: '#a8d8ea', under: '#aa96da' },
    { value: 'mint',     label: 'Мята',       paper: '#a8e6cf', under: '#dcedc1' },
    { value: 'peach',    label: 'Персик',     paper: '#ffd3b6', under: '#ffaaa5' },
    { value: 'lilac',    label: 'Лиловый',    paper: '#d4a5f5', under: '#f0c6ff' },
    { value: 'lemon',    label: 'Лимон',      paper: '#fff5a0', under: '#ffc97e' },
  ],
};

export function StylePicker({ type = 'course', value, onChange }) {
  const options = useMemo(() => PRESETS[type] || PRESETS.course, [type]);

  return (
    <div className="style-picker">
      <label className="style-picker__label">Стиль оформления</label>
      <div className="style-picker__grid">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`style-picker__item ${value === opt.value ? 'style-picker__item--active' : ''}`}
            onClick={() => onChange(opt.value)}
            title={opt.label}
          >
            <span
              className="style-picker__swatch"
              style={{
                background: opt.paper,
                boxShadow: `4px 4px 0 ${opt.under}`,
              }}
            />
            <span className="style-picker__name">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

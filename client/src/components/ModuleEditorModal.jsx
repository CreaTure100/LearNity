import { useState } from 'react';
import { StylePicker } from './StylePicker';

function getInitialForm(module) {
  return {
    title: module?.title || '',
    description: module?.description || '',
    position: module?.position || '',
    ui_variant: module?.ui_variant || 'lavender',
    ui_title: module?.ui_title || '',
  };
}

export function ModuleEditorModal({ module, onSave, onClose }) {
  const [form, setForm] = useState(() => getInitialForm(module));

  const set = (field) => (e) => setForm((s) => ({ ...s, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };
    if (data.position) {
      data.position = Number(data.position);
    } else {
      // Server will auto-compute
      delete data.position;
    }
    if (!data.description) data.description = null;
    onSave(data);
  };

  const isNew = !module;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isNew ? 'Создать модуль' : 'Настроить модуль'}</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Название</label>
            <input value={form.title} onChange={set('title')} required placeholder="Название модуля" />
          </div>

          <div className="form-group">
            <label>Описание</label>
            <textarea value={form.description} onChange={set('description')} placeholder="Описание модуля" rows={3} />
          </div>

          <div className="form-group">
            <label>Позиция</label>
            <input
              type="number"
              min="1"
              value={form.position}
              onChange={set('position')}
              placeholder={isNew ? 'Авто' : ''}
            />
            {isNew && <span className="form-hint">Оставьте пустым — будет определена автоматически</span>}
          </div>

          <div className="form-group">
            <label>Кастомный заголовок на карточке</label>
            <input value={form.ui_title} onChange={set('ui_title')} placeholder="Оставьте пустым для авто" />
          </div>

          <StylePicker type="module" value={form.ui_variant} onChange={(v) => setForm((s) => ({ ...s, ui_variant: v }))} />

          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>Отмена</button>
            <button type="submit">{isNew ? 'Создать' : 'Сохранить'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

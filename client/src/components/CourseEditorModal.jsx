import { useState, useEffect } from 'react';
import { StylePicker } from './StylePicker';

export function CourseEditorModal({ course, onSave, onClose }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    level: '',
    cover_image_url: '',
    is_published: true,
    ui_variant: 'peach',
    ui_title: '',
  });

  useEffect(() => {
    if (course) {
      setForm({
        title: course.title || '',
        description: course.description || '',
        level: course.level || '',
        cover_image_url: course.cover_image_url || '',
        is_published: course.is_published !== false,
        ui_variant: course.ui_variant || 'peach',
        ui_title: course.ui_title || '',
      });
    }
  }, [course]);

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((s) => ({ ...s, [field]: val }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const isNew = !course;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isNew ? 'Создать курс' : 'Настроить курс'}</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Название</label>
            <input value={form.title} onChange={set('title')} required placeholder="Название курса" />
          </div>

          <div className="form-group">
            <label>Описание</label>
            <textarea value={form.description} onChange={set('description')} placeholder="Описание курса" rows={3} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Уровень</label>
              <select value={form.level} onChange={set('level')}>
                <option value="">Не указан</option>
                <option value="A1">A1</option>
                <option value="A2">A2</option>
                <option value="B1">B1</option>
                <option value="B2">B2</option>
                <option value="C1">C1</option>
                <option value="C2">C2</option>
              </select>
            </div>
            <div className="form-group">
              <label>Обложка (URL)</label>
              <input value={form.cover_image_url} onChange={set('cover_image_url')} placeholder="https://..." />
            </div>
          </div>

          <div className="form-group">
            <label>Кастомный заголовок на карточке</label>
            <input value={form.ui_title} onChange={set('ui_title')} placeholder="Оставьте пустым для авто" />
          </div>

          <StylePicker type="course" value={form.ui_variant} onChange={(v) => setForm((s) => ({ ...s, ui_variant: v }))} />

          <div className="form-group form-check">
            <label>
              <input type="checkbox" checked={form.is_published} onChange={set('is_published')} />
              <span>Опубликован</span>
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>Отмена</button>
            <button type="submit">{isNew ? 'Создать' : 'Сохранить'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

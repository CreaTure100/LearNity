import { useState } from 'react';
import { StylePicker } from './StylePicker';

function getInitialForm(lesson) {
  return {
    title: lesson?.title || '',
    description: lesson?.description || '',
    video_url: lesson?.video_url || '',
    content: lesson?.content || '',
    order_index: lesson?.order_index || '',
    ui_variant: lesson?.ui_variant || 'sky',
    ui_title: lesson?.ui_title || '',
  };
}

export function LessonEditorModal({ lesson, onSave, onClose }) {
  const [form, setForm] = useState(() => getInitialForm(lesson));

  const set = (field) => (e) => setForm((s) => ({ ...s, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };
    // Send order_index as number or omit it for auto-computation
    if (data.order_index) {
      data.order_index = Number(data.order_index);
    } else {
      delete data.order_index;
    }
    // Don't send empty strings for optional fields
    if (!data.content) delete data.content;
    if (!data.video_url) delete data.video_url;
    if (!data.description) data.description = null;
    onSave(data);
  };

  const isNew = !lesson;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isNew ? 'Создать урок' : 'Настроить урок'}</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Название</label>
            <input value={form.title} onChange={set('title')} required placeholder="Название урока" />
          </div>

          <div className="form-group">
            <label>Описание</label>
            <textarea value={form.description} onChange={set('description')} placeholder="Краткое описание урока" rows={2} />
          </div>

          <div className="form-group">
            <label>Содержание урока</label>
            <textarea
              value={form.content}
              onChange={set('content')}
              placeholder="Текстовое содержание урока, теория, материалы..."
              rows={6}
              className="lesson-content-textarea"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Порядок</label>
              <input
                type="number"
                min="1"
                value={form.order_index}
                onChange={set('order_index')}
                placeholder={isNew ? 'Авто' : ''}
              />
              {isNew && <span className="form-hint">Оставьте пустым — будет определён автоматически</span>}
            </div>
            <div className="form-group">
              <label>Ссылка на видео</label>
              <input value={form.video_url} onChange={set('video_url')} placeholder="https://..." />
            </div>
          </div>

          <div className="form-group">
            <label>Кастомный заголовок на карточке</label>
            <input value={form.ui_title} onChange={set('ui_title')} placeholder="Оставьте пустым для авто" />
          </div>

          <StylePicker type="lesson" value={form.ui_variant} onChange={(v) => setForm((s) => ({ ...s, ui_variant: v }))} />

          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>Отмена</button>
            <button type="submit">{isNew ? 'Создать' : 'Сохранить'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

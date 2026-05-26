import { useEffect, useState } from 'react';
import { http } from '../api/http';

export function DeckSettingsModal({ token, deck, onClose, onSaved }) {
  const [form, setForm] = useState({
    new_per_day: 20,
    learning_steps_minutes: '2 16',
    graduating_interval_days: 1,
    easy_interval_days: 4,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await http(`/decks/${deck}/settings`, { token });
        if (!cancelled) {
          setForm({
            new_per_day: settings.new_per_day,
            learning_steps_minutes: (settings.learning_steps_minutes || [2, 16]).join(' '),
            graduating_interval_days: settings.graduating_interval_days,
            easy_interval_days: settings.easy_interval_days,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deck, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const learning_steps_minutes = form.learning_steps_minutes
        .trim()
        .split(/\s+/)
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n > 0);

      if (learning_steps_minutes.length === 0) {
        throw new Error('Шаги изучения должны быть положительными числами');
      }

      await http(`/decks/${deck}/settings`, {
        method: 'PATCH',
        token,
        body: {
          new_per_day: Number(form.new_per_day),
          learning_steps_minutes,
          graduating_interval_days: Number(form.graduating_interval_days),
          easy_interval_days: Number(form.easy_interval_days),
        },
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deckTitle = deck === 'common' ? 'Общая колода' : 'Личная колода';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Настройки: {deckTitle}</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="modal-form">
            <p>Загрузка...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-form">
            {error && <p className="error">{error}</p>}

            <div className="form-group">
              <label>Новых слов в день</label>
              <input
                type="number"
                min={1}
                value={form.new_per_day}
                onChange={(e) => setForm((s) => ({ ...s, new_per_day: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label>Шаги изучения (минуты)</label>
              <input
                value={form.learning_steps_minutes}
                onChange={(e) => setForm((s) => ({ ...s, learning_steps_minutes: e.target.value }))}
                placeholder="2 16"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Интервал выпуска (дни)</label>
                <input
                  type="number"
                  min={1}
                  value={form.graduating_interval_days}
                  onChange={(e) => setForm((s) => ({ ...s, graduating_interval_days: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Интервал Easy (дни)</label>
                <input
                  type="number"
                  min={1}
                  value={form.easy_interval_days}
                  onChange={(e) => setForm((s) => ({ ...s, easy_interval_days: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary" onClick={onClose}>Отмена</button>
              <button type="submit" disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

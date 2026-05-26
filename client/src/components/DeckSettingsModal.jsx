import { useEffect, useState } from 'react';
import { http } from '../api/http';

const TITLES = {
  common: 'Настройки Common deck',
  personal: 'Настройки Personal deck',
};

function normalizeStepsInput(value) {
  return value
    .split(/[\s,]+/)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
}

export function DeckSettingsModal({ deck, token, onClose, onSaved }) {
  const [form, setForm] = useState({
    new_per_day: 20,
    learning_steps_minutes: '2 16',
    graduating_interval_days: 1,
    easy_interval_days: 4,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const settings = await http(`/decks/${deck}/settings`, { token });
        if (!cancelled) {
          setForm({
            new_per_day: settings.new_per_day,
            learning_steps_minutes: settings.learning_steps_minutes.join(' '),
            graduating_interval_days: settings.graduating_interval_days,
            easy_interval_days: settings.easy_interval_days,
          });
          setError('');
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

  const submit = async (e) => {
    e.preventDefault();
    const parsedSteps = normalizeStepsInput(form.learning_steps_minutes);
    if (parsedSteps.length === 0) {
      setError('Укажите хотя бы один шаг изучения в минутах');
      return;
    }

    try {
      setSaving(true);
      await http(`/decks/${deck}/settings`, {
        method: 'PATCH',
        token,
        body: {
          new_per_day: Number(form.new_per_day),
          learning_steps_minutes: parsedSteps,
          graduating_interval_days: Number(form.graduating_interval_days),
          easy_interval_days: Number(form.easy_interval_days),
        },
      });
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{TITLES[deck]}</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="modal-form">
            <p>Загрузка...</p>
          </div>
        ) : (
          <form className="modal-form" onSubmit={submit}>
            {error && <p className="error">{error}</p>}

            <div className="form-group">
              <label htmlFor="new_per_day">Новых карточек в день</label>
              <input
                id="new_per_day"
                type="number"
                min="0"
                value={form.new_per_day}
                onChange={(e) => setForm((s) => ({ ...s, new_per_day: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="learning_steps_minutes">Шаги изучения (минуты)</label>
              <input
                id="learning_steps_minutes"
                value={form.learning_steps_minutes}
                onChange={(e) => setForm((s) => ({ ...s, learning_steps_minutes: e.target.value }))}
                placeholder="2 16"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="graduating_interval_days">Интервал graduation (дни)</label>
                <input
                  id="graduating_interval_days"
                  type="number"
                  min="1"
                  value={form.graduating_interval_days}
                  onChange={(e) => setForm((s) => ({ ...s, graduating_interval_days: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="easy_interval_days">Интервал easy (дни)</label>
                <input
                  id="easy_interval_days"
                  type="number"
                  min="1"
                  value={form.easy_interval_days}
                  onChange={(e) => setForm((s) => ({ ...s, easy_interval_days: e.target.value }))}
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

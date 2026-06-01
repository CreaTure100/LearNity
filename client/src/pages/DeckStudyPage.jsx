import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';

const TITLES = {
  common: 'Изучение Common deck',
  personal: 'Изучение Personal deck',
};

export function DeckStudyPage() {
  const { deck } = useParams();
  const { token } = useAuth();
  const [card, setCard] = useState(null);
  const [nextDueAt, setNextDueAt] = useState(null);
  const [summary, setSummary] = useState({ deck: deck || null, new: 0, learning: 0, review: 0 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [answering, setAnswering] = useState(false);

  const actionLabel = (title, key) => {
    const delay = card?.answer_delays?.[key]?.label;
    return delay ? `${title} (${delay})` : title;
  };

  const normalizeSummary = (items) => {
    const fallback = { deck: deck || null, new: 0, learning: 0, review: 0 };
    if (!Array.isArray(items)) {
      return fallback;
    }
    return items.find((item) => item.deck === deck) || fallback;
  };

  const loadNext = async () => {
    setLoading(true);
    try {
      const [cardResult, summaryResult] = await Promise.allSettled([
        http(`/decks/${deck}/study/next`, { method: 'POST', token }),
        http('/decks/summary', { token }),
      ]);

      if (cardResult.status === 'rejected') {
        throw cardResult.reason;
      }

      const data = cardResult.value;
      setCard(data.card);
      setNextDueAt(data.next_due_at || null);
      if (summaryResult.status === 'fulfilled') {
        setSummary(normalizeSummary(summaryResult.value));
      }
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, token]);

  useEffect(() => {
    setSummary({ deck: deck || null, new: 0, learning: 0, review: 0 });
  }, [deck]);

  const onAnswer = async (rating) => {
    if (!card) {
      return;
    }
    setAnswering(true);
    try {
      const [cardResult, summaryResult] = await Promise.allSettled([
        http(`/decks/${deck}/study/answer`, {
          method: 'POST',
          token,
          body: {
            word_id: card.word_id,
            rating,
          },
        }),
        http('/decks/summary', { token }),
      ]);

      if (cardResult.status === 'rejected') {
        throw cardResult.reason;
      }

      const data = cardResult.value;
      setCard(data.card);
      setNextDueAt(data.next_due_at || null);
      if (summaryResult.status === 'fulfilled') {
        setSummary(normalizeSummary(summaryResult.value));
      }
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setAnswering(false);
    }
  };

  useEffect(() => {
    if (card || !nextDueAt) {
      return undefined;
    }
    const nextTime = new Date(nextDueAt);
    const diffMs = nextTime.getTime() - Date.now();
    if (Number.isNaN(nextTime.getTime()) || diffMs <= 0) {
      return undefined;
    }
    if (diffMs > 24 * 60 * 60 * 1000) {
      return undefined;
    }
    const timeoutId = setTimeout(() => {
      loadNext();
    }, diffMs + 250);
    return () => clearTimeout(timeoutId);
  }, [card, nextDueAt]);

  const formatNextDue = () => {
    if (!nextDueAt) {
      return null;
    }
    const diffMs = new Date(nextDueAt).getTime() - Date.now();
    if (Number.isNaN(diffMs) || diffMs <= 0) {
      return null;
    }
    const dayMs = 24 * 60 * 60 * 1000;
    if (diffMs >= dayMs) {
      const days = Math.max(1, Math.round(diffMs / dayMs));
      return `${days} д`;
    }
    const minutes = Math.max(1, Math.round(diffMs / (60 * 1000)));
    return `${minutes} мин`;
  };

  return (
    <div>
      <div className="inline-actions">
        <h2>{TITLES[deck] || 'Изучение колоды'}</h2>
        <Link to="/dictionary" className="secondary inline-link-btn">← Назад к словарю</Link>
      </div>

      <section className="card">
        <h3>Осталось сегодня</h3>
        <div className="deck-metrics">
          <p><span>Новые</span><strong>{summary.new}</strong></p>
          <p><span>Изучаемые</span><strong>{summary.learning}</strong></p>
          <p><span>Повторяемые</span><strong>{summary.review}</strong></p>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <section className="card">
          <p>Загрузка карточек...</p>
        </section>
      ) : !card ? (
        <section className="card">
          <p>На сейчас карточек для изучения нет 🎉</p>
          {nextDueAt && <p className="muted">Следующая карточка через {formatNextDue()}</p>}
          <button onClick={loadNext}>Проверить снова</button>
        </section>
      ) : (
        <section className="study-card-wrap">
          <article className="study-card">
            <p className="study-state">Состояние: {card.state}</p>
            <h3>{card.word}</h3>
            {card.transcription && <p className="study-transcription">{card.transcription}</p>}
            {card.translation && <p className="study-translation">{card.translation}</p>}
            {card.definition && <p className="study-definition">{card.definition}</p>}
            {card.example && <p className="study-example">{card.example}</p>}
          </article>

          <div className="study-actions">
            <button className="danger" onClick={() => onAnswer('again')} disabled={answering}>
              {actionLabel('Снова', 'again')}
            </button>
            <button className="secondary" onClick={() => onAnswer('hard')} disabled={answering}>
              {actionLabel('Трудно', 'hard')}
            </button>
            <button onClick={() => onAnswer('good')} disabled={answering}>
              {actionLabel('Хорошо', 'good')}
            </button>
            <button className="study-easy" onClick={() => onAnswer('easy')} disabled={answering}>
              {actionLabel('Легко', 'easy')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

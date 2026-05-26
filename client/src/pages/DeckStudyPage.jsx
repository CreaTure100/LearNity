import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';

const ALLOWED_DECKS = ['common', 'personal'];

export function DeckStudyPage() {
  const { deck } = useParams();
  const { token } = useAuth();
  const [card, setCard] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [answering, setAnswering] = useState(false);

  const deckName = deck === 'common' ? 'Общая колода' : 'Личная колода';

  const loadNext = async () => {
    try {
      const data = await http(`/decks/${deck}/study/next`, { method: 'POST', token });
      setCard(data.card || null);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ALLOWED_DECKS.includes(deck)) {
      setLoading(false);
      setError('Неизвестная колода');
      return;
    }
    setLoading(true);
    loadNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, token]);

  const onAnswer = async (answer) => {
    if (!card?.progress_id) {
      return;
    }
    setAnswering(true);
    setError('');
    try {
      const data = await http(`/decks/${deck}/study/answer`, {
        method: 'POST',
        token,
        body: { progress_id: card.progress_id, answer },
      });
      setCard(data.card || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setAnswering(false);
    }
  };

  if (!ALLOWED_DECKS.includes(deck)) {
    return (
      <div>
        <h2>Учить колоду</h2>
        <p className="error">{error || 'Неизвестная колода'}</p>
        <Link to="/dictionary">← Назад к словарю</Link>
      </div>
    );
  }

  return (
    <div className="deck-study-page">
      <div className="deck-study-header">
        <h2>Учить: {deckName}</h2>
        <Link to="/dictionary" className="secondary-link">← К колодам</Link>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p>Загрузка...</p>}

      {!loading && !card && (
        <section className="study-card">
          <p className="muted">Карточек для изучения сейчас нет 🎉</p>
          <button onClick={loadNext}>Проверить ещё раз</button>
        </section>
      )}

      {!loading && card && (
        <section className="study-card">
          <div className="study-card-inner">
            <p className="study-label">{card.source_type === 'common' ? 'Общая' : 'Личная'} • {card.state}</p>
            <h3>{card.word}</h3>
            <p className="study-translation">{card.translation || '—'}</p>
            {card.transcription && <p className="study-meta">{card.transcription}</p>}
            {card.example && <p className="study-meta">{card.example}</p>}
          </div>
          <div className="study-answer-buttons">
            <button className="danger" disabled={answering} onClick={() => onAnswer('again')}>Снова</button>
            <button className="secondary" disabled={answering} onClick={() => onAnswer('hard')}>Трудно</button>
            <button disabled={answering} onClick={() => onAnswer('good')}>Хорошо</button>
            <button className="study-easy-btn" disabled={answering} onClick={() => onAnswer('easy')}>Легко</button>
          </div>
        </section>
      )}
    </div>
  );
}

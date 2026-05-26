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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [answering, setAnswering] = useState(false);

  const loadNext = async () => {
    setLoading(true);
    try {
      const data = await http(`/decks/${deck}/study/next`, { method: 'POST', token });
      setCard(data.card);
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

  const onAnswer = async (rating) => {
    if (!card) {
      return;
    }
    setAnswering(true);
    try {
      const data = await http(`/decks/${deck}/study/answer`, {
        method: 'POST',
        token,
        body: {
          word_id: card.word_id,
          rating,
        },
      });
      setCard(data.card);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setAnswering(false);
    }
  };

  return (
    <div>
      <div className="inline-actions">
        <h2>{TITLES[deck] || 'Изучение колоды'}</h2>
        <Link to="/dictionary" className="secondary inline-link-btn">← Назад к словарю</Link>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <section className="card">
          <p>Загрузка карточек...</p>
        </section>
      ) : !card ? (
        <section className="card">
          <p>На сейчас карточек для изучения нет 🎉</p>
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
            <button className="danger" onClick={() => onAnswer('again')} disabled={answering}>Снова</button>
            <button className="secondary" onClick={() => onAnswer('hard')} disabled={answering}>Трудно</button>
            <button onClick={() => onAnswer('good')} disabled={answering}>Хорошо</button>
            <button className="study-easy" onClick={() => onAnswer('easy')} disabled={answering}>Легко</button>
          </div>
        </section>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';

export function DashboardPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [todayWords, setTodayWords] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [statsData, wordsData] = await Promise.all([
        http('/stats/my', { token }),
        http('/repetition/today', { token }),
      ]);
      setStats(statsData);
      setTodayWords(wordsData);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [statsData, wordsData] = await Promise.all([
          http('/stats/my', { token }),
          http('/repetition/today', { token }),
        ]);
        if (!cancelled) {
          setStats(statsData);
          setTodayWords(wordsData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const onReview = async (progress_id, quality) => {
    await http('/repetition/review', { method: 'POST', token, body: { progress_id, quality } });
    await load();
  };

  return (
    <div>
      <h2>Дашборд студента</h2>
      {error && <p className="error">{error}</p>}
      {stats && (
        <section className="stats-grid">
          <article className="card"><h3>Личных слов</h3><strong>{stats.personal_words_total}</strong></article>
          <article className="card"><h3>Общих в повторении</h3><strong>{stats.common_in_repetition_total}</strong></article>
          <article className="card"><h3>Повторено сегодня</h3><strong>{stats.repeated_today}</strong></article>
          <article className="card"><h3>Прогресс уроков</h3><strong>{stats.lessons_progress_percent}%</strong></article>
        </section>
      )}

      <section className="card">
        <h3>Слова на сегодня</h3>
        {todayWords.length === 0 && <p>Сегодня слов для повторения нет 🎉</p>}
        {todayWords.map((item) => (
          <div key={item.id} className="word-row">
            <div>
              <strong>{item.word}</strong>
              <p>{item.translation || '—'}</p>
            </div>
            <div className="inline-actions">
              <button onClick={() => onReview(item.id, 5)}>Легко</button>
              <button className="secondary" onClick={() => onReview(item.id, 3)}>Нормально</button>
              <button className="danger" onClick={() => onReview(item.id, 1)}>Трудно</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

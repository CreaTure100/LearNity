import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';
import { DeckSettingsModal } from '../components/DeckSettingsModal';

function EmptyDeckSummary(deck) {
  return { deck, new: 0, learning: 0, review: 0 };
}

export function DictionaryPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const canManageCommon = user?.role === 'teacher' || user?.role === 'admin';

  const [summary, setSummary] = useState({
    common: EmptyDeckSummary('common'),
    personal: EmptyDeckSummary('personal'),
  });
  const [error, setError] = useState('');
  const [settingsDeck, setSettingsDeck] = useState('');

  const [commonWords, setCommonWords] = useState([]);
  const [personalWords, setPersonalWords] = useState([]);
  const [commonForm, setCommonForm] = useState({ word: '', translation: '' });
  const [personalForm, setPersonalForm] = useState({ word: '', translation: '', transcription: '', example: '', definition: '' });

  const loadSummary = async () => {
    try {
      const data = await http('/decks/summary', { token });
      const map = {
        common: EmptyDeckSummary('common'),
        personal: EmptyDeckSummary('personal'),
      };
      data.forEach((item) => {
        map[item.deck] = item;
      });
      setSummary(map);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadWords = async () => {
    try {
      const [common, personal] = await Promise.all([
        http('/common-words', { token }),
        http('/personal-words/my', { token }),
      ]);
      setCommonWords(common);
      setPersonalWords(personal);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    setError('');
    loadSummary();
    loadWords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const addCommon = async (e) => {
    e.preventDefault();
    await http('/common-words', { method: 'POST', token, body: commonForm });
    setCommonForm({ word: '', translation: '' });
    await Promise.all([loadWords(), loadSummary()]);
  };

  const addManualPersonal = async (e) => {
    e.preventDefault();
    await http('/personal-words/my', { method: 'POST', token, body: personalForm });
    setPersonalForm({ word: '', translation: '', transcription: '', example: '', definition: '' });
    await Promise.all([loadWords(), loadSummary()]);
  };

  const addFromCommon = async (common_word_id) => {
    await http('/personal-words/my', { method: 'POST', token, body: { common_word_id } });
    await Promise.all([loadWords(), loadSummary()]);
  };

  const deletePersonal = async (id) => {
    await http(`/personal-words/my/${id}`, { method: 'DELETE', token });
    await Promise.all([loadWords(), loadSummary()]);
  };

  const deleteCommon = async (id) => {
    await http(`/common-words/${id}`, { method: 'DELETE', token });
    await Promise.all([loadWords(), loadSummary()]);
  };

  const openStudy = (deck) => {
    navigate(`/dictionary/decks/${deck}/study`);
  };

  return (
    <div>
      <h2>Словарь</h2>
      {error && <p className="error">{error}</p>}

      <section className="deck-grid">
        <article className="deck-card">
          <h3>Общая колода</h3>
          <div className="deck-counters">
            <p><span>Новые</span><strong>{summary.common.new}</strong></p>
            <p><span>Изучаемые</span><strong>{summary.common.learning}</strong></p>
            <p><span>Повторяемые</span><strong>{summary.common.review}</strong></p>
          </div>
          <div className="inline-actions">
            <button onClick={() => openStudy('common')}>Учить</button>
            <button className="secondary" onClick={() => setSettingsDeck('common')}>Настройки</button>
          </div>
        </article>

        <article className="deck-card">
          <h3>Личная колода</h3>
          <div className="deck-counters">
            <p><span>Новые</span><strong>{summary.personal.new}</strong></p>
            <p><span>Изучаемые</span><strong>{summary.personal.learning}</strong></p>
            <p><span>Повторяемые</span><strong>{summary.personal.review}</strong></p>
          </div>
          <div className="inline-actions">
            <button onClick={() => openStudy('personal')}>Учить</button>
            <button className="secondary" onClick={() => setSettingsDeck('personal')}>Настройки</button>
          </div>
        </article>
      </section>

      <details className="card">
        <summary>Управление словами (дополнительно)</summary>

        <section className="card">
          <h3>Добавить слово в личную колоду вручную</h3>
          <form onSubmit={addManualPersonal} className="grid-form">
            <input placeholder="Слово" value={personalForm.word} onChange={(e) => setPersonalForm((s) => ({ ...s, word: e.target.value }))} required />
            <input placeholder="Перевод" value={personalForm.translation} onChange={(e) => setPersonalForm((s) => ({ ...s, translation: e.target.value }))} />
            <input placeholder="Транскрипция" value={personalForm.transcription} onChange={(e) => setPersonalForm((s) => ({ ...s, transcription: e.target.value }))} />
            <input placeholder="Пример" value={personalForm.example} onChange={(e) => setPersonalForm((s) => ({ ...s, example: e.target.value }))} />
            <input placeholder="Определение" value={personalForm.definition} onChange={(e) => setPersonalForm((s) => ({ ...s, definition: e.target.value }))} />
            <button type="submit">Добавить в личную колоду</button>
          </form>
        </section>

        {canManageCommon && (
          <section className="card">
            <h3>CRUD общей колоды (teacher/admin)</h3>
            <form onSubmit={addCommon} className="inline-actions">
              <input placeholder="Слово" value={commonForm.word} onChange={(e) => setCommonForm((s) => ({ ...s, word: e.target.value }))} required />
              <input placeholder="Перевод" value={commonForm.translation} onChange={(e) => setCommonForm((s) => ({ ...s, translation: e.target.value }))} />
              <button type="submit">Добавить</button>
            </form>
          </section>
        )}

        <section className="card">
          <h3>Общая колода</h3>
          {commonWords.map((word) => (
            <div className="word-row" key={word.id}>
              <div>
                <strong>{word.word}</strong>
                <p>{word.translation || '—'}</p>
              </div>
              <div className="inline-actions">
                <button onClick={() => addFromCommon(word.id)}>В личную колоду</button>
                {canManageCommon && <button className="danger" onClick={() => deleteCommon(word.id)}>Удалить</button>}
              </div>
            </div>
          ))}
        </section>

        <section className="card">
          <h3>Личная колода</h3>
          {personalWords.map((word) => (
            <div className="word-row" key={word.id}>
              <div>
                <strong>{word.word}</strong>
                <p>{word.translation || '—'}</p>
              </div>
              <button className="danger" onClick={() => deletePersonal(word.id)}>Удалить</button>
            </div>
          ))}
        </section>
      </details>

      {settingsDeck && (
        <DeckSettingsModal
          token={token}
          deck={settingsDeck}
          onClose={() => setSettingsDeck('')}
          onSaved={loadSummary}
        />
      )}
    </div>
  );
}

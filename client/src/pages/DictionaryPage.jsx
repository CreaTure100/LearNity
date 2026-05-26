import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';
import { DeckSettingsModal } from '../components/DeckSettingsModal';

const DECKS = ['common', 'personal'];

const DECK_LABELS = {
  common: 'Common deck',
  personal: 'Personal deck',
};

function createEmptySummary() {
  return {
    common: { deck: 'common', new: 0, learning: 0, review: 0 },
    personal: { deck: 'personal', new: 0, learning: 0, review: 0 },
  };
}

export function DictionaryPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const canManageCommon = user?.role === 'teacher' || user?.role === 'admin';

  const [summary, setSummary] = useState(() => createEmptySummary());
  const [commonWords, setCommonWords] = useState([]);
  const [personalWords, setPersonalWords] = useState([]);
  const [error, setError] = useState('');

  const [commonForm, setCommonForm] = useState({ word: '', translation: '' });
  const [personalForm, setPersonalForm] = useState({ word: '', translation: '', transcription: '', example: '', definition: '' });
  const [settingsDeck, setSettingsDeck] = useState(null);

  const loadSummary = async () => {
    const items = await http('/decks/summary', { token });
    const nextSummary = createEmptySummary();
    items.forEach((item) => {
      nextSummary[item.deck] = item;
    });
    setSummary(nextSummary);
  };

  const loadWords = async () => {
    const [common, personal] = await Promise.all([
      http('/common-words', { token }),
      http('/personal-words/my', { token }),
    ]);
    setCommonWords(common);
    setPersonalWords(personal);
  };

  const reloadAll = async () => {
    try {
      await Promise.all([loadSummary(), loadWords()]);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [items, common, personal] = await Promise.all([
          http('/decks/summary', { token }),
          http('/common-words', { token }),
          http('/personal-words/my', { token }),
        ]);

        if (!cancelled) {
          const nextSummary = createEmptySummary();
          items.forEach((item) => {
            nextSummary[item.deck] = item;
          });
          setSummary(nextSummary);
          setCommonWords(common);
          setPersonalWords(personal);
          setError('');
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

  const addCommon = async (e) => {
    e.preventDefault();
    await http('/common-words', { method: 'POST', token, body: commonForm });
    setCommonForm({ word: '', translation: '' });
    await reloadAll();
  };

  const addManualPersonal = async (e) => {
    e.preventDefault();
    await http('/personal-words/my', { method: 'POST', token, body: personalForm });
    setPersonalForm({ word: '', translation: '', transcription: '', example: '', definition: '' });
    await reloadAll();
  };

  const addFromCommon = async (common_word_id) => {
    await http('/personal-words/my', { method: 'POST', token, body: { common_word_id } });
    await reloadAll();
  };

  const deletePersonal = async (id) => {
    await http(`/personal-words/my/${id}`, { method: 'DELETE', token });
    await reloadAll();
  };

  const deleteCommon = async (id) => {
    await http(`/common-words/${id}`, { method: 'DELETE', token });
    await reloadAll();
  };

  const deckCards = useMemo(() => DECKS.map((deck) => summary[deck] || createEmptySummary()[deck]), [summary]);

  return (
    <div>
      <h2>Словарь</h2>
      {error && <p className="error">{error}</p>}

      <section className="deck-grid">
        {deckCards.map((deckSummary) => (
          <article className="deck-card" key={deckSummary.deck}>
            <h3>{DECK_LABELS[deckSummary.deck]}</h3>
            <div className="deck-metrics">
              <p><span>Новые</span><strong>{deckSummary.new}</strong></p>
              <p><span>Изучаемые</span><strong>{deckSummary.learning}</strong></p>
              <p><span>Повторяемые</span><strong>{deckSummary.review}</strong></p>
            </div>
            <div className="inline-actions deck-actions">
              <button onClick={() => navigate(`/dictionary/decks/${deckSummary.deck}/study`)}>Учить</button>
              <button className="secondary" onClick={() => setSettingsDeck(deckSummary.deck)}>Настройки</button>
            </div>
          </article>
        ))}
      </section>

      <details className="card dictionary-advanced">
        <summary>Расширенный режим словаря</summary>

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
          deck={settingsDeck}
          token={token}
          onClose={() => setSettingsDeck(null)}
          onSaved={async () => {
            setSettingsDeck(null);
            await loadSummary();
          }}
        />
      )}
    </div>
  );
}

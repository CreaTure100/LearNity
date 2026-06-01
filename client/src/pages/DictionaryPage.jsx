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
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';
  const canManageCommon = isTeacher;
  const pageSize = 20;

  const [summary, setSummary] = useState(() => createEmptySummary());
  const [commonWords, setCommonWords] = useState([]);
  const [personalWords, setPersonalWords] = useState([]);
  const [error, setError] = useState('');

  const [commonForm, setCommonForm] = useState({ word: '', translation: '' });
  const [personalForm, setPersonalForm] = useState({ word: '', translation: '', transcription: '', example: '', definition: '' });
  const [settingsDeck, setSettingsDeck] = useState(null);
  const [showCommonList, setShowCommonList] = useState(false);
  const [showPersonalList, setShowPersonalList] = useState(false);
  const [showPersonalAdd, setShowPersonalAdd] = useState(false);
  const [commonPage, setCommonPage] = useState(1);
  const [personalPage, setPersonalPage] = useState(1);
  const [editingWordId, setEditingWordId] = useState(null);
  const [editForm, setEditForm] = useState({ word: '', translation: '', transcription: '', example: '', definition: '' });

  const loadSummary = async () => {
    if (isTeacher) {
      return;
    }
    const items = await http('/decks/summary', { token });
    const nextSummary = createEmptySummary();
    items.forEach((item) => {
      nextSummary[item.deck] = item;
    });
    setSummary(nextSummary);
  };

  const loadWords = async () => {
    if (isTeacher) {
      const common = await http('/common-words', { token });
      setCommonWords(common);
      setPersonalWords([]);
      return;
    }
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
        if (isTeacher) {
          const common = await http('/common-words', { token });
          if (!cancelled) {
            setSummary(createEmptySummary());
            setCommonWords(common);
            setPersonalWords([]);
            setError('');
          }
          return;
        }

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
  }, [token, isTeacher]);

  useEffect(() => {
    if (isTeacher) {
      setShowCommonList(true);
      setShowPersonalAdd(false);
      setShowPersonalList(false);
      setSettingsDeck(null);
    }
  }, [isTeacher]);

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

  const startEditPersonal = (word) => {
    setEditingWordId(word.id);
    setEditForm({
      word: word.word || '',
      translation: word.translation || '',
      transcription: word.transcription || '',
      example: word.example || '',
      definition: word.definition || '',
    });
  };

  const cancelEditPersonal = () => {
    setEditingWordId(null);
    setEditForm({ word: '', translation: '', transcription: '', example: '', definition: '' });
  };

  const saveEditPersonal = async (id) => {
    await http(`/personal-words/my/${id}`, { method: 'PATCH', token, body: editForm });
    cancelEditPersonal();
    await reloadAll();
  };

  const deleteCommon = async (id) => {
    await http(`/common-words/${id}`, { method: 'DELETE', token });
    await reloadAll();
  };

  const deckCards = useMemo(() => DECKS.map((deck) => summary[deck] || createEmptySummary()[deck]), [summary]);
  const commonTotalPages = Math.max(1, Math.ceil(commonWords.length / pageSize));
  const personalTotalPages = Math.max(1, Math.ceil(personalWords.length / pageSize));

  useEffect(() => {
    if (commonPage > commonTotalPages) {
      setCommonPage(commonTotalPages);
    }
  }, [commonPage, commonTotalPages]);

  useEffect(() => {
    if (personalPage > personalTotalPages) {
      setPersonalPage(personalTotalPages);
    }
  }, [personalPage, personalTotalPages]);

  const commonPageItems = useMemo(() => {
    const start = (commonPage - 1) * pageSize;
    return commonWords.slice(start, start + pageSize);
  }, [commonWords, commonPage, pageSize]);

  const personalPageItems = useMemo(() => {
    const start = (personalPage - 1) * pageSize;
    return personalWords.slice(start, start + pageSize);
  }, [personalWords, personalPage, pageSize]);

  return (
    <div>
      <h2>Словарь</h2>
      {error && <p className="error">{error}</p>}

      {!isTeacher && (
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
                <div className="deck-actions__right">
                  {deckSummary.deck === 'common' && (
                    <button
                      className="secondary"
                      onClick={() => {
                        setShowCommonList((prev) => !prev);
                        setCommonPage(1);
                      }}
                    >
                      {showCommonList ? 'Скрыть слова' : 'Список слов'}
                    </button>
                  )}
                  {deckSummary.deck === 'personal' && (
                    <>
                      <button
                        className="secondary"
                        onClick={() => {
                          setShowPersonalAdd((prev) => !prev);
                        }}
                      >
                        {showPersonalAdd ? 'Скрыть форму' : 'Добавить слово'}
                      </button>
                      <button
                        className="secondary"
                        onClick={() => {
                          setShowPersonalList((prev) => !prev);
                          setPersonalPage(1);
                        }}
                      >
                        {showPersonalList ? 'Скрыть слова' : 'Список слов'}
                      </button>
                    </>
                  )}
                  <button
                    className="secondary icon-button"
                    onClick={() => setSettingsDeck(deckSummary.deck)}
                    aria-label="Настройки"
                    title="Настройки"
                    type="button"
                  >
                    <span aria-hidden="true">⚙</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {!isTeacher && showPersonalAdd && (
        <section className="card word-panel">
          <div className="word-panel__header">
            <h3>Добавить слово в личную колоду</h3>
            <button className="secondary" onClick={() => setShowPersonalAdd(false)}>Скрыть</button>
          </div>
          <form onSubmit={addManualPersonal} className="grid-form">
            <input placeholder="Слово" value={personalForm.word} onChange={(e) => setPersonalForm((s) => ({ ...s, word: e.target.value }))} required />
            <input placeholder="Перевод" value={personalForm.translation} onChange={(e) => setPersonalForm((s) => ({ ...s, translation: e.target.value }))} />
            <input placeholder="Транскрипция" value={personalForm.transcription} onChange={(e) => setPersonalForm((s) => ({ ...s, transcription: e.target.value }))} />
            <input placeholder="Пример" value={personalForm.example} onChange={(e) => setPersonalForm((s) => ({ ...s, example: e.target.value }))} />
            <input placeholder="Определение" value={personalForm.definition} onChange={(e) => setPersonalForm((s) => ({ ...s, definition: e.target.value }))} />
            <button type="submit">Добавить в личную колоду</button>
          </form>
        </section>
      )}

      {showCommonList && (
        <section className="card word-panel">
          <div className="word-panel__header">
            <h3>Общая колода</h3>
            {!isTeacher && <button className="secondary" onClick={() => setShowCommonList(false)}>Скрыть</button>}
          </div>

          {canManageCommon && (
            <form onSubmit={addCommon} className="word-panel__form">
              <input placeholder="Слово" value={commonForm.word} onChange={(e) => setCommonForm((s) => ({ ...s, word: e.target.value }))} required />
              <input placeholder="Перевод" value={commonForm.translation} onChange={(e) => setCommonForm((s) => ({ ...s, translation: e.target.value }))} />
              <button type="submit">Добавить</button>
            </form>
          )}

          <div className="word-list">
            {commonWords.length === 0 && <p className="muted">В общей колоде пока нет слов.</p>}
            {commonPageItems.map((word) => (
              <article className="word-card" key={word.id}>
                <div className="word-card__main">
                  <div className="word-card__word">{word.word}</div>
                  <div className="word-card__translation">{word.translation || '—'}</div>
                </div>
                <div className="word-card__actions">
                  {!isTeacher && <button onClick={() => addFromCommon(word.id)}>В личную колоду</button>}
                  {canManageCommon && (
                    <button className="danger" onClick={() => deleteCommon(word.id)}>Удалить</button>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="pagination">
            <button className="secondary" onClick={() => setCommonPage((p) => Math.max(1, p - 1))} disabled={commonPage <= 1}>
              Назад
            </button>
            <span>Страница {commonPage} из {commonTotalPages}</span>
            <button className="secondary" onClick={() => setCommonPage((p) => Math.min(commonTotalPages, p + 1))} disabled={commonPage >= commonTotalPages}>
              Вперед
            </button>
          </div>
        </section>
      )}

      {!isTeacher && showPersonalList && (
        <section className="card word-panel">
          <div className="word-panel__header">
            <h3>Личная колода</h3>
            <button className="secondary" onClick={() => setShowPersonalList(false)}>Скрыть</button>
          </div>

          <div className="word-list">
            {personalWords.length === 0 && <p className="muted">В личной колоде пока нет слов.</p>}
            {personalPageItems.map((word) => (
              <article className="word-card" key={word.id}>
                {editingWordId === word.id ? (
                  <div className="word-card__edit">
                    <div className="word-card__edit-grid">
                      <input
                        value={editForm.word}
                        onChange={(e) => setEditForm((s) => ({ ...s, word: e.target.value }))}
                        placeholder="Слово"
                        required
                      />
                      <input
                        value={editForm.translation}
                        onChange={(e) => setEditForm((s) => ({ ...s, translation: e.target.value }))}
                        placeholder="Перевод"
                      />
                      <input
                        value={editForm.transcription}
                        onChange={(e) => setEditForm((s) => ({ ...s, transcription: e.target.value }))}
                        placeholder="Транскрипция"
                      />
                      <input
                        value={editForm.example}
                        onChange={(e) => setEditForm((s) => ({ ...s, example: e.target.value }))}
                        placeholder="Пример"
                      />
                      <input
                        value={editForm.definition}
                        onChange={(e) => setEditForm((s) => ({ ...s, definition: e.target.value }))}
                        placeholder="Определение"
                      />
                    </div>
                    <div className="word-card__actions">
                      <button onClick={() => saveEditPersonal(word.id)}>Сохранить</button>
                      <button className="secondary" onClick={cancelEditPersonal}>Отмена</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="word-card__main">
                      <div className="word-card__word">{word.word}</div>
                      <div className="word-card__translation">{word.translation || '—'}</div>
                      {word.transcription && <div className="word-card__meta">{word.transcription}</div>}
                    </div>
                    <div className="word-card__actions">
                      <button className="secondary" onClick={() => startEditPersonal(word)}>Редактировать</button>
                      <button className="danger" onClick={() => deletePersonal(word.id)}>Удалить</button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>

          <div className="pagination">
            <button className="secondary" onClick={() => setPersonalPage((p) => Math.max(1, p - 1))} disabled={personalPage <= 1}>
              Назад
            </button>
            <span>Страница {personalPage} из {personalTotalPages}</span>
            <button className="secondary" onClick={() => setPersonalPage((p) => Math.min(personalTotalPages, p + 1))} disabled={personalPage >= personalTotalPages}>
              Вперед
            </button>
          </div>
        </section>
      )}

      {!isTeacher && settingsDeck && (
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

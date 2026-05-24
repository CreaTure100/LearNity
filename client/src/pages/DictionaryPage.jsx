import { useEffect, useState } from 'react';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';

export function DictionaryPage() {
  const { token, user } = useAuth();
  const canManageCommon = user?.role === 'teacher' || user?.role === 'admin';

  const [commonWords, setCommonWords] = useState([]);
  const [personalWords, setPersonalWords] = useState([]);
  const [error, setError] = useState('');

  const [commonForm, setCommonForm] = useState({ word: '', translation: '' });
  const [personalForm, setPersonalForm] = useState({ word: '', translation: '', transcription: '', example: '', definition: '' });

  const load = async () => {
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
    let cancelled = false;
    (async () => {
      try {
        const [common, personal] = await Promise.all([
          http('/common-words', { token }),
          http('/personal-words/my', { token }),
        ]);
        if (!cancelled) {
          setCommonWords(common);
          setPersonalWords(personal);
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
    await load();
  };

  const addManualPersonal = async (e) => {
    e.preventDefault();
    await http('/personal-words/my', { method: 'POST', token, body: personalForm });
    setPersonalForm({ word: '', translation: '', transcription: '', example: '', definition: '' });
    await load();
  };

  const addFromCommon = async (common_word_id) => {
    await http('/personal-words/my', { method: 'POST', token, body: { common_word_id } });
    await load();
  };

  const deletePersonal = async (id) => {
    await http(`/personal-words/my/${id}`, { method: 'DELETE', token });
    await load();
  };

  const deleteCommon = async (id) => {
    await http(`/common-words/${id}`, { method: 'DELETE', token });
    await load();
  };

  return (
    <div>
      <h2>Словарь</h2>
      {error && <p className="error">{error}</p>}

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
    </div>
  );
}

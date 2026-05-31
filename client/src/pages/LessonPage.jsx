import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';


function toYouTubeEmbedUrl(url) {
  if (!url) return null;

  // already embed
  if (url.includes('youtube.com/embed/')) return url;

  // youtu.be/<id>
  const short = url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
  if (short) return `https://www.youtube.com/embed/${short[1]}`;

  // youtube.com/watch?v=<id>
  try {
    const u = new URL(url);
    const v = u.searchParams.get('v');
    if (v) return `https://www.youtube.com/embed/${v}`;
  } catch {
    // ignore
  }

  return null;
}

export function LessonPage() {
  const { id: courseId, lessonId } = useParams();
  const { token, user } = useAuth();
  const canManage = user?.role === 'teacher' || user?.role === 'admin';
  const progressKey = `lesson-progress:${user?.id || 'anon'}:${lessonId}`;

  const [lesson, setLesson] = useState(null);
  const [course, setCourse] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [answers, setAnswers] = useState({}); // { assignmentId: { selected, result } }
  const [dragAnswers, setDragAnswers] = useState({}); // { assignmentId: { slots: { [slotKey]: optionId } } }
  const [error, setError] = useState('');
  const [progressReady, setProgressReady] = useState(false);

  const [assignmentForm, setAssignmentForm] = useState({
    type: 'single_choice',
    prompt: '',
    options: 'A|B',
    correct_option_id: '0',
    score: 1,
  });

  const parseSlotKeys = (prompt) => {
    if (!prompt) return [];
    const keys = [];
    const re = /{{\s*(\d+)\s*}}/g;
    let match = re.exec(prompt);
    while (match) {
      keys.push(Number(match[1]));
      match = re.exec(prompt);
    }
    return keys;
  };

  const parsePromptParts = (prompt) => {
    const parts = [];
    const re = /{{\s*(\d+)\s*}}/g;
    let lastIndex = 0;
    let match = re.exec(prompt);
    while (match) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: prompt.slice(lastIndex, match.index) });
      }
      parts.push({ type: 'slot', key: Number(match[1]) });
      lastIndex = re.lastIndex;
      match = re.exec(prompt);
    }
    if (lastIndex < prompt.length) {
      parts.push({ type: 'text', value: prompt.slice(lastIndex) });
    }
    return parts;
  };

  const renderTextWithLineBreaks = (text, keyPrefix) => {
    const lines = String(text || '')
      .split('\n')
      .map((line) => line.replace(/^\s+/, ''));
    const rendered = [];
    lines.forEach((line, idx) => {
      if (idx > 0) {
        rendered.push(<br key={`${keyPrefix}-br-${idx}`} />);
      }
      rendered.push(<span key={`${keyPrefix}-line-${idx}`}>{line}</span>);
    });
    return rendered;
  };

  const getSlotKeys = (prompt) => {
    const keys = parseSlotKeys(prompt);
    const unique = [...new Set(keys)];
    return unique.sort((a, b) => a - b);
  };

  const restoreProgress = (assignmentRows) => {
    if (!progressKey) return;
    const stored = localStorage.getItem(progressKey);
    if (!stored) {
      setAnswers({});
      setDragAnswers({});
      setProgressReady(true);
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      const validIds = new Set((assignmentRows || []).map((item) => item.id));
      const nextAnswers = {};
      const nextDrag = {};

      Object.entries(parsed.answers || {}).forEach(([id, value]) => {
        if (validIds.has(id)) nextAnswers[id] = value;
      });

      Object.entries(parsed.dragAnswers || {}).forEach(([id, value]) => {
        if (validIds.has(id)) nextDrag[id] = value;
      });

      setAnswers(nextAnswers);
      setDragAnswers(nextDrag);
    } catch {
      setAnswers({});
      setDragAnswers({});
    }

    setProgressReady(true);
  };

  const load = async () => {
    try {
      const [lessonData, assignData] = await Promise.all([
        http(`/lessons/${lessonId}`, { token }),
        http(`/lessons/${lessonId}/assignments`, { token }),
      ]);
      setLesson(lessonData);
      setAssignments(assignData);
      restoreProgress(assignData);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [lessonData, assignData, courseData] = await Promise.all([
          http(`/lessons/${lessonId}`, { token }),
          http(`/lessons/${lessonId}/assignments`, { token }),
          http(`/courses/${courseId}`, { token }),
        ]);
        if (!cancelled) {
          setLesson(lessonData);
          setAssignments(assignData);
          setCourse(courseData);
          restoreProgress(assignData);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [lessonId, courseId, token]);

  useEffect(() => {
    setProgressReady(false);
  }, [progressKey]);

  useEffect(() => {
    if (!progressReady || !progressKey) return;
    localStorage.setItem(progressKey, JSON.stringify({ answers, dragAnswers }));
  }, [answers, dragAnswers, progressReady, progressKey]);

  const createAssignment = async (e) => {
    e.preventDefault();
    const options = assignmentForm.options
      .split('|')
      .map((text, index) => ({ id: String(index), text: text.trim() }))
      .filter((x) => x.text);

    const type = assignmentForm.type || 'single_choice';
    if (type === 'drag_and_drop') {
      const slotKeys = parseSlotKeys(assignmentForm.prompt);
      const uniqueKeys = [...new Set(slotKeys)];
      const maxKey = uniqueKeys.length ? Math.max(...uniqueKeys) : 0;
      if (!uniqueKeys.length) {
        alert('В prompt должны быть слоты вида {{1}}');
        return;
      }
      if (uniqueKeys.length > 40) {
        alert('Максимум 40 пропусков');
        return;
      }
      if (uniqueKeys.length !== slotKeys.length || maxKey !== uniqueKeys.length || !uniqueKeys.every((k) => k >= 1)) {
        alert('Слоты должны быть пронумерованы подряд: {{1}}, {{2}}, ...');
        return;
      }
      const correctIds = assignmentForm.correct_option_id
        .split('|')
        .map((id) => id.trim())
        .filter(Boolean);
      if (correctIds.length !== uniqueKeys.length) {
        alert('Ответы должны быть для каждого слота по порядку');
        return;
      }
      await http(`/lessons/${lessonId}/assignments`, {
        method: 'POST',
        token,
        body: {
          type,
          prompt: assignmentForm.prompt,
          options,
          correct_option_ids: correctIds,
          score: Number(assignmentForm.score),
        },
      });
      setAssignmentForm({ type, prompt: '', options: 'A|B', correct_option_id: '', score: 1 });
      await load();
      return;
    }

    await http(`/lessons/${lessonId}/assignments`, {
      method: 'POST',
      token,
      body: {
        type,
        prompt: assignmentForm.prompt,
        options,
        correct_option_id: assignmentForm.correct_option_id,
        score: Number(assignmentForm.score),
      },
    });
    setAssignmentForm({ type, prompt: '', options: 'A|B', correct_option_id: '0', score: 1 });
    await load();
  };

  const submitAnswer = async (assignmentId, selected_option_id) => {
    try {
      const result = await http(`/assignments/${assignmentId}/submit`, {
        method: 'POST',
        token,
        body: { selected_option_id },
      });
      setAnswers((prev) => ({
        ...prev,
        [assignmentId]: { selected: selected_option_id, result },
      }));
    } catch (err) {
      alert(err.message);
    }
  };

  const deleteAssignment = async (assignmentId) => {
    if (!confirm('Удалить задание?')) return;
    await http(`/assignments/${assignmentId}`, { method: 'DELETE', token });
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[assignmentId];
      return next;
    });
    setDragAnswers((prev) => {
      const next = { ...prev };
      delete next[assignmentId];
      return next;
    });
    await load();
  };

  const setDragSlot = (assignmentId, slotKey, optionId) => {
    setDragAnswers((prev) => {
      const prevSlots = prev[assignmentId]?.slots || {};
      const nextSlots = { ...prevSlots };
      Object.keys(nextSlots).forEach((key) => {
        if (nextSlots[key] === optionId) {
          delete nextSlots[key];
        }
      });
      nextSlots[slotKey] = optionId;
      return { ...prev, [assignmentId]: { slots: nextSlots } };
    });
  };

  const clearDragSlot = (assignmentId, slotKey) => {
    setDragAnswers((prev) => {
      const prevSlots = prev[assignmentId]?.slots || {};
      if (!prevSlots[slotKey]) return prev;
      const nextSlots = { ...prevSlots };
      delete nextSlots[slotKey];
      return { ...prev, [assignmentId]: { slots: nextSlots } };
    });
  };

  const clearDragAll = (assignmentId) => {
    setDragAnswers((prev) => ({ ...prev, [assignmentId]: { slots: {} } }));
  };

  return (
    <div className="lesson-page">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link to="/courses">Курсы</Link>
        <span className="breadcrumb__sep">›</span>
        <Link to={`/courses/${courseId}`}>{course?.title || '...'}</Link>
        <span className="breadcrumb__sep">›</span>
        <span>{lesson?.title || '...'}</span>
      </div>

      <div className="lesson-page__header">
        <div className="lesson-page__title-row">
          {lesson?.order_index && (
            <span className="lesson-page__number">{lesson.order_index}</span>
          )}
          <h2>{lesson?.title || 'Загрузка...'}</h2>
        </div>
        {lesson?.description && <p className="lesson-page__desc">{lesson.description}</p>}
        {lesson?.video_url && (
          (() => {
            const embedUrl = toYouTubeEmbedUrl(lesson.video_url);
            if (!embedUrl) {
              return (
                <a href={lesson.video_url} target="_blank" rel="noreferrer" className="lesson-page__video-link">
                  ▶ Открыть видео
                </a>
              );
            }

            return (
              <div className="lesson-page__video card">
                <div className="video-embed">
                  <iframe
                    src={embedUrl}
                    title="Lesson video"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>

                <div className="video-fallback">
                  <a href={lesson.video_url} target="_blank" rel="noreferrer" className="lesson-page__video-link">
                    Открыть на YouTube
                  </a>
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* Lesson content */}
      {lesson?.content && (
        <div className="lesson-page__content card">
          <div className="lesson-page__content-text">
            {lesson.content.split('\n').map((line, i) => (
              <p key={i}>{line || '\u00A0'}</p>
            ))}
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {canManage && (
        <form className="card lesson-page__add-form" onSubmit={createAssignment}>
          <h3>Добавить задание</h3>
          <div className="form-group">
            <label>Тип задания</label>
            <select
              value={assignmentForm.type}
              onChange={(e) => setAssignmentForm((s) => ({ ...s, type: e.target.value }))}
            >
              <option value="single_choice">Один вариант</option>
              <option value="drag_and_drop">Drag and drop</option>
            </select>
          </div>
          <div className="form-group">
            <textarea
              placeholder="Вопрос"
              value={assignmentForm.prompt}
              onChange={(e) => setAssignmentForm((s) => ({ ...s, prompt: e.target.value }))}
              rows={4}
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <input
                placeholder={assignmentForm.type === 'drag_and_drop' ? 'Варианты для перетаскивания через |' : 'Варианты через |'}
                value={assignmentForm.options}
                onChange={(e) => setAssignmentForm((s) => ({ ...s, options: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <input
                placeholder={assignmentForm.type === 'drag_and_drop'
                  ? 'Ответы по слотам (ID через |)'
                  : 'ID правильного (0, 1, …)'}
                value={assignmentForm.correct_option_id}
                onChange={(e) => setAssignmentForm((s) => ({ ...s, correct_option_id: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <input
                type="number"
                min="0"
                placeholder="Баллы"
                value={assignmentForm.score}
                onChange={(e) => setAssignmentForm((s) => ({ ...s, score: e.target.value }))}
              />
            </div>
          </div>
          {assignmentForm.type === 'drag_and_drop' && (
            <div className="form-hint">
              Используйте слоты {'{{1}}'} {'{{2}}'} в prompt. Ответы задаются по порядку слотов, через |.
            </div>
          )}
          <button type="submit">Создать задание</button>
        </form>
      )}

      <div className="lesson-page__assignments">
        <h3>Задания ({assignments.length})</h3>
        {assignments.length === 0 && <p className="muted">Заданий пока нет</p>}
        {assignments.map((a) => {
          const answer = answers[a.id];
          const type = a.type || 'single_choice';
          return (
            <div className={`assignment-card ${answer ? (answer.result.is_correct ? 'assignment-card--correct' : 'assignment-card--wrong') : ''}`} key={a.id}>
              <p className="assignment-card__prompt">
                {type === 'drag_and_drop' ? 'Заполните пропуски:' : a.prompt}
              </p>
              <div className="assignment-card__score">Баллов: {a.score}</div>
              {type === 'drag_and_drop' ? (
                (() => {
                  const parts = parsePromptParts(a.prompt);
                  const slotKeys = getSlotKeys(a.prompt);
                  const slots = dragAnswers[a.id]?.slots || {};
                  const optionMap = Object.fromEntries(a.options.map((opt) => [String(opt.id), opt]));
                  const usedIds = new Set(Object.values(slots).map((id) => String(id)));
                  const allFilled = slotKeys.every((key) => slots[key]);

                  return (
                    <div className="assignment-dnd">
                      <div className="assignment-dnd__options">
                        {a.options.map((opt) => {
                          const isUsed = usedIds.has(String(opt.id));
                          return (
                            <button
                              type="button"
                              key={opt.id}
                              className={`assignment-dnd__chip ${isUsed ? 'assignment-dnd__chip--used' : ''}`}
                              draggable={!answer && !isUsed}
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', String(opt.id));
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              disabled={!!answer}
                            >
                              {opt.text}
                            </button>
                          );
                        })}
                      </div>

                      <div className="assignment-dnd__prompt">
                        {parts.map((part, idx) => {
                          if (part.type === 'text') {
                            return (
                              <span key={`text-${idx}`}>
                                {renderTextWithLineBreaks(part.value, `text-${idx}`)}
                              </span>
                            );
                          }
                          const slotValue = slots[part.key];
                          return (
                            <span
                              key={`slot-${part.key}-${idx}`}
                              className={`assignment-dnd__slot ${slotValue ? 'assignment-dnd__slot--filled' : ''}`}
                              onDragOver={(e) => {
                                if (!answer) e.preventDefault();
                              }}
                              onDrop={(e) => {
                                if (answer) return;
                                e.preventDefault();
                                const optionId = e.dataTransfer.getData('text/plain');
                                if (optionId) setDragSlot(a.id, part.key, optionId);
                              }}
                            >
                              <span className="assignment-dnd__slot-text">
                                {slotValue ? optionMap[String(slotValue)]?.text : '____'}
                              </span>
                              {!answer && slotValue && (
                                <button
                                  type="button"
                                  className="assignment-dnd__clear"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    clearDragSlot(a.id, part.key);
                                  }}
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          );
                        })}
                      </div>

                      <div className="assignment-dnd__actions">
                        <button
                          onClick={() => submitAnswer(a.id, slotKeys.map((key) => slots[key]))}
                          disabled={!!answer || !allFilled}
                        >
                          Проверить
                        </button>
                        <button
                          className="secondary"
                          onClick={() => clearDragAll(a.id)}
                          disabled={!!answer}
                        >
                          Сбросить
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="assignment-card__options">
                  {a.options.map((opt) => {
                    const isSelected = answer?.selected === opt.id;
                    const isCorrectOpt = answer && answer.result && !answer.result.is_correct && opt.id === a.correct_option_id;
                    let extraClass = '';
                    if (isSelected && answer?.result?.is_correct) extraClass = 'assignment-card__option--correct';
                    else if (isSelected && !answer?.result?.is_correct) extraClass = 'assignment-card__option--wrong';
                    else if (isCorrectOpt) extraClass = 'assignment-card__option--was-correct';

                    return (
                      <button
                        key={opt.id}
                        className={`assignment-card__option ${extraClass}`}
                        onClick={() => !answer && submitAnswer(a.id, opt.id)}
                        disabled={!!answer}
                      >
                        {opt.text}
                      </button>
                    );
                  })}
                </div>
              )}
              {answer && (
                <div className={`assignment-card__feedback ${answer.result.is_correct ? 'assignment-card__feedback--correct' : 'assignment-card__feedback--wrong'}`}>
                  {answer.result.is_correct ? `✅ Верно! +${answer.result.earned_score} баллов` : '❌ Неверно'}
                </div>
              )}
              {canManage && (
                <button className="danger assignment-card__delete" onClick={() => deleteAssignment(a.id)}>
                  Удалить задание
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

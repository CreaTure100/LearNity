import { useEffect, useMemo, useState } from 'react';
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

function isMp4Url(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.pathname.toLowerCase().endsWith('.mp4');
  } catch {
    return url.toLowerCase().includes('.mp4');
  }
}

function toDrivePreviewUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('drive.google.com')) {
      return null;
    }

    const pathMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    if (pathMatch) {
      return `https://drive.google.com/file/d/${pathMatch[1]}/preview`;
    }

    const id = parsed.searchParams.get('id');
    if (id) {
      return `https://drive.google.com/file/d/${id}/preview`;
    }
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
  const [dragSourceText, setDragSourceText] = useState('');
  const [dragExtras, setDragExtras] = useState('');
  const [dragSelectedTokens, setDragSelectedTokens] = useState([]);

  const clearDragAll = (assignmentId) => {
    setDragAnswers((prev) => ({ ...prev, [assignmentId]: { slots: {} } }));
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[assignmentId];
      return next;
    });
  };

  const clearSingleChoice = (assignmentId) => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[assignmentId];
      return next;
    });
  };

  const parseSlotKeys = (prompt) => {
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

  const parseCorrectOptionIds = (assignment) => {
    if (!assignment) return [];
    if (assignment.type === 'drag_and_drop') {
      try {
        const parsed = JSON.parse(assignment.correct_option_id || '[]');
        return Array.isArray(parsed) ? parsed.map((id) => String(id)) : [];
      } catch {
        return [];
      }
    }
    if (assignment.correct_option_id === undefined || assignment.correct_option_id === null) {
      return [];
    }
    return [String(assignment.correct_option_id)];
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

  const dragTokens = useMemo(() => {
    if (!dragSourceText) return [];
    const tokens = [];
    const re = /([A-Za-zА-Яа-яЁё0-9]+|\s+|[^\sA-Za-zА-Яа-яЁё0-9]+)/g;
    let match = re.exec(dragSourceText);
    while (match) {
      const value = match[0];
      let type = 'punct';
      if (/^\s+$/.test(value)) type = 'space';
      else if (/^[A-Za-zА-Яа-яЁё0-9]+$/.test(value)) type = 'word';
      tokens.push({ value, type });
      match = re.exec(dragSourceText);
    }
    return tokens;
  }, [dragSourceText]);

  useEffect(() => {
    setDragSelectedTokens([]);
  }, [dragSourceText]);

  const toggleDragToken = (index) => {
    setDragSelectedTokens((prev) => {
      if (prev.includes(index)) {
        return prev.filter((id) => id !== index);
      }
      return [...prev, index];
    });
  };

  const selectAllDragTokens = () => {
    const indices = dragTokens
      .map((token, idx) => (token.type === 'word' ? idx : null))
      .filter((idx) => idx !== null);
    setDragSelectedTokens(indices);
  };

  const clearDragTokens = () => {
    setDragSelectedTokens([]);
  };

  const buildDragData = () => {
    const selectedSet = new Set(dragSelectedTokens);
    const selectedWords = [];
    let slotIndex = 0;
    let prompt = '';

    dragTokens.forEach((token, idx) => {
      if (token.type === 'word' && selectedSet.has(idx)) {
        slotIndex += 1;
        selectedWords.push(token.value);
        prompt += `{{${slotIndex}}}`;
      } else {
        prompt += token.value;
      }
    });

    const extraOptions = dragExtras
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => !selectedWords.includes(item));

    const optionsText = [...selectedWords, ...extraOptions];
    const options = optionsText.map((text, index) => ({ id: String(index), text }));
    const correctIds = selectedWords.map((_, idx) => String(idx));

    return {
      prompt,
      options,
      correctIds,
      selectedWords,
    };
  };

  const dragData = useMemo(() => buildDragData(), [dragTokens, dragExtras, dragSelectedTokens]);

  const createAssignment = async (e) => {
    e.preventDefault();
    const options = assignmentForm.options
      .split('|')
      .map((text, index) => ({ id: String(index), text: text.trim() }))
      .filter((x) => x.text);

    const type = assignmentForm.type || 'single_choice';
    if (type === 'drag_and_drop') {
      if (!dragSourceText.trim()) {
        alert('Введите текст для пропусков');
        return;
      }
      const { prompt, options: dragOptions, correctIds, selectedWords } = dragData;
      if (!selectedWords.length) {
        alert('Выберите слова, которые будут пропусками');
        return;
      }
      if (selectedWords.length > 40) {
        alert('Максимум 40 пропусков');
        return;
      }
      if (dragOptions.length < 2) {
        alert('Нужно минимум 2 варианта ответа');
        return;
      }
      await http(`/lessons/${lessonId}/assignments`, {
        method: 'POST',
        token,
        body: {
          type,
          prompt,
          options: dragOptions,
          correct_option_ids: correctIds,
          score: Number(assignmentForm.score),
        },
      });
      setAssignmentForm({ type, prompt: '', options: 'A|B', correct_option_id: '', score: 1 });
      setDragSourceText('');
      setDragExtras('');
      setDragSelectedTokens([]);
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
            const drivePreviewUrl = toDrivePreviewUrl(lesson.video_url);
            const isMp4 = isMp4Url(lesson.video_url);
            const embedUrl = toYouTubeEmbedUrl(lesson.video_url);
            if (drivePreviewUrl) {
              return (
                <div className="lesson-page__video card">
                  <div className="video-embed">
                    <iframe
                      src={drivePreviewUrl}
                      title="Lesson video"
                      frameBorder="0"
                      allow="autoplay"
                      allowFullScreen
                    />
                  </div>

                  <div className="video-fallback">
                    <a href={lesson.video_url} target="_blank" rel="noreferrer" className="lesson-page__video-link">
                      Открыть видео
                    </a>
                  </div>
                </div>
              );
            }

            if (isMp4) {
              return (
                <div className="lesson-page__video card">
                  <div className="video-embed">
                    <video controls preload="metadata" src={lesson.video_url} />
                  </div>

                  <div className="video-fallback">
                    <a href={lesson.video_url} target="_blank" rel="noreferrer" className="lesson-page__video-link">
                      Открыть видео
                    </a>
                  </div>
                </div>
              );
            }

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
          {assignmentForm.type === 'drag_and_drop' ? (
            <div className="drag-builder">
              <div className="drag-builder__editor">
                <label className="drag-builder__label">Текст для пропусков</label>
                <textarea
                  className="drag-builder__textarea"
                  placeholder="Вставьте текст, затем выделите слова для пропусков"
                  value={dragSourceText}
                  onChange={(e) => setDragSourceText(e.target.value)}
                  rows={5}
                  required
                />
                <div className="drag-builder__toolbar">
                  <button type="button" className="secondary" onClick={selectAllDragTokens}>
                    Выделить все слова
                  </button>
                  <button type="button" className="secondary" onClick={clearDragTokens}>
                    Сбросить выбор
                  </button>
                  <span className="drag-builder__count">Пропусков: {dragData.selectedWords.length}</span>
                </div>
                <div className="drag-builder__tokens" aria-live="polite">
                  {dragTokens.length === 0 && <span className="muted">Тут появится текст для выбора пропусков.</span>}
                  {dragTokens.map((token, idx) => {
                    if (token.type === 'word') {
                      const isSelected = dragSelectedTokens.includes(idx);
                      return (
                        <button
                          type="button"
                          key={`token-${idx}`}
                          className={`drag-token ${isSelected ? 'drag-token--selected' : ''}`}
                          onClick={() => toggleDragToken(idx)}
                        >
                          {token.value}
                        </button>
                      );
                    }
                    return (
                      <span key={`token-${idx}`} className="drag-token__sep">
                        {token.value}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="drag-builder__side">
                <div className="form-group">
                  <label>Доп. варианты (через |)</label>
                  <input
                    placeholder="Например: quick | suddenly"
                    value={dragExtras}
                    onChange={(e) => setDragExtras(e.target.value)}
                  />
                </div>
                <div className="drag-builder__preview">
                  <div className="drag-builder__label">Превью пропусков</div>
                  <div className="drag-builder__prompt">
                    {(() => {
                      const parts = parsePromptParts(dragData.prompt);
                      return parts.map((part, idx) => {
                        if (part.type === 'text') {
                          return (
                            <span key={`preview-text-${idx}`}>
                              {renderTextWithLineBreaks(part.value, `preview-${idx}`)}
                            </span>
                          );
                        }
                        return (
                          <span key={`preview-slot-${idx}`} className="drag-builder__slot">
                            ____
                          </span>
                        );
                      });
                    })()}
                  </div>
                </div>
                <div className="drag-builder__preview">
                  <div className="drag-builder__label">Варианты для перетаскивания</div>
                  <div className="drag-builder__options">
                    {dragData.options.map((opt) => (
                      <span className="drag-builder__chip" key={opt.id}>{opt.text}</span>
                    ))}
                    {dragData.options.length === 0 && <span className="muted">Пока нет вариантов</span>}
                  </div>
                </div>
                <div className="form-group">
                  <label>Баллы</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Баллы"
                    value={assignmentForm.score}
                    onChange={(e) => setAssignmentForm((s) => ({ ...s, score: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
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
                    placeholder="Варианты через |"
                    value={assignmentForm.options}
                    onChange={(e) => setAssignmentForm((s) => ({ ...s, options: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    placeholder="ID правильного (0, 1, …)"
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
            </>
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
                        >
                          Сбросить
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <>
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
                  <div className="assignment-dnd__actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => clearSingleChoice(a.id)}
                    >
                      Сбросить
                    </button>
                  </div>
                </>
              )}
              {answer && (
                <div className={`assignment-card__feedback ${answer.result.is_correct ? 'assignment-card__feedback--correct' : 'assignment-card__feedback--wrong'}`}>
                  {answer.result.is_correct ? `✅ Верно! +${answer.result.earned_score} баллов` : '❌ Неверно'}
                </div>
              )}
              {answer && (
                (() => {
                  const correctIds = parseCorrectOptionIds(a);
                  const optionMap = Object.fromEntries(a.options.map((opt) => [String(opt.id), opt]));

                  if (type === 'drag_and_drop') {
                    const slotKeys = getSlotKeys(a.prompt);
                    const selectedIds = Array.isArray(answer.selected)
                      ? answer.selected.map((id) => String(id))
                      : [];
                    return (
                      <div className="assignment-card__answers">
                        <div className="assignment-card__answer-title">Правильные ответы по слотам</div>
                        {slotKeys.map((slotKey, idx) => {
                          const correctId = correctIds[idx];
                          const selectedId = selectedIds[idx];
                          const isCorrectSlot = correctId && selectedId === correctId;
                          return (
                            <div className={`assignment-card__answer-row ${isCorrectSlot ? 'assignment-card__answer-row--ok' : 'assignment-card__answer-row--bad'}`} key={`slot-${slotKey}`}>
                              <span className="assignment-card__answer-label">Слот {slotKey}:</span>
                              <span>Ваш ответ: {selectedId ? optionMap[selectedId]?.text : '—'}</span>
                              <span>Правильно: {correctId ? optionMap[correctId]?.text : '—'}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  const correctId = correctIds[0];
                  const selectedId = answer.selected ? String(answer.selected) : null;
                  const isCorrect = selectedId && correctId && selectedId === correctId;
                  return (
                    <div className="assignment-card__answers">
                      <div className="assignment-card__answer-title">Правильный ответ</div>
                      <div className={`assignment-card__answer-row ${isCorrect ? 'assignment-card__answer-row--ok' : 'assignment-card__answer-row--bad'}`}>
                        <span className="assignment-card__answer-label">Ваш ответ:</span>
                        <span>{selectedId ? optionMap[selectedId]?.text : '—'}</span>
                        <span className="assignment-card__answer-label">Правильно:</span>
                        <span>{correctId ? optionMap[correctId]?.text : '—'}</span>
                      </div>
                    </div>
                  );
                })()
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

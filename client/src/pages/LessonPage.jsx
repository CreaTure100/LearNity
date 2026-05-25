import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';

export function LessonPage() {
  const { id: courseId, lessonId } = useParams();
  const { token, user } = useAuth();
  const canManage = user?.role === 'teacher' || user?.role === 'admin';

  const [lesson, setLesson] = useState(null);
  const [course, setCourse] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [answers, setAnswers] = useState({}); // { assignmentId: { selected, result } }
  const [error, setError] = useState('');

  const [assignmentForm, setAssignmentForm] = useState({
    prompt: '',
    options: 'A|B',
    correct_option_id: '0',
    score: 1,
  });

  const load = async () => {
    try {
      const [lessonData, assignData] = await Promise.all([
        http(`/lessons/${lessonId}`, { token }),
        http(`/lessons/${lessonId}/assignments`, { token }),
      ]);
      setLesson(lessonData);
      setAssignments(assignData);
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
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [lessonId, courseId, token]);

  const createAssignment = async (e) => {
    e.preventDefault();
    const options = assignmentForm.options
      .split('|')
      .map((text, index) => ({ id: String(index), text: text.trim() }))
      .filter((x) => x.text);

    await http(`/lessons/${lessonId}/assignments`, {
      method: 'POST',
      token,
      body: {
        prompt: assignmentForm.prompt,
        options,
        correct_option_id: assignmentForm.correct_option_id,
        score: Number(assignmentForm.score),
      },
    });
    setAssignmentForm({ prompt: '', options: 'A|B', correct_option_id: '0', score: 1 });
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
    await load();
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
          <a href={lesson.video_url} target="_blank" rel="noreferrer" className="lesson-page__video-link">
            ▶ Открыть видео
          </a>
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
            <input
              placeholder="Вопрос"
              value={assignmentForm.prompt}
              onChange={(e) => setAssignmentForm((s) => ({ ...s, prompt: e.target.value }))}
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
          <button type="submit">Создать задание</button>
        </form>
      )}

      <div className="lesson-page__assignments">
        <h3>Задания ({assignments.length})</h3>
        {assignments.length === 0 && <p className="muted">Заданий пока нет</p>}
        {assignments.map((a) => {
          const answer = answers[a.id];
          return (
            <div className={`assignment-card ${answer ? (answer.result.is_correct ? 'assignment-card--correct' : 'assignment-card--wrong') : ''}`} key={a.id}>
              <p className="assignment-card__prompt">{a.prompt}</p>
              <div className="assignment-card__score">Баллов: {a.score}</div>
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

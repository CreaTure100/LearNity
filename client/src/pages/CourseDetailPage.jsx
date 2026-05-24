import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';

export function CourseDetailPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const canManage = user?.role === 'teacher' || user?.role === 'admin';

  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [error, setError] = useState('');

  const [lessonForm, setLessonForm] = useState({ title: '', order_index: 1, description: '', video_url: '' });
  const [assignmentForm, setAssignmentForm] = useState({ prompt: '', options: 'A|B', correct_option_id: '0', score: 1 });
  const [activeLesson, setActiveLesson] = useState('');

  const load = async () => {
    try {
      const [courseData, lessonsData] = await Promise.all([
        http(`/courses/${id}`, { token }),
        http(`/courses/${id}/lessons`, { token }),
      ]);
      setCourse(courseData);
      setLessons(lessonsData);

      const assignmentEntries = await Promise.all(
        lessonsData.map(async (lesson) => [lesson.id, await http(`/lessons/${lesson.id}/assignments`, { token })]),
      );
      setAssignments(Object.fromEntries(assignmentEntries));
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [courseData, lessonsData] = await Promise.all([
          http(`/courses/${id}`, { token }),
          http(`/courses/${id}/lessons`, { token }),
        ]);
        if (cancelled) return;

        setCourse(courseData);
        setLessons(lessonsData);

        const assignmentEntries = await Promise.all(
          lessonsData.map(async (lesson) => [lesson.id, await http(`/lessons/${lesson.id}/assignments`, { token })]),
        );
        if (!cancelled) {
          setAssignments(Object.fromEntries(assignmentEntries));
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
  }, [id, token]);

  const createLesson = async (e) => {
    e.preventDefault();
    await http(`/courses/${id}/lessons`, { method: 'POST', token, body: { ...lessonForm, order_index: Number(lessonForm.order_index) } });
    setLessonForm({ title: '', order_index: 1, description: '', video_url: '' });
    await load();
  };

  const deleteLesson = async (lessonId) => {
    await http(`/lessons/${lessonId}`, { method: 'DELETE', token });
    await load();
  };

  const createAssignment = async (e) => {
    e.preventDefault();
    const options = assignmentForm.options.split('|').map((text, index) => ({ id: String(index), text: text.trim() })).filter((x) => x.text);
    await http(`/lessons/${activeLesson}/assignments`, {
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
    const result = await http(`/assignments/${assignmentId}/submit`, { method: 'POST', token, body: { selected_option_id } });
    alert(result.message);
    await load();
  };

  const deleteAssignment = async (assignmentId) => {
    await http(`/assignments/${assignmentId}`, { method: 'DELETE', token });
    await load();
  };

  return (
    <div>
      <h2>{course?.title || 'Курс'}</h2>
      {error && <p className="error">{error}</p>}

      {canManage && (
        <form className="card" onSubmit={createLesson}>
          <h3>Добавить урок</h3>
          <input placeholder="Название" value={lessonForm.title} onChange={(e) => setLessonForm((s) => ({ ...s, title: e.target.value }))} required />
          <input type="number" min="1" placeholder="Порядок" value={lessonForm.order_index} onChange={(e) => setLessonForm((s) => ({ ...s, order_index: e.target.value }))} required />
          <textarea placeholder="Описание" value={lessonForm.description} onChange={(e) => setLessonForm((s) => ({ ...s, description: e.target.value }))} />
          <input placeholder="Ссылка на видео" value={lessonForm.video_url} onChange={(e) => setLessonForm((s) => ({ ...s, video_url: e.target.value }))} />
          <button type="submit">Создать урок</button>
        </form>
      )}

      {canManage && (
        <form className="card" onSubmit={createAssignment}>
          <h3>Добавить задание</h3>
          <select value={activeLesson} onChange={(e) => setActiveLesson(e.target.value)} required>
            <option value="">Выберите урок</option>
            {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
          <input placeholder="Вопрос" value={assignmentForm.prompt} onChange={(e) => setAssignmentForm((s) => ({ ...s, prompt: e.target.value }))} required />
          <input placeholder="Варианты через |" value={assignmentForm.options} onChange={(e) => setAssignmentForm((s) => ({ ...s, options: e.target.value }))} required />
          <input placeholder="ID правильного варианта" value={assignmentForm.correct_option_id} onChange={(e) => setAssignmentForm((s) => ({ ...s, correct_option_id: e.target.value }))} required />
          <input type="number" min="0" value={assignmentForm.score} onChange={(e) => setAssignmentForm((s) => ({ ...s, score: e.target.value }))} />
          <button type="submit">Создать задание</button>
        </form>
      )}

      {lessons.map((lesson) => (
        <section key={lesson.id} className="card">
          <h3>{lesson.order_index}. {lesson.title}</h3>
          <p>{lesson.description}</p>
          {lesson.video_url && <a href={lesson.video_url} target="_blank" rel="noreferrer">Открыть видео</a>}
          {canManage && <button className="danger" onClick={() => deleteLesson(lesson.id)}>Удалить урок</button>}

          <h4>Задания</h4>
          {(assignments[lesson.id] || []).map((assignment) => (
            <div className="assignment" key={assignment.id}>
              <p>{assignment.prompt}</p>
              <div className="inline-actions">
                {assignment.options.map((option) => (
                  <button key={option.id} className="secondary" onClick={() => submitAnswer(assignment.id, option.id)}>{option.text}</button>
                ))}
                {canManage && <button className="danger" onClick={() => deleteAssignment(assignment.id)}>Удалить</button>}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';

export function CoursesPage() {
  const { token, user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', description: '' });

  const canManage = user?.role === 'teacher' || user?.role === 'admin';

  const load = async () => {
    try {
      setCourses(await http('/courses', { token }));
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await http('/courses', { token });
        if (!cancelled) {
          setCourses(data);
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

  const createCourse = async (e) => {
    e.preventDefault();
    await http('/courses', { method: 'POST', token, body: form });
    setForm({ title: '', description: '' });
    await load();
  };

  const removeCourse = async (id) => {
    await http(`/courses/${id}`, { method: 'DELETE', token });
    await load();
  };

  return (
    <div>
      <h2>Курсы</h2>
      {error && <p className="error">{error}</p>}
      {canManage && (
        <form className="card" onSubmit={createCourse}>
          <h3>Создать курс</h3>
          <input placeholder="Название" value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} required />
          <textarea placeholder="Описание" value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} />
          <button type="submit">Создать</button>
        </form>
      )}

      <div className="course-grid">
        {[...courses].reverse().map((course) => {
          const uiTitle =
            course.ui_title ||
            (course.level ? `УРОВЕНЬ ${course.level}.\n${course.title}` : course.title);

          const variant = course.ui_variant || 'peach';

          return (
            <article key={course.id} className="course-item">
              <Link
                to={`/courses/${course.id}`}
                className={`course-tile tile--${variant}`}
              >
                <div className="course-tile__clip" aria-hidden="true" />
                <div className="course-tile__title">{uiTitle}</div>
              </Link>

              {canManage && (
                <div className="course-admin">
                  <button className="danger" onClick={() => removeCourse(course.id)}>
                    Удалить
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

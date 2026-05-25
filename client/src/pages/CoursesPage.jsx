import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';
import { CourseEditorModal } from '../components/CourseEditorModal';

export function CoursesPage() {
  const { token, user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);

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

  const createCourse = async (data) => {
    await http('/courses', { method: 'POST', token, body: data });
    setShowCreate(false);
    await load();
  };

  const updateCourse = async (data) => {
    await http(`/courses/${editingCourse.id}`, { method: 'PATCH', token, body: data });
    setEditingCourse(null);
    await load();
  };

  const removeCourse = async (id) => {
    if (!confirm('Удалить курс со всеми модулями и уроками?')) return;
    await http(`/courses/${id}`, { method: 'DELETE', token });
    await load();
  };

  return (
    <div>
      <div className="page-header">
        <h2>Курсы</h2>
        {canManage && (
          <button onClick={() => setShowCreate(true)}>+ Создать курс</button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

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
                  <button className="btn-icon" onClick={() => setEditingCourse(course)} title="Настроить">
                    ⚙️
                  </button>
                  <button className="danger" onClick={() => removeCourse(course.id)}>
                    Удалить
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Create modal */}
      {showCreate && (
        <CourseEditorModal course={null} onSave={createCourse} onClose={() => setShowCreate(false)} />
      )}

      {/* Edit modal */}
      {editingCourse && (
        <CourseEditorModal course={editingCourse} onSave={updateCourse} onClose={() => setEditingCourse(null)} />
      )}
    </div>
  );
}

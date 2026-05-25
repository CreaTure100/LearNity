import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';
import { CourseEditorModal } from '../components/CourseEditorModal';
import { ModuleEditorModal } from '../components/ModuleEditorModal';
import { LessonEditorModal } from '../components/LessonEditorModal';

/** Склонение слова по числу: plural(3, 'урок', 'урока', 'уроков') */
function plural(n, one, two, five) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return `${n} ${five}`;
  if (last > 1 && last < 5) return `${n} ${two}`;
  if (last === 1) return `${n} ${one}`;
  return `${n} ${five}`;
}

export function CourseDetailPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const canManage = user?.role === 'teacher' || user?.role === 'admin';

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [lessonsByModule, setLessonsByModule] = useState({});
  const [error, setError] = useState('');
  const [expandedModules, setExpandedModules] = useState({});

  // Modals
  const [showCourseEditor, setShowCourseEditor] = useState(false);
  const [editingModule, setEditingModule] = useState(undefined); // undefined = closed, null = new, obj = editing
  const [editingLesson, setEditingLesson] = useState(undefined);
  const [lessonTargetModuleId, setLessonTargetModuleId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [courseData, modulesData] = await Promise.all([
        http(`/courses/${id}`, { token }),
        http(`/courses/${id}/modules`, { token }),
      ]);
      setCourse(courseData);
      setModules(modulesData);

      // Load lessons for each module
      const entries = await Promise.all(
        modulesData.map(async (mod) => {
          const lessons = await http(`/modules/${mod.id}/lessons`, { token });
          return [mod.id, lessons];
        }),
      );
      setLessonsByModule(Object.fromEntries(entries));

      // Auto-expand all modules
      const expanded = {};
      modulesData.forEach((m) => { expanded[m.id] = true; });
      setExpandedModules((prev) => ({ ...expanded, ...prev }));
    } catch (err) {
      setError(err.message);
    }
  }, [id, token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
    })();
    return () => { cancelled = true; };
  }, [load]);

  const toggleModule = (moduleId) => {
    setExpandedModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  /* ---- Course actions ---- */
  const saveCourse = async (data) => {
    if (course) {
      await http(`/courses/${id}`, { method: 'PATCH', token, body: data });
    } else {
      await http('/courses', { method: 'POST', token, body: data });
    }
    setShowCourseEditor(false);
    await load();
  };

  /* ---- Module actions ---- */
  const saveModule = async (data) => {
    if (editingModule && editingModule.id) {
      await http(`/modules/${editingModule.id}`, { method: 'PATCH', token, body: data });
    } else {
      await http(`/courses/${id}/modules`, { method: 'POST', token, body: data });
    }
    setEditingModule(undefined);
    await load();
  };

  const deleteModule = async (moduleId) => {
    if (!confirm('Удалить модуль со всеми уроками?')) return;
    await http(`/modules/${moduleId}`, { method: 'DELETE', token });
    await load();
  };

  /* ---- Lesson actions ---- */
  const saveLesson = async (data) => {
    if (editingLesson && editingLesson.id) {
      await http(`/lessons/${editingLesson.id}`, { method: 'PATCH', token, body: data });
    } else {
      await http(`/modules/${lessonTargetModuleId}/lessons`, { method: 'POST', token, body: data });
    }
    setEditingLesson(undefined);
    setLessonTargetModuleId(null);
    await load();
  };

  const deleteLesson = async (lessonId) => {
    if (!confirm('Удалить урок?')) return;
    await http(`/lessons/${lessonId}`, { method: 'DELETE', token });
    await load();
  };

  /* ---- Helpers ---- */
  const LESSON_VARIANTS = {
    sky:    { paper: '#a8d8ea', under: '#aa96da' },
    mint:   { paper: '#a8e6cf', under: '#dcedc1' },
    peach:  { paper: '#ffd3b6', under: '#ffaaa5' },
    lilac:  { paper: '#d4a5f5', under: '#f0c6ff' },
    lemon:  { paper: '#fff5a0', under: '#ffc97e' },
  };

  const MODULE_VARIANTS = ['blue', 'green', 'lavender', 'sand', 'pink'];

  const totalLessons = Object.values(lessonsByModule).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="course-detail">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link to="/courses">Курсы</Link>
        <span className="breadcrumb__sep">›</span>
        <span>{course?.title || '...'}</span>
      </div>

      {/* Course header */}
      <div className="course-detail__header">
        <div className="course-detail__info">
          <h2>{course?.title || 'Курс'}</h2>
          {course?.description && <p>{course.description}</p>}
          <div className="course-detail__badges">
            {course?.level && <span className="course-detail__level">{course.level}</span>}
            <span className="course-detail__badge">{plural(modules.length, 'модуль', 'модуля', 'модулей')}</span>
            <span className="course-detail__badge">{plural(totalLessons, 'урок', 'урока', 'уроков')}</span>
          </div>
        </div>
        {canManage && (
          <div className="course-detail__actions">
            <button className="btn-icon" onClick={() => setShowCourseEditor(true)} title="Настроить курс">⚙️</button>
            <button onClick={() => setEditingModule(null)}>+ Модуль</button>
          </div>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {/* Modules */}
      <div className="module-grid">
        {modules.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">📚</div>
            <p>Модулей пока нет</p>
            {canManage && <button onClick={() => setEditingModule(null)}>Создать первый модуль</button>}
          </div>
        )}
        {modules.map((mod, mi) => {
          const variant = mod.ui_variant || MODULE_VARIANTS[mi % MODULE_VARIANTS.length];
          const modTitle = mod.ui_title || mod.title;
          const lessons = lessonsByModule[mod.id] || [];
          const isExpanded = expandedModules[mod.id];

          return (
            <div key={mod.id} className={`module-section ${isExpanded ? 'module-section--expanded' : ''}`}>
              {/* Module tile */}
              <div
                className={`module-tile module--${variant}`}
                onClick={() => toggleModule(mod.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleModule(mod.id)}
              >
                <div className="module-tile__pin" aria-hidden="true" />
                <div className="module-tile__title">{modTitle}</div>
                <div className="module-tile__meta">
                  {mod.description && <p className="module-tile__desc">{mod.description}</p>}
                  <span className="module-tile__count">{plural(lessons.length, 'урок', 'урока', 'уроков')}</span>
                  <span className={`module-tile__chevron ${isExpanded ? 'module-tile__chevron--open' : ''}`}>▼</span>
                </div>
                {canManage && (
                  <div className="module-tile__admin" onClick={(e) => e.stopPropagation()}>
                    <button className="btn-icon-sm" onClick={() => setEditingModule(mod)} title="Настроить">⚙️</button>
                    <button className="btn-icon-sm danger-icon" onClick={() => deleteModule(mod.id)} title="Удалить">🗑</button>
                  </div>
                )}
              </div>

              {/* Expanded: lessons list */}
              {isExpanded && (
                <div className="lesson-list">
                  {canManage && (
                    <button
                      className="lesson-add-btn"
                      onClick={() => { setLessonTargetModuleId(mod.id); setEditingLesson(null); }}
                    >
                      + Добавить урок
                    </button>
                  )}
                  {lessons.length === 0 && <p className="muted lesson-empty">Уроков пока нет</p>}
                  {lessons.map((lesson) => {
                    const lVar = lesson.ui_variant || 'sky';
                    const colors = LESSON_VARIANTS[lVar] || LESSON_VARIANTS.sky;
                    const lTitle = lesson.ui_title || lesson.title;

                    return (
                      <div key={lesson.id} className="lesson-tile-wrap">
                        <Link
                          to={`/courses/${id}/lessons/${lesson.id}`}
                          className="lesson-tile"
                          style={{
                            '--l-paper': colors.paper,
                            '--l-under': colors.under,
                          }}
                        >
                          <span className="lesson-tile__index">{lesson.order_index}</span>
                          <span className="lesson-tile__title">{lTitle}</span>
                          {lesson.description && (
                            <span className="lesson-tile__desc">{lesson.description}</span>
                          )}
                        </Link>
                        {canManage && (
                          <div className="lesson-tile__admin">
                            <button className="btn-icon-sm" onClick={() => setEditingLesson(lesson)} title="Настроить">⚙️</button>
                            <button className="btn-icon-sm danger-icon" onClick={() => deleteLesson(lesson.id)} title="Удалить">🗑</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {showCourseEditor && (
        <CourseEditorModal course={course} onSave={saveCourse} onClose={() => setShowCourseEditor(false)} />
      )}
      {editingModule !== undefined && (
        <ModuleEditorModal module={editingModule} onSave={saveModule} onClose={() => setEditingModule(undefined)} />
      )}
      {editingLesson !== undefined && (
        <LessonEditorModal lesson={editingLesson} onSave={saveLesson} onClose={() => { setEditingLesson(undefined); setLessonTargetModuleId(null); }} />
      )}
    </div>
  );
}

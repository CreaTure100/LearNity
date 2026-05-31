import { useEffect, useState } from 'react';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';

export function DashboardPage() {
  const { token, user } = useAuth();
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';
  const [stats, setStats] = useState(null);
  const [studentStats, setStudentStats] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isTeacher) {
          const statsData = await http('/stats/students', { token });
          if (!cancelled) {
            setStudentStats(statsData.students || []);
            setStats(null);
            setError('');
          }
        } else {
          const statsData = await http('/stats/my', { token });
          if (!cancelled) {
            setStats(statsData);
            setStudentStats([]);
            setError('');
          }
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

  const buildPercent = (completed, total) => {
    if (!total) return 0;
    return Math.round((completed / total) * 100);
  };

  const metrics = stats ? [
    {
      label: 'Выученные слова',
      completed: stats.learned_words_total,
      total: stats.total_words,
      tone: 'words',
    },
    {
      label: 'Выполненные задания',
      completed: stats.completed_assignments,
      total: stats.total_assignments,
      tone: 'assignments',
    },
    {
      label: 'Пройденные уроки',
      completed: stats.completed_lessons,
      total: stats.total_lessons,
      tone: 'lessons',
    },
    {
      label: 'Пройденные модули',
      completed: stats.completed_modules,
      total: stats.total_modules,
      tone: 'modules',
    },
    {
      label: 'Пройденные курсы',
      completed: stats.completed_courses,
      total: stats.total_courses,
      tone: 'courses',
    },
  ] : [];

  return (
    <div>
      <h2>{isTeacher ? 'Дашборд преподавателя' : 'Дашборд студента'}</h2>
      {error && <p className="error">{error}</p>}
      {isTeacher ? (
        <section className="card">
          <h3>Статистика учеников</h3>
          {studentStats.length ? (
            <div className="stats-table-wrap">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Ученик</th>
                    <th>Слова</th>
                    <th>Задания</th>
                    <th>Уроки</th>
                    <th>Модули</th>
                    <th>Курсы</th>
                    <th>Повторы сегодня</th>
                  </tr>
                </thead>
                <tbody>
                  {studentStats.map((student) => (
                    <tr key={student.user_id}>
                      <td>
                        <div className="stats-student">
                          <strong>{student.login}</strong>
                          <span className="muted">{student.email}</span>
                        </div>
                      </td>
                      <td className="stats-cell">{student.learned_words_total}/{student.total_words}</td>
                      <td className="stats-cell">{student.completed_assignments}/{student.total_assignments}</td>
                      <td className="stats-cell">{student.completed_lessons}/{student.total_lessons}</td>
                      <td className="stats-cell">{student.completed_modules}/{student.total_modules}</td>
                      <td className="stats-cell">{student.completed_courses}/{student.total_courses}</td>
                      <td className="stats-cell">{student.repeated_today}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">Пока нет данных по ученикам.</p>
          )}
        </section>
      ) : stats && (
        <section className="stats-progress">
          {metrics.map((metric) => {
            const percent = buildPercent(metric.completed, metric.total);
            return (
              <article className={`card progress-card progress-card--${metric.tone}`} key={metric.label}>
                <div className="progress-card__header">
                  <h3>{metric.label}</h3>
                  <strong>{percent}% · {metric.completed}/{metric.total}</strong>
                </div>
                <div className="progress-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                  <div className="progress-bar__fill" style={{ width: `${percent}%` }} />
                </div>
                <div className="progress-meta">Прогресс по категории</div>
              </article>
            );
          })}

          <article className="card progress-card">
            <div className="progress-card__header">
              <h3>Повторено сегодня</h3>
              <strong>{stats.repeated_today}</strong>
            </div>
            <div className="progress-meta">Количество повторений за сегодня</div>
          </article>
        </section>
      )}
    </div>
  );
}

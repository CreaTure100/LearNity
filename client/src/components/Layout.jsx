import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>LearNity</h1>
        <p className="role">Роль: {user?.role}</p>
        <nav>
          <NavLink to="/">Дашборд</NavLink>
          <NavLink to="/courses">Курсы</NavLink>
          <NavLink to="/dictionary">Словарь</NavLink>
        </nav>
        <button onClick={logout} className="secondary">Выйти</button>
      </aside>
      <main className="content">
        <header>
          <Link to="/" className="brand">Платформа изучения английского</Link>
        </header>
        <Outlet />
      </main>
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', login: '', password: '', role: 'student' });
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-page">
      <form onSubmit={onSubmit} className="card auth-card">
        <h2>Регистрация</h2>
        {error && <p className="error">{error}</p>}
        <input placeholder="Email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
        <input placeholder="Login" value={form.login} onChange={(e) => setForm((s) => ({ ...s, login: e.target.value }))} />
        <input type="password" placeholder="Пароль" value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} />
        <select value={form.role} onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}>
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit">Создать аккаунт</button>
        <p>Уже есть аккаунт? <Link to="/login">Войти</Link></p>
      </form>
    </div>
  );
}

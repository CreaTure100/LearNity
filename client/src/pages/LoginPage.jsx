import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ login: '', password: '' });
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(form.login, form.password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-page">
      <form onSubmit={onSubmit} className="card auth-card">
        <h2>Вход</h2>
        {error && <p className="error">{error}</p>}
        <input placeholder="Login или Email" value={form.login} onChange={(e) => setForm((s) => ({ ...s, login: e.target.value }))} />
        <input type="password" placeholder="Пароль" value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} />
        <button type="submit">Войти</button>
        <p>Нет аккаунта? <Link to="/register">Регистрация</Link></p>
      </form>
    </div>
  );
}

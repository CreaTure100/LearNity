/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useReducer } from 'react';
import { http } from '../api/http';

const AuthContext = createContext(null);

const initialState = {
  token: localStorage.getItem('token'),
  user: (() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  })(),
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      return { token: action.payload.token, user: action.payload.user };
    case 'LOGOUT':
      return { token: null, user: null };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const value = useMemo(
    () => ({
      token: state.token,
      user: state.user,
      isAuthenticated: Boolean(state.token),
      login: async (login, password) => {
        const data = await http('/auth/login', { method: 'POST', body: { login, password } });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        dispatch({ type: 'LOGIN', payload: data });
      },
      register: async (payload) => {
        const data = await http('/auth/register', { method: 'POST', body: payload });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        dispatch({ type: 'LOGIN', payload: data });
      },
      logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        dispatch({ type: 'LOGOUT' });
      },
    }),
    [state.token, state.user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

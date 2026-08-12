import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null));
  }, []);

  async function login(email, password) {
    const u = await api.login(email, password);
    setUser(u);
  }

  async function register(email, password) {
    const u = await api.register(email, password);
    setUser(u);
  }

  async function logout() {
    await api.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

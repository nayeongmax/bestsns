import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from './types';
import * as store from './store';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, nickname: string, password: string) => Promise<void>;
  logout: () => void;
}

const SESSION_KEY = 'community-platform-session';
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = localStorage.getItem(SESSION_KEY);
    if (id) {
      store.getUser(id).then((u) => {
        if (u) setUser(u);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const persist = (u: User) => {
    setUser(u);
    localStorage.setItem(SESSION_KEY, u.id);
  };

  const login = async (email: string, password: string) => {
    const u = await store.authenticate(email, password);
    persist(u);
  };

  const signup = async (email: string, nickname: string, password: string) => {
    const u = await store.createUser(email, nickname, password);
    persist(u);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

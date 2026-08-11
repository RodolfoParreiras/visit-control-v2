import React, { createContext, useContext, useEffect, useState } from 'react';
import { useGetCurrentUser } from '@visit-control/api-client';
import type { User } from '@visit-control/api-client';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  updateUser: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  
  const { data: currentUser, isLoading: isQueryLoading, error } = useGetCurrentUser({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { enabled: !!token, retry: false } as any,
  });

  useEffect(() => {
    if (currentUser) {
      setUser(currentUser);
    }
  }, [currentUser]);

  useEffect(() => {
    if (error) {
      logout();
    }
  }, [error]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  // A consulta pode terminar antes de o efeito acima sincronizar `user` com o
  // estado local. Usar a resposta diretamente evita que a rota privada veja
  // um instante em que não há carregamento nem usuário e redirecione ao login.
  const authenticatedUser = user ?? currentUser;
  const isLoading = !!token && isQueryLoading && !authenticatedUser;

  return (
    <AuthContext.Provider value={{ user: authenticatedUser ?? null, isLoading, login, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

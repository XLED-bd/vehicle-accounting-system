/**
 * Контекст авторизации
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserResponse } from '../types/api';
import { authService } from '../services/authService';

interface AuthContextType {
  user: UserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: () => boolean;
  isOperator: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Загрузка данных пользователя при монтировании
  useEffect(() => {
    const loadUser = async () => {
      const token = authService.getToken();
      if (token) {
        try {
          const userData = await authService.getCurrentUser();
          setUser(userData);
        } catch (error) {
          console.error('Failed to load user:', error);
          authService.logout();
        }
      }
      setIsLoading(false);
    };

    loadUser();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const tokenData = await authService.login({ username, password });
      authService.setToken(tokenData.access_token);
      
      // Получаем информацию о пользователе
      const userData = await authService.getCurrentUser();
      setUser(userData);
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const isAdmin = () => {
    return user?.role === 'administrator';
  };

  const isOperator = () => {
    return user?.role === 'operator';
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    isAdmin,
    isOperator,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Компоненты защищенных маршрутов
 */
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Защищенный маршрут - требует авторизации
 */
export const PrivateRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="loading">Загрузка...</div>;
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

/**
 * Маршрут только для администратора
 */
export const AdminRoute: React.FC = () => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return <div className="loading">Загрузка...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return isAdmin() ? <Outlet /> : <Navigate to="/" replace />;
};

/**
 * Публичный маршрут - только для неавторизованных
 */
export const PublicRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="loading">Загрузка...</div>;
  }

  return isAuthenticated ? <Navigate to="/" replace /> : <Outlet />;
};

/**
 * Главный Layout приложения с навигацией
 */
import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Layout.css';

export const Layout: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <h1>Контроль Въезда/Выезда</h1>
          </div>
          <div className="user-info">
            <span className="user-name">{user?.username}</span>
            <span className="user-role">
              {user?.role === 'administrator' ? '👑 Администратор' : '👤 Оператор'}
            </span>
            <button onClick={handleLogout} className="btn-logout">
              Выход
            </button>
          </div>
        </div>
      </header>

      <div className="main-container">
        <aside className="sidebar">
          <nav className="nav">
            <Link to="/" className="nav-link">
              <span className="nav-icon"></span>
              <span>Главная</span>
            </Link>
            
            <Link to="/events" className="nav-link">
              <span className="nav-icon"></span>
              <span>Мониторинг проездов</span>
            </Link>

            <Link to="/video" className="nav-link">
              <span className="nav-icon"></span>
              <span>Загрузка видео</span>
            </Link>

            <Link to="/image" className="nav-link">
              <span className="nav-icon"></span>
              <span>Фото номера</span>
            </Link>

            <Link to="/vehicles" className="nav-link">
              <span className="nav-icon"></span>
              <span>Автомобили</span>
            </Link>

            <Link to="/employees" className="nav-link">
              <span className="nav-icon"></span>
              <span>Сотрудники</span>
            </Link>

            <Link to="/access" className="nav-link">
              <span className="nav-icon"></span>
              <span>Доступы</span>
            </Link>

            {isAdmin() && (
              <Link to="/users" className="nav-link">
                <span className="nav-icon"></span>
                <span>Пользователи</span>
              </Link>
            )}

            <Link to="/about" className="nav-link nav-link-about">
              <span className="nav-icon"></span>
              <span>О приложении</span>
            </Link>
          </nav>
        </aside>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

/**
 * Главный компонент приложения с роутингом
 */
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { PrivateRoute, PublicRoute, AdminRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { EventsPage } from './pages/EventsPage';
import { VideoUploadPage } from './pages/VideoUploadPage';
import { VehiclesPage } from './pages/VehiclesPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { AccessPage } from './pages/AccessPage';
import { UsersPage } from './pages/UsersPage';
import { ImageUploadPage } from './pages/ImageUploadPage';
import { AboutPage } from './pages/AboutPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Публичные маршруты */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Защищенные маршруты */}
          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/video" element={<VideoUploadPage />} />
              <Route path="/vehicles" element={<VehiclesPage />} />
              <Route path="/employees" element={<EmployeesPage />} />
              <Route path="/access" element={<AccessPage />} />
              <Route path="/image" element={<ImageUploadPage />} />
              <Route path="/about" element={<AboutPage />} />
            </Route>
          </Route>

          {/* Маршруты только для администратора */}
          <Route element={<AdminRoute />}>
            <Route element={<Layout />}>
              <Route path="/users" element={<UsersPage />} />
            </Route>
          </Route>

          {/* Перенаправление на главную */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

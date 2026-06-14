/**
 * Сервис авторизации
 */
import { apiClient } from './api';
import { LoginRequest, Token, UserResponse } from '../types/api';

export const authService = {
  /**
   * Вход в систему
   */
  async login(credentials: LoginRequest): Promise<Token> {
    const response = await apiClient.post<Token>('/auth/login/json', credentials);
    return response.data;
  },

  /**
   * Получение информации о текущем пользователе
   */
  async getCurrentUser(): Promise<UserResponse> {
    const response = await apiClient.get<UserResponse>('/auth/me');
    return response.data;
  },

  /**
   * Выход из системы
   */
  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  },

  /**
   * Сохранение токена
   */
  setToken(token: string): void {
    localStorage.setItem('access_token', token);
  },

  /**
   * Получение токена
   */
  getToken(): string | null {
    return localStorage.getItem('access_token');
  },

  /**
   * Проверка авторизации
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};

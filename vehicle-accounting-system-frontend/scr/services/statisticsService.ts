/**
 * Сервис для статистики
 */
import { apiClient } from './api';
import { StatisticsResponse } from '../types/api';

export const statisticsService = {
  /**
   * Получение общей статистики
   */
  async getStatistics(): Promise<StatisticsResponse> {
    const response = await apiClient.get<StatisticsResponse>('/statistics');
    return response.data;
  },
};

/**
 * Сервис для работы с пользователями (только для администратора)
 */
import { UserResponse, UserCreate, UserUpdate, PaginationParams } from '../types/api';

export const usersService = {
  /**
   * Получение списка пользователей
   */
  async getUsers(params?: PaginationParams): Promise<UserResponse[]> {
    const response = await apiClient.get<UserResponse[]>('/users', { params });
    return response.data;
  },

  /**
   * Получение пользователя по ID
   */
  async getUser(id: number): Promise<UserResponse> {
    const response = await apiClient.get<UserResponse>(`/users/${id}`);
    return response.data;
  },

  /**
   * Создание пользователя
   */
  async createUser(data: UserCreate): Promise<UserResponse> {
    const response = await apiClient.post<UserResponse>('/users', data);
    return response.data;
  },

  /**
   * Обновление пользователя
   */
  async updateUser(id: number, data: UserUpdate): Promise<UserResponse> {
    const response = await apiClient.put<UserResponse>(`/users/${id}`, data);
    return response.data;
  },

  /**
   * Удаление пользователя
   */
  async deleteUser(id: number): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  },
};

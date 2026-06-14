/**
 * Сервис для работы с сотрудниками
 */
import { apiClient } from './api';
import {
  EmployeeResponse,
  EmployeeCreate,
  EmployeeUpdate,
  PaginationParams,
} from '../types/api';

export const employeesService = {
  /**
   * Получение списка сотрудников
   */
  async getEmployees(params?: PaginationParams): Promise<EmployeeResponse[]> {
    const response = await apiClient.get<EmployeeResponse[]>('/employees', { params });
    return response.data;
  },

  /**
   * Получение сотрудника по ID
   */
  async getEmployee(id: number): Promise<EmployeeResponse> {
    const response = await apiClient.get<EmployeeResponse>(`/employees/${id}`);
    return response.data;
  },

  /**
   * Поиск сотрудников по имени
   */
  async searchEmployees(name: string): Promise<EmployeeResponse[]> {
    const response = await apiClient.get<EmployeeResponse[]>('/employees/search/by-name', {
      params: { name },
    });
    return response.data;
  },

  /**
   * Создание сотрудника
   */
  async createEmployee(data: EmployeeCreate): Promise<EmployeeResponse> {
    const response = await apiClient.post<EmployeeResponse>('/employees', data);
    return response.data;
  },

  /**
   * Обновление сотрудника
   */
  async updateEmployee(id: number, data: EmployeeUpdate): Promise<EmployeeResponse> {
    const response = await apiClient.put<EmployeeResponse>(`/employees/${id}`, data);
    return response.data;
  },

  /**
   * Удаление сотрудника
   */
  async deleteEmployee(id: number): Promise<void> {
    await apiClient.delete(`/employees/${id}`);
  },
};

/**
 * Сервис для работы с доступами
 */
import { apiClient } from './api';
import {
  AccessResponse,
  AccessWithVehicle,
  AccessCreate,
  AccessUpdate,
  PaginationParams,
} from '../types/api';

export const accessService = {
  /**
   * Получение списка доступов
   */
  async getAccesses(params?: PaginationParams & {
    is_active?: boolean;
    vehicle_id?: number;
  }): Promise<AccessWithVehicle[]> {
    const response = await apiClient.get<AccessWithVehicle[]>('/access', { params });
    return response.data;
  },

  /**
   * Получение активных доступов
   */
  async getActiveAccesses(): Promise<AccessWithVehicle[]> {
    const response = await apiClient.get<AccessWithVehicle[]>('/access/active');
    return response.data;
  },

  /**
   * Получение истекших доступов
   */
  async getExpiredAccesses(): Promise<AccessWithVehicle[]> {
    const response = await apiClient.get<AccessWithVehicle[]>('/access/expired');
    return response.data;
  },

  /**
   * Получение доступа по ID
   */
  async getAccess(id: number): Promise<AccessWithVehicle> {
    const response = await apiClient.get<AccessWithVehicle>(`/access/${id}`);
    return response.data;
  },

  /**
   * Получение доступов для автомобиля
   */
  async getVehicleAccesses(vehicleId: number): Promise<AccessResponse[]> {
    const response = await apiClient.get<AccessResponse[]>(`/access/vehicle/${vehicleId}/accesses`);
    return response.data;
  },

  /**
   * Создание доступа
   */
  async createAccess(data: AccessCreate): Promise<AccessResponse> {
    const response = await apiClient.post<AccessResponse>('/access', data);
    return response.data;
  },

  /**
   * Обновление доступа
   */
  async updateAccess(id: number, data: AccessUpdate): Promise<AccessResponse> {
    const response = await apiClient.put<AccessResponse>(`/access/${id}`, data);
    return response.data;
  },

  /**
   * Удаление доступа
   */
  async deleteAccess(id: number): Promise<void> {
    await apiClient.delete(`/access/${id}`);
  },

  /**
   * Деактивация доступа
   */
  async deactivateAccess(id: number): Promise<AccessResponse> {
    const response = await apiClient.post<AccessResponse>(`/access/${id}/deactivate`);
    return response.data;
  },

  /**
   * Активация доступа
   */
  async activateAccess(id: number): Promise<AccessResponse> {
    const response = await apiClient.post<AccessResponse>(`/access/${id}/activate`);
    return response.data;
  },
};

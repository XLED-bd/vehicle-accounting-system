/**
 * Сервис для работы с автомобилями
 */
import { apiClient } from './api';
import {
  VehicleResponse,
  VehicleWithEmployee,
  VehicleCreate,
  VehicleUpdate,
  PaginationParams,
} from '../types/api';

export const vehiclesService = {
  /**
   * Получение списка автомобилей
   */
  async getVehicles(params?: PaginationParams & {
    on_territory?: boolean;
    is_guest?: boolean;
  }): Promise<VehicleWithEmployee[]> {
    const response = await apiClient.get<VehicleWithEmployee[]>('/vehicles', { params });
    return response.data;
  },

  /**
   * Получение автомобиля по ID
   */
  async getVehicle(id: number): Promise<VehicleWithEmployee> {
    const response = await apiClient.get<VehicleWithEmployee>(`/vehicles/${id}`);
    return response.data;
  },

  /**
   * Получение автомобиля по номеру
   */
  async getVehicleByPlate(plateNumber: string): Promise<VehicleWithEmployee> {
    const response = await apiClient.get<VehicleWithEmployee>(`/vehicles/plate/${plateNumber}`);
    return response.data;
  },

  /**
   * Получение автомобилей на территории
   */
  async getVehiclesOnTerritory(): Promise<VehicleWithEmployee[]> {
    const response = await apiClient.get<VehicleWithEmployee[]>('/vehicles/on-territory');
    return response.data;
  },

  /**
   * Создание автомобиля
   */
  async createVehicle(data: VehicleCreate): Promise<VehicleResponse> {
    const response = await apiClient.post<VehicleResponse>('/vehicles', data);
    return response.data;
  },

  /**
   * Обновление автомобиля
   */
  async updateVehicle(id: number, data: VehicleUpdate): Promise<VehicleResponse> {
    const response = await apiClient.put<VehicleResponse>(`/vehicles/${id}`, data);
    return response.data;
  },

  /**
   * Удаление автомобиля
   */
  async deleteVehicle(id: number): Promise<void> {
    await apiClient.delete(`/vehicles/${id}`);
  },
};

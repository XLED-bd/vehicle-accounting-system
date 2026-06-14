/**
 * Сервис для работы с событиями проезда
 */
import { apiClient } from './api';
import {
  PassResponse,
  EventResponse,
  PassStatus,
  PaginationParams,
} from '../types/api';

export const eventsService = {
  /**
   * Получение списка всех событий
   */
  async getAllEvents(params?: {
    skip?: number;
    limit?: number;
    status_filter?: PassStatus;
    registered_only?: boolean;
  }): Promise<PassResponse[]> {
    const response = await apiClient.get<PassResponse[]>('/events', { params });
    return response.data;
  },

  /**
   * Получение события по UUID
   */
  async getEventByUuid(uuid: string): Promise<EventResponse> {
    const response = await apiClient.get<EventResponse>(`/events/${uuid}`);
    return response.data;
  },

  /**
   * Получение незарегистрированных проездов
   */
  async getUnregisteredEvents(limit: number = 50): Promise<PassResponse[]> {
    const response = await apiClient.get<PassResponse[]>('/events/recent/unregistered', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Получение проездов по номеру автомобиля
   */
  async getEventsByPlate(
    plateNumber: string,
    params?: PaginationParams
  ): Promise<PassResponse[]> {
    const response = await apiClient.get<PassResponse[]>(
      `/events/vehicle/${plateNumber}`,
      { params }
    );
    return response.data;
  },
};

/**
 * Сервис для обработки видео
 */
import { apiClient } from './api';
import { VideoProcessResponse } from '../types/api';

export interface VideoStatusResponse {
  uuid: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  plate_number: string | null;
  direction: 'entry' | 'exit' | 'unknown' | null;
  confidence: number | null;
  is_registered: boolean;
  processing_time: number | null;
  logs: string | null;
  has_frame: boolean;
  created_at: string;
  updated_at: string | null;
}

export const videoService = {
  /**
   * Отправка видео на обработку
   */
  async processVideo(file: File): Promise<VideoProcessResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<VideoProcessResponse>('/video', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Получение статуса обработки видео
   */
  async getVideoStatus(uuid: string): Promise<VideoStatusResponse> {
    const response = await apiClient.get<VideoStatusResponse>(`/video/status/${uuid}`);
    return response.data;
  },

  /**
   * Загружает лучший аннотированный кадр как blob-URL для отображения в <img>.
   * Делает авторизованный запрос, поскольку эндпоинт защищён JWT.
   */
  async getVideoFrameBlobUrl(uuid: string): Promise<string> {
    const response = await apiClient.get(`/video/frame/${uuid}`, {
      responseType: 'blob',
    });
    return URL.createObjectURL(response.data);
  },
};

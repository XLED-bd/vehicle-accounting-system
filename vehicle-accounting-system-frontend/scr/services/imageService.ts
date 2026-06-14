/**
 * Сервис для обработки изображений с номерными знаками
 */
import { apiClient } from './api';

export interface ImageProcessResponse {
  plate_number: string | null;
  confidence: number;
  vehicle_found: boolean;
  on_territory: boolean | null;
  annotated_image: string | null;
  message: string;
}

export const imageService = {
  /**
   * Отправляет изображение на обработку.
   * Возвращает аннотированное изображение (base64) и метаданные.
   */
  processImage: async (file: File): Promise<ImageProcessResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<ImageProcessResponse>('/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return response.data;
  },
};

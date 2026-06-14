/**
 * Страница распознавания номерного знака по изображению
 */
import React, { useState, useRef } from 'react';
import { imageService, ImageProcessResponse } from '../services/imageService';
import { handleApiError } from '../services/api';
import './CommonPages.css';
import './ImageUploadPage.css';

export const ImageUploadPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImageProcessResponse | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setError('');
    setResult(null);

    if (selected) {
      const objectUrl = URL.createObjectURL(selected);
      setPreview(objectUrl);
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await imageService.processImage(file);
      setResult(response);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const territoryBadge = (on_territory: boolean | null) => {
    if (on_territory === null) return null;
    return on_territory ? (
      <span className="badge badge-entry">На территории</span>
    ) : (
      <span className="badge badge-exit">Покинул территорию</span>
    );
  };

  return (
    <div className="page">
      <h1>Распознавание номера по фото</h1>

      <div className="image-upload-layout">
        {/* Форма загрузки */}
        <div className="form-container">
          <form onSubmit={handleSubmit} className="form">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label htmlFor="imageFile">Изображение</label>
              <input
                ref={fileInputRef}
                type="file"
                id="imageFile"
                accept="image/jpeg,image/png,image/bmp,image/webp"
                onChange={handleFileChange}
                required
              />
              {file && (
                <small>
                  {file.name} ({(file.size / 1024).toFixed(1)} КБ)
                </small>
              )}
            </div>

            {/* Предпросмотр выбранного файла */}
            {preview && !result && (
              <div className="image-preview-box">
                <img src={preview} alt="Предпросмотр" className="preview-image" />
              </div>
            )}

            <div className="form-actions">
              <button
                type="submit"
                disabled={isLoading || !file}
                className="btn-primary"
              >
                {isLoading ? 'Обработка...' : 'Распознать номер'}
              </button>

              {(file || result) && (
                <button type="button" onClick={handleReset} className="btn-secondary">
                  Сбросить
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Результат */}
        {result && (
          <div className="image-result-container">
            {/* Аннотированное изображение */}
            {result.annotated_image && (
              <div className="annotated-image-box">
                <img
                  src={`data:image/jpeg;base64,${result.annotated_image}`}
                  alt="Результат распознавания"
                  className="annotated-image"
                />
              </div>
            )}

            {/* Метаданные */}
            <div className="result-meta">
              <h3>Результат</h3>

              <div className="result-message">
                {result.message}
              </div>

              {result.plate_number && (
                <div className="result-row">
                  <span className="result-label">Номер:</span>
                  <span className="result-value plate-number">{result.plate_number}</span>
                </div>
              )}

              {result.confidence > 0 && (
                <div className="result-row">
                  <span className="result-label">Уверенность:</span>
                  <span className="result-value">
                    {(result.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              )}

              {result.vehicle_found && (
                <div className="result-row">
                  <span className="result-label">Статус:</span>
                  <span className="result-value">
                    {territoryBadge(result.on_territory)}
                  </span>
                </div>
              )}

              {!result.vehicle_found && result.plate_number && (
                <div className="result-row">
                  <span className="result-value warning-text">
                    Автомобиль не зарегистрирован в системе
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

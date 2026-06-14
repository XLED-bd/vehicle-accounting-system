/**
 * Страница загрузки видео для обработки
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { videoService, VideoStatusResponse } from '../services/videoService';
import { handleApiError } from '../services/api';
import './CommonPages.css';
import './VideoUploadPage.css';

const POLL_INTERVAL_MS = 3000;

const directionLabel: Record<string, string> = {
  entry: 'Въезд',
  exit: 'Выезд',
  unknown: 'Не определено',
};

export const VideoUploadPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [currentUuid, setCurrentUuid] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<VideoStatusResponse | null>(null);
  const [frameBlobUrl, setFrameBlobUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revokeBlobUrl = useCallback(() => {
    if (frameBlobUrl) {
      URL.revokeObjectURL(frameBlobUrl);
      setFrameBlobUrl(null);
    }
  }, [frameBlobUrl]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async (uuid: string) => {
    try {
      const status = await videoService.getVideoStatus(uuid);
      setVideoStatus(status);

      if (status.status === 'complete' || status.status === 'failed') {
        stopPolling();
        // Загружаем кадр, если он есть
        if (status.status === 'complete' && status.has_frame) {
          try {
            const blobUrl = await videoService.getVideoFrameBlobUrl(uuid);
            setFrameBlobUrl(blobUrl);
          } catch {
            // кадр не критичен — просто не показываем
          }
        }
      } else {
        pollTimerRef.current = setTimeout(() => pollStatus(uuid), POLL_INTERVAL_MS);
      }
    } catch (err) {
      setError(handleApiError(err));
      stopPolling();
    }
  }, [stopPolling]);

  // Запуск поллинга при появлении uuid
  useEffect(() => {
    if (currentUuid) {
      pollStatus(currentUuid);
    }
    return stopPolling;
  }, [currentUuid]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    stopPolling();
    revokeBlobUrl();
    setIsLoading(true);
    setError('');
    setVideoStatus(null);
    setCurrentUuid(null);

    try {
      const response = await videoService.processVideo(file);
      setCurrentUuid(response.uuid);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    stopPolling();
    revokeBlobUrl();
    setFile(null);
    setVideoStatus(null);
    setCurrentUuid(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isProcessing = videoStatus &&
    (videoStatus.status === 'pending' || videoStatus.status === 'running');

  const statusLabel: Record<string, string> = {
    pending: 'Ожидает обработки...',
    running: 'Обработка видео...',
    complete: 'Обработка завершена',
    failed: 'Ошибка обработки',
  };

  return (
    <div className="page">
      <h1>Загрузка видео для обработки</h1>

      <div className="video-upload-layout">
        {/* Форма */}
        <div className="form-container">
          <form onSubmit={handleSubmit} className="form">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label htmlFor="videoFile">Видеофайл</label>
              <input
                ref={fileInputRef}
                type="file"
                id="videoFile"
                accept="video/*"
                onChange={handleFileChange}
                disabled={!!isProcessing}
                required
              />
              {file && (
                <small>
                  {file.name} ({(file.size / 1024 / 1024).toFixed(2)} МБ)
                </small>
              )}
            </div>

            <div className="form-actions">
              <button
                type="submit"
                disabled={isLoading || !file || !!isProcessing}
                className="btn-primary"
              >
                {isLoading ? 'Отправка...' : 'Отправить на обработку'}
              </button>

              {(currentUuid || error) && !isProcessing && (
                <button type="button" onClick={handleReset} className="btn-secondary">
                  Новое видео
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Результат / статус */}
        {videoStatus && (
          <div className="video-result-container">
            {/* Статус-бар */}
            <div className={`status-bar status-${videoStatus.status}`}>
              {isProcessing && <span className="spinner" />}
              {statusLabel[videoStatus.status] ?? videoStatus.status}
              {currentUuid && (
                <span className="uuid-badge">UUID: {currentUuid}</span>
              )}
            </div>

            {/* Аннотированный кадр */}
            {frameBlobUrl && (
              <div className="annotated-image-box">
                <img
                  src={frameBlobUrl}
                  alt="Лучший кадр с выделенным номером"
                  className="annotated-image"
                />
              </div>
            )}

            {/* Метаданные — только при завершении */}
            {videoStatus.status === 'complete' && (
              <div className="result-meta">
                <h3>Результат распознавания</h3>

                {videoStatus.plate_number ? (
                  <>
                    <div className="result-row">
                      <span className="result-label">Номер:</span>
                      <span className="result-value plate-number">
                        {videoStatus.plate_number}
                      </span>
                    </div>

                    <div className="result-row">
                      <span className="result-label">Направление:</span>
                      <span className="result-value">
                        {videoStatus.direction
                          ? directionLabel[videoStatus.direction] ?? videoStatus.direction
                          : '—'}
                      </span>
                    </div>

                    <div className="result-row">
                      <span className="result-label">Уверенность:</span>
                      <span className="result-value">
                        {videoStatus.confidence != null
                          ? `${(videoStatus.confidence * 100).toFixed(1)}%`
                          : '—'}
                      </span>
                    </div>

                    <div className="result-row">
                      <span className="result-label">Зарегистрирован:</span>
                      <span className="result-value">
                        {videoStatus.is_registered ? (
                          <span className="badge badge-entry">Да</span>
                        ) : (
                          <span className="badge badge-exit">Нет</span>
                        )}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="result-message">Номерной знак не обнаружен</div>
                )}

                {videoStatus.processing_time != null && (
                  <div className="result-row">
                    <span className="result-label">Время:</span>
                    <span className="result-value">
                      {videoStatus.processing_time.toFixed(2)} с
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Сообщение об ошибке из обработки */}
            {videoStatus.status === 'failed' && videoStatus.logs && (
              <div className="error-message">{videoStatus.logs}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

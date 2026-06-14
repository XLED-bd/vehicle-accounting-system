import React, { useEffect, useState } from 'react';
import { eventsService } from '../services/eventsService';
import { PassResponse } from '../types/api';
import { handleApiError } from '../services/api';
import { ExportButtons } from '../components/ExportButtons';
import { ExportColumn } from '../utils/exportUtils';
import './CommonPages.css';

export const EventsPage: React.FC = () => {
  const [events, setEvents] = useState<PassResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'registered' | 'unregistered'>('all');

  useEffect(() => {
    loadEvents();
  }, [filter]);

  const loadEvents = async () => {
    try {
      setIsLoading(true);
      setError('');

      let data: PassResponse[];
      if (filter === 'unregistered') {
        data = await eventsService.getUnregisteredEvents(100);
      } else {
        data = await eventsService.getAllEvents({
          limit: 100,
          registered_only: filter === 'registered' ? true : undefined,
        });
      }

      setEvents(data);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const getDirectionText = (direction: string | null) => {
    if (direction === 'entry') return 'Въезд';
    if (direction === 'exit') return 'Выезд';
    return '⚪ Неизвестно';
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'complete': return 'Завершено';
      case 'running': return 'Обработка';
      case 'failed': return 'Ошибка';
      default: return 'Ожидание';
    }
  };

  const exportColumns: ExportColumn<PassResponse>[] = [
    { header: 'Направление', accessor: (e) => getDirectionText(e.direction) },
    { header: 'Номер', accessor: (e) => e.plate_number_detected || '—' },
    {
      header: 'Время',
      accessor: (e) =>
        e.entry_exit_time
          ? new Date(e.entry_exit_time).toLocaleString('ru-RU')
          : '—',
    },
    { header: 'Статус', accessor: (e) => getStatusText(e.status) },
    {
      header: 'Уверенность',
      accessor: (e) =>
        e.confidence_level
          ? `${(e.confidence_level * 100).toFixed(0)}%`
          : '—',
    },
    { header: 'Зарегистрирован', accessor: (e) => (e.is_registered ? 'Да' : 'Нет') },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <h1>Мониторинг проездов</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <ExportButtons
            data={events}
            columns={exportColumns}
            filename="проезды"
            title="Мониторинг проездов"
          />
          <button onClick={loadEvents} className="btn-primary">Обновить</button>
        </div>
      </div>

      <div className="filters">
        <button
          onClick={() => setFilter('all')}
          className={filter === 'all' ? 'filter-btn active' : 'filter-btn'}
        >
          Все
        </button>
        <button
          onClick={() => setFilter('registered')}
          className={filter === 'registered' ? 'filter-btn active' : 'filter-btn'}
        >
          Зарегистрированные
        </button>
        <button
          onClick={() => setFilter('unregistered')}
          className={filter === 'unregistered' ? 'filter-btn active' : 'filter-btn'}
        >
          Незарегистрированные
        </button>
      </div>

      {isLoading ? (
        <div className="loading">Загрузка...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : events.length === 0 ? (
        <div className="empty">Нет событий</div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Направление</th>
                <th>Номер</th>
                <th>Время</th>
                <th>Статус</th>
                <th>Уверенность</th>
                <th>Зарегистрирован</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{getDirectionText(event.direction)}</td>
                  <td className="font-bold">{event.plate_number_detected || '—'}</td>
                  <td>
                    {event.entry_exit_time
                      ? new Date(event.entry_exit_time).toLocaleString('ru-RU')
                      : '—'}
                  </td>
                  <td>
                    <span className={`badge badge-${event.status}`}>
                      {getStatusText(event.status)}
                    </span>
                  </td>
                  <td>
                    {event.confidence_level
                      ? `${(event.confidence_level * 100).toFixed(0)}%`
                      : '—'}
                  </td>
                  <td>
                    {event.is_registered ? (
                      <span className="badge badge-success">Да</span>
                    ) : (
                      <span className="badge badge-danger">Нет</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

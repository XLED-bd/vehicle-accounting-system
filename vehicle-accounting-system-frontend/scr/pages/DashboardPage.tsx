/**
 * Главная страница - Dashboard со статистикой
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { statisticsService } from '../services/statisticsService';
import { vehiclesService } from '../services/vehiclesService';
import { eventsService } from '../services/eventsService';
import { StatisticsResponse, PassResponse, VehicleWithEmployee } from '../types/api';
import { handleApiError } from '../services/api';
import './DashboardPage.css';

export const DashboardPage: React.FC = () => {
  const [statistics, setStatistics] = useState<StatisticsResponse | null>(null);
  const [recentEvents, setRecentEvents] = useState<PassResponse[]>([]);
  const [vehiclesOnTerritory, setVehiclesOnTerritory] = useState<VehicleWithEmployee[]>([]);
  const [unregisteredEvents, setUnregisteredEvents] = useState<PassResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError('');

      const [stats, events, vehicles, unregistered] = await Promise.all([
        statisticsService.getStatistics(),
        eventsService.getAllEvents({ limit: 10 }),
        vehiclesService.getVehiclesOnTerritory(),
        eventsService.getUnregisteredEvents(10),
      ]);

      setStatistics(stats);
      setRecentEvents(events);
      setVehiclesOnTerritory(vehicles);
      setUnregisteredEvents(unregistered);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="loading">Загрузка данных...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="dashboard">
      <h1 className="page-title">Главная панель</h1>

      {/* Статистика */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"></div>
          <div className="stat-info">
            <div className="stat-label">Всего проездов</div>
            <div className="stat-value">{statistics?.total_passes || 0}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"></div>
          <div className="stat-info">
            <div className="stat-label">Успешных</div>
            <div className="stat-value">{statistics?.successful_passes || 0}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"></div>
          <div className="stat-info">
            <div className="stat-label">Ошибок</div>
            <div className="stat-value">{statistics?.failed_passes || 0}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"></div>
          <div className="stat-info">
            <div className="stat-label">В обработке</div>
            <div className="stat-value">{statistics?.pending_passes || 0}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"></div>
          <div className="stat-info">
            <div className="stat-label">Автомобилей</div>
            <div className="stat-value">{statistics?.registered_vehicles || 0}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"></div>
          <div className="stat-info">
            <div className="stat-label">На территории</div>
            <div className="stat-value">{statistics?.vehicles_on_territory || 0}</div>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon"></div>
          <div className="stat-info">
            <div className="stat-label">Незарегистрированных</div>
            <div className="stat-value">{statistics?.unregistered_entries || 0}</div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Недавние события */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2>Недавние проезды</h2>
            <Link to="/events" className="link-button">Все →</Link>
          </div>
          <div className="events-list">
            {recentEvents.length === 0 ? (
              <p className="empty-message">Нет событий</p>
            ) : (
              recentEvents.map((event) => (
                <div key={event.id} className="event-item">
                  <div className="event-direction">
                    {event.direction === 'entry' ? '🟢' : event.direction === 'exit' ? '🔴' : '⚪'}
                  </div>
                  <div className="event-info">
                    <div className="event-plate">{event.plate_number_detected || 'Неизвестно'}</div>
                    <div className="event-time">
                      {event.entry_exit_time
                        ? new Date(event.entry_exit_time).toLocaleString('ru-RU')
                        : 'Время неизвестно'}
                    </div>
                  </div>
                  <div className="event-status">
                    <span className={`badge badge-${event.status}`}>
                      {event.status === 'complete' ? 'Завершено' :
                       event.status === 'running' ? 'Обработка' :
                       event.status === 'failed' ? 'Ошибка' : 'Ожидание'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Автомобили на территории */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2>На территории ({vehiclesOnTerritory.length})</h2>
            <Link to="/vehicles?on_territory=true" className="link-button">Все →</Link>
          </div>
          <div className="vehicles-list">
            {vehiclesOnTerritory.length === 0 ? (
              <p className="empty-message">Нет автомобилей на территории</p>
            ) : (
              vehiclesOnTerritory.slice(0, 8).map((vehicle) => (
                <div key={vehicle.id} className="vehicle-item">
                  <div className="vehicle-plate">{vehicle.plate_number}</div>
                  {vehicle.employee && (
                    <div className="vehicle-employee">{vehicle.employee.full_name}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Незарегистрированные проезды */}
        {unregisteredEvents.length > 0 && (
          <div className="dashboard-section warning-section">
            <div className="section-header">
              <h2>⚠️ Незарегистрированные проезды</h2>
              <Link to="/events?unregistered=true" className="link-button">Все →</Link>
            </div>
            <div className="unregistered-list">
              {unregisteredEvents.slice(0, 5).map((event) => (
                <div key={event.id} className="unregistered-item">
                  <div className="unregistered-plate">{event.plate_number_detected}</div>
                  <div className="unregistered-time">
                    {event.entry_exit_time
                      ? new Date(event.entry_exit_time).toLocaleString('ru-RU')
                      : 'Время неизвестно'}
                  </div>
                  <div className="unregistered-direction">
                    {event.direction === 'entry' ? 'Въезд' : 'Выезд'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

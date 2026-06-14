import React, { useEffect, useMemo, useState } from 'react';
import { accessService } from '../services/accessService';
import { vehiclesService } from '../services/vehiclesService';
import { AccessWithVehicle, AccessCreate, AccessUpdate, VehicleWithEmployee } from '../types/api';
import { useAuth } from '../contexts/AuthContext';
import { ExportButtons } from '../components/ExportButtons';
import { ExportColumn } from '../utils/exportUtils';
import './CommonPages.css';

interface AccessForm {
  vehicle_id: number | '';
  valid_from: string;
  valid_until: string;
  is_active: boolean;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM: AccessForm = {
  vehicle_id: '',
  valid_from: todayIso(),
  valid_until: '',
  is_active: true,
};

type FilterActive = 'all' | 'yes' | 'no';
type FilterExpiry = 'all' | 'permanent' | 'expiring' | 'expired';

export const AccessPage: React.FC = () => {
  const { isAdmin, isOperator } = useAuth();
  const admin = isAdmin();
  const operator = isOperator();

  const [accesses, setAccesses] = useState<AccessWithVehicle[]>([]);
  const [vehicles, setVehicles] = useState<VehicleWithEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Поиск и фильтры
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<FilterActive>('all');
  const [filterExpiry, setFilterExpiry] = useState<FilterExpiry>('all');

  // Модальное окно
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AccessForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAccesses();
    if (admin || operator) loadVehicles();
  }, []);

  const loadAccesses = async () => {
    try {
      const data = await accessService.getAccesses({ limit: 100 });
      setAccesses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadVehicles = async () => {
    try {
      const data = await vehiclesService.getVehicles({ limit: 200 });
      setVehicles(data);
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const now = new Date();
    return accesses.filter((a) => {
      if (q) {
        const plate = (a.vehicle?.plate_number ?? '').toLowerCase();
        if (!plate.includes(q)) return false;
      }
      if (filterActive === 'yes' && !a.is_active) return false;
      if (filterActive === 'no' && a.is_active) return false;
      if (filterExpiry !== 'all') {
        if (filterExpiry === 'permanent' && a.valid_until !== null) return false;
        if (filterExpiry === 'expiring' && (a.valid_until === null || new Date(a.valid_until) <= now)) return false;
        if (filterExpiry === 'expired' && (a.valid_until === null || new Date(a.valid_until) > now)) return false;
      }
      return true;
    });
  }, [accesses, search, filterActive, filterExpiry]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (a: AccessWithVehicle) => {
    setEditingId(a.id);
    setForm({
      vehicle_id: a.vehicle_id,
      valid_from: a.valid_from.slice(0, 10),
      valid_until: a.valid_until ? a.valid_until.slice(0, 10) : '',
      is_active: a.is_active,
    });
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const toDatetime = (date: string) => `${date}T00:00:00`;

  const formatApiError = (err: any, fallback: string): string => {
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail.map((d: any) => d.msg ?? 'Ошибка валидации').join('; ');
    }
    return fallback;
  };

  const handleSave = async () => {
    if (!form.vehicle_id) {
      setError('Автомобиль обязателен');
      return;
    }
    if (!form.valid_from) {
      setError('Дата начала обязательна');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingId !== null) {
        const update: AccessUpdate = {
          valid_from: toDatetime(form.valid_from),
          valid_until: form.valid_until ? toDatetime(form.valid_until) : null,
          is_active: form.is_active,
        };
        await accessService.updateAccess(editingId, update);
      } else {
        const create: AccessCreate = {
          vehicle_id: form.vehicle_id as number,
          valid_from: toDatetime(form.valid_from),
          valid_until: form.valid_until ? toDatetime(form.valid_until) : null,
          is_active: form.is_active,
        };
        await accessService.createAccess(create);
      }
      setModalOpen(false);
      await loadAccesses();
    } catch (err: any) {
      setError(formatApiError(err, 'Ошибка при сохранении'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Удалить доступ?')) return;
    try {
      await accessService.deleteAccess(id);
      await loadAccesses();
    } catch (err: any) {
      alert(formatApiError(err, 'Ошибка при удалении'));
    }
  };

  const handleToggleActive = async (a: AccessWithVehicle) => {
    try {
      if (a.is_active) {
        await accessService.deactivateAccess(a.id);
      } else {
        await accessService.activateAccess(a.id);
      }
      await loadAccesses();
    } catch (err: any) {
      alert(formatApiError(err, 'Ошибка при изменении статуса'));
    }
  };

  const colSpan = admin ? 5 : 4;

  const exportColumns: ExportColumn<AccessWithVehicle>[] = [
    { header: 'Номер авто', accessor: (a) => a.vehicle?.plate_number || '—' },
    {
      header: 'Действителен с',
      accessor: (a) => new Date(a.valid_from).toLocaleDateString('ru-RU'),
    },
    {
      header: 'Действителен до',
      accessor: (a) =>
        a.valid_until
          ? new Date(a.valid_until).toLocaleDateString('ru-RU')
          : 'Бессрочно',
    },
    { header: 'Активен', accessor: (a) => (a.is_active ? 'Да' : 'Нет') },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <h1>Управление доступами</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <ExportButtons
            data={filtered}
            columns={exportColumns}
            filename="доступы"
            title="Управление доступами"
          />
          {(admin || operator) && (
            <button className="btn-primary" onClick={openCreate}>
              + Добавить
            </button>
          )}
        </div>
      </div>

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Поиск по номеру авто..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="filter-select"
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value as FilterActive)}
        >
          <option value="all">Статус: все</option>
          <option value="yes">Активные</option>
          <option value="no">Неактивные</option>
        </select>
        <select
          className="filter-select"
          value={filterExpiry}
          onChange={(e) => setFilterExpiry(e.target.value as FilterExpiry)}
        >
          <option value="all">Срок: все</option>
          <option value="permanent">Бессрочные</option>
          <option value="expiring">Действующие</option>
          <option value="expired">Истёкшие</option>
        </select>
        <span className="results-count">{filtered.length} из {accesses.length}</span>
      </div>

      {isLoading ? (
        <div className="loading">Загрузка...</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Номер авто</th>
              <th>Действителен с</th>
              <th>Действителен до</th>
              <th>Активен</th>
              {admin && <th>Действия</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={colSpan} style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
                  Ничего не найдено
                </td>
              </tr>
            ) : (
              filtered.map((a) => (
                <tr key={a.id}>
                  <td className="font-bold">{a.vehicle?.plate_number || '—'}</td>
                  <td>{new Date(a.valid_from).toLocaleDateString('ru-RU')}</td>
                  <td>{a.valid_until ? new Date(a.valid_until).toLocaleDateString('ru-RU') : 'Бессрочно'}</td>
                  <td>{a.is_active ? '✅' : '❌'}</td>
                  {admin && (
                    <td>
                      <button
                        className={`btn-sm ${a.is_active ? 'btn-deactivate' : 'btn-activate'}`}
                        onClick={() => handleToggleActive(a)}
                      >
                        {a.is_active ? 'Деактивировать' : 'Активировать'}
                      </button>
                      <button className="btn-sm btn-edit" onClick={() => openEdit(a)}>
                        Изменить
                      </button>
                      <button className="btn-sm btn-delete" onClick={() => handleDelete(a.id)}>
                        Удалить
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId !== null ? 'Редактировать доступ' : 'Добавить доступ'}</h2>
            <div className="modal-form">
              {error && <div className="modal-error">{error}</div>}

              <div className="form-group">
                <label>Автомобиль *</label>
                <select
                  value={form.vehicle_id}
                  onChange={(e) => setForm({ ...form, vehicle_id: e.target.value ? Number(e.target.value) : '' })}
                  disabled={editingId !== null}
                >
                  <option value="">— Выберите автомобиль —</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate_number}{v.employee ? ` — ${v.employee.full_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Действителен с *</label>
                <input
                  type="date"
                  value={form.valid_from}
                  onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Действителен до (пусто = бессрочно)</label>
                <input
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                />
              </div>

              <div className="form-group">
                <div className="checkbox-row">
                  <input
                    type="checkbox"
                    id="access_is_active"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                  <label htmlFor="access_is_active">Активен</label>
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn-cancel" onClick={closeModal}>
                  Отмена
                </button>
                <button className="btn-save" onClick={handleSave} disabled={saving}>
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

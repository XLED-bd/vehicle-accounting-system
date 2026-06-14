import React, { useEffect, useMemo, useState } from 'react';
import { vehiclesService } from '../services/vehiclesService';
import { employeesService } from '../services/employeesService';
import { VehicleWithEmployee, VehicleCreate, VehicleUpdate, EmployeeResponse } from '../types/api';
import { useAuth } from '../contexts/AuthContext';
import { ExportButtons } from '../components/ExportButtons';
import { ExportColumn } from '../utils/exportUtils';
import './CommonPages.css';

const EMPTY_FORM: VehicleCreate & { on_territory?: boolean } = {
  plate_number: '',
  transport_type: '',
  employee_id: undefined,
  is_guest: false,
};

export const VehiclesPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const admin = isAdmin();

  const [vehicles, setVehicles] = useState<VehicleWithEmployee[]>([]);
  const [employees, setEmployees] = useState<EmployeeResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Поиск и фильтры
  const [search, setSearch] = useState('');
  const [filterTerritory, setFilterTerritory] = useState<'all' | 'yes' | 'no'>('all');
  const [filterGuest, setFilterGuest] = useState<'all' | 'yes' | 'no'>('all');

  // Модальное окно
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<VehicleCreate & { on_territory?: boolean }>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadVehicles();
    if (admin) loadEmployees();
  }, []);

  const loadVehicles = async () => {
    try {
      const data = await vehiclesService.getVehicles({ limit: 100 });
      setVehicles(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const data = await employeesService.getEmployees({ limit: 200 });
      setEmployees(data);
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return vehicles.filter((v) => {
      if (q) {
        const match =
          v.plate_number.toLowerCase().includes(q) ||
          (v.transport_type ?? '').toLowerCase().includes(q) ||
          (v.employee?.full_name ?? '').toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filterTerritory === 'yes' && !v.on_territory) return false;
      if (filterTerritory === 'no' && v.on_territory) return false;
      if (filterGuest === 'yes' && !v.is_guest) return false;
      if (filterGuest === 'no' && v.is_guest) return false;
      return true;
    });
  }, [vehicles, search, filterTerritory, filterGuest]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (v: VehicleWithEmployee) => {
    setEditingId(v.id);
    setForm({
      plate_number: v.plate_number,
      transport_type: v.transport_type ?? '',
      employee_id: v.employee_id ?? undefined,
      is_guest: v.is_guest,
      on_territory: v.on_territory,
    });
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSave = async () => {
    if (!form.plate_number.trim()) {
      setError('Номерной знак обязателен');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingId !== null) {
        const update: VehicleUpdate = {
          plate_number: form.plate_number,
          transport_type: form.transport_type || null,
          employee_id: form.employee_id ?? null,
          is_guest: form.is_guest,
          on_territory: form.on_territory,
        };
        await vehiclesService.updateVehicle(editingId, update);
      } else {
        const create: VehicleCreate = {
          plate_number: form.plate_number,
          transport_type: form.transport_type || null,
          employee_id: form.employee_id ?? null,
          is_guest: form.is_guest,
        };
        await vehiclesService.createVehicle(create);
      }
      setModalOpen(false);
      await loadVehicles();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Удалить автомобиль?')) return;
    try {
      await vehiclesService.deleteVehicle(id);
      await loadVehicles();
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? 'Ошибка при удалении');
    }
  };

  const exportColumns: ExportColumn<VehicleWithEmployee>[] = [
    { header: 'Номер', accessor: (v) => v.plate_number },
    { header: 'Тип', accessor: (v) => v.transport_type || '—' },
    { header: 'Сотрудник', accessor: (v) => v.employee?.full_name || '—' },
    { header: 'На территории', accessor: (v) => (v.on_territory ? 'Да' : 'Нет') },
    { header: 'Гостевой', accessor: (v) => (v.is_guest ? 'Да' : 'Нет') },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <h1>Автомобили</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <ExportButtons
            data={filtered}
            columns={exportColumns}
            filename="автомобили"
            title="Список автомобилей"
          />
          {admin && (
            <button className="btn-primary" onClick={openCreate}>
              + Добавить
            </button>
          )}
        </div>
      </div>

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Поиск по номеру, типу, сотруднику..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="filter-select"
          value={filterTerritory}
          onChange={(e) => setFilterTerritory(e.target.value as 'all' | 'yes' | 'no')}
        >
          <option value="all">Территория: все</option>
          <option value="yes">На территории</option>
          <option value="no">Вне территории</option>
        </select>
        <select
          className="filter-select"
          value={filterGuest}
          onChange={(e) => setFilterGuest(e.target.value as 'all' | 'yes' | 'no')}
        >
          <option value="all">Гостевые: все</option>
          <option value="yes">Только гостевые</option>
          <option value="no">Только свои</option>
        </select>
        <span className="results-count">{filtered.length} из {vehicles.length}</span>
      </div>

      {isLoading ? (
        <div className="loading">Загрузка...</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Номер</th>
              <th>Тип</th>
              <th>Сотрудник</th>
              <th>На территории</th>
              <th>Гостевой</th>
              {admin && <th>Действия</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={admin ? 6 : 5} style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
                  Ничего не найдено
                </td>
              </tr>
            ) : (
              filtered.map((v) => (
                <tr key={v.id}>
                  <td className="font-bold">{v.plate_number}</td>
                  <td>{v.transport_type || '—'}</td>
                  <td>{v.employee?.full_name || '—'}</td>
                  <td>{v.on_territory ? 'Да' : 'Нет'}</td>
                  <td>{v.is_guest ? 'Да' : '—'}</td>
                  {admin && (
                    <td>
                      <button className="btn-sm btn-edit" onClick={() => openEdit(v)}>
                        Изменить
                      </button>
                      <button className="btn-sm btn-delete" onClick={() => handleDelete(v.id)}>
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
            <h2>{editingId !== null ? 'Редактировать автомобиль' : 'Добавить автомобиль'}</h2>
            <div className="modal-form">
              {error && <div className="modal-error">{error}</div>}

              <div className="form-group">
                <label>Номерной знак *</label>
                <input
                  value={form.plate_number}
                  onChange={(e) => setForm({ ...form, plate_number: e.target.value })}
                  placeholder="А123БВ777"
                />
              </div>

              <div className="form-group">
                <label>Тип транспорта</label>
                <input
                  value={form.transport_type ?? ''}
                  onChange={(e) => setForm({ ...form, transport_type: e.target.value })}
                  placeholder="Легковой, грузовой..."
                />
              </div>

              <div className="form-group">
                <label>Сотрудник</label>
                <select
                  value={form.employee_id ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, employee_id: e.target.value ? Number(e.target.value) : undefined })
                  }
                >
                  <option value="">— Не назначен —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Флаги</label>
                <div className="checkbox-row">
                  <input
                    type="checkbox"
                    id="is_guest"
                    checked={form.is_guest ?? false}
                    onChange={(e) => setForm({ ...form, is_guest: e.target.checked })}
                  />
                  <label htmlFor="is_guest">Гостевой автомобиль</label>
                </div>
                {editingId !== null && (
                  <div className="checkbox-row" style={{ marginTop: '0.5rem' }}>
                    <input
                      type="checkbox"
                      id="on_territory"
                      checked={form.on_territory ?? false}
                      onChange={(e) => setForm({ ...form, on_territory: e.target.checked })}
                    />
                    <label htmlFor="on_territory">На территории</label>
                  </div>
                )}
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

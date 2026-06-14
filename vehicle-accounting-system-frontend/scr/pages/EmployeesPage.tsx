import React, { useEffect, useMemo, useState } from 'react';
import { employeesService } from '../services/employeesService';
import { EmployeeResponse, EmployeeCreate, EmployeeUpdate } from '../types/api';
import { useAuth } from '../contexts/AuthContext';
import { ExportButtons } from '../components/ExportButtons';
import { ExportColumn } from '../utils/exportUtils';
import './CommonPages.css';

interface EmployeeForm {
  full_name: string;
  position: string;
  contact_info: string;
}

const EMPTY_FORM: EmployeeForm = {
  full_name: '',
  position: '',
  contact_info: '',
};

export const EmployeesPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const admin = isAdmin();

  const [employees, setEmployees] = useState<EmployeeResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Поиск
  const [search, setSearch] = useState('');

  // Модальное окно
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const data = await employeesService.getEmployees({ limit: 100 });
      setEmployees(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return employees;
    return employees.filter((e) =>
      e.full_name.toLowerCase().includes(q) ||
      (e.position ?? '').toLowerCase().includes(q) ||
      (e.contact_info ?? '').toLowerCase().includes(q)
    );
  }, [employees, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (e: EmployeeResponse) => {
    setEditingId(e.id);
    setForm({
      full_name: e.full_name,
      position: e.position ?? '',
      contact_info: e.contact_info ?? '',
    });
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      setError('ФИО обязательно');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingId !== null) {
        const update: EmployeeUpdate = {
          full_name: form.full_name,
          position: form.position || null,
          contact_info: form.contact_info || null,
        };
        await employeesService.updateEmployee(editingId, update);
      } else {
        const create: EmployeeCreate = {
          full_name: form.full_name,
          position: form.position || null,
          contact_info: form.contact_info || null,
        };
        await employeesService.createEmployee(create);
      }
      setModalOpen(false);
      await loadEmployees();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Удалить сотрудника?')) return;
    try {
      await employeesService.deleteEmployee(id);
      await loadEmployees();
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? 'Ошибка при удалении');
    }
  };

  const exportColumns: ExportColumn<EmployeeResponse>[] = [
    { header: 'ФИО', accessor: (e) => e.full_name },
    { header: 'Должность', accessor: (e) => e.position || '—' },
    { header: 'Контакты', accessor: (e) => e.contact_info || '—' },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <h1>Сотрудники</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <ExportButtons
            data={filtered}
            columns={exportColumns}
            filename="сотрудники"
            title="Список сотрудников"
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
          placeholder="Поиск по ФИО, должности, контактам..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="results-count">{filtered.length} из {employees.length}</span>
      </div>

      {isLoading ? (
        <div className="loading">Загрузка...</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Должность</th>
              <th>Контакты</th>
              {admin && <th>Действия</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={admin ? 4 : 3} style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
                  Ничего не найдено
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.id}>
                  <td className="font-bold">{e.full_name}</td>
                  <td>{e.position || '—'}</td>
                  <td>{e.contact_info || '—'}</td>
                  {admin && (
                    <td>
                      <button className="btn-sm btn-edit" onClick={() => openEdit(e)}>
                        Изменить
                      </button>
                      <button className="btn-sm btn-delete" onClick={() => handleDelete(e.id)}>
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
            <h2>{editingId !== null ? 'Редактировать сотрудника' : 'Добавить сотрудника'}</h2>
            <div className="modal-form">
              {error && <div className="modal-error">{error}</div>}

              <div className="form-group">
                <label>ФИО *</label>
                <input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Иванов Иван Иванович"
                />
              </div>

              <div className="form-group">
                <label>Должность</label>
                <input
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  placeholder="Менеджер, инженер..."
                />
              </div>

              <div className="form-group">
                <label>Контактная информация</label>
                <input
                  value={form.contact_info}
                  onChange={(e) => setForm({ ...form, contact_info: e.target.value })}
                  placeholder="Телефон, email..."
                />
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

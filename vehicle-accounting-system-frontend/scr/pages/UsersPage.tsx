import React, { useEffect, useMemo, useState } from 'react';
import { usersService } from '../services/statisticsService';
import { employeesService } from '../services/employeesService';
import { UserResponse, UserCreate, UserUpdate, UserRole, EmployeeResponse } from '../types/api';
import { ExportButtons } from '../components/ExportButtons';
import { ExportColumn } from '../utils/exportUtils';
import './CommonPages.css';

interface UserForm {
  username: string;
  password: string;
  role: UserRole;
  employee_id?: number;
  is_active: boolean;
}

const EMPTY_FORM: UserForm = {
  username: '',
  password: '',
  role: 'operator',
  employee_id: undefined,
  is_active: true,
};

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [employees, setEmployees] = useState<EmployeeResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Поиск и фильтры
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'administrator' | 'operator'>('all');
  const [filterActive, setFilterActive] = useState<'all' | 'yes' | 'no'>('all');

  // Модальное окно
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsers();
    loadEmployees();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await usersService.getUsers({ limit: 100 });
      setUsers(data);
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
    return users.filter((u) => {
      if (q && !u.username.toLowerCase().includes(q)) return false;
      if (filterRole !== 'all' && u.role !== filterRole) return false;
      if (filterActive === 'yes' && !u.is_active) return false;
      if (filterActive === 'no' && u.is_active) return false;
      return true;
    });
  }, [users, search, filterRole, filterActive]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (u: UserResponse) => {
    setEditingId(u.id);
    setForm({
      username: u.username,
      password: '',
      role: u.role,
      employee_id: u.employee_id ?? undefined,
      is_active: u.is_active,
    });
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const formatApiError = (err: any, fallback: string): string => {
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail.map((d: any) => d.msg ?? 'Ошибка валидации').join('; ');
    }
    return fallback;
  };

  const handleSave = async () => {
    if (!form.username.trim()) {
      setError('Имя пользователя обязательно');
      return;
    }
    if (editingId === null && !form.password.trim()) {
      setError('Пароль обязателен при создании');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingId !== null) {
        const update: UserUpdate = {
          username: form.username,
          role: form.role,
          employee_id: form.employee_id ?? null,
          is_active: form.is_active,
        };
        if (form.password.trim()) {
          update.password = form.password;
        }
        await usersService.updateUser(editingId, update);
      } else {
        const create: UserCreate = {
          username: form.username,
          password: form.password,
          role: form.role,
          employee_id: form.employee_id ?? null,
        };
        await usersService.createUser(create);
      }
      setModalOpen(false);
      await loadUsers();
    } catch (err: any) {
      setError(formatApiError(err, 'Ошибка при сохранении'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Удалить пользователя?')) return;
    try {
      await usersService.deleteUser(id);
      await loadUsers();
    } catch (err: any) {
      alert(formatApiError(err, 'Ошибка при удалении'));
    }
  };

  const exportColumns: ExportColumn<UserResponse>[] = [
    { header: 'Имя пользователя', accessor: (u) => u.username },
    {
      header: 'Роль',
      accessor: (u) => (u.role === 'administrator' ? 'Администратор' : 'Оператор'),
    },
    { header: 'Активен', accessor: (u) => (u.is_active ? 'Да' : 'Нет') },
    {
      header: 'Создан',
      accessor: (u) => new Date(u.created_at).toLocaleDateString('ru-RU'),
    },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <h1>Управление пользователями</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="badge badge-danger">Только для администратора</span>
          <ExportButtons
            data={filtered}
            columns={exportColumns}
            filename="пользователи"
            title="Список пользователей"
          />
          <button className="btn-primary" onClick={openCreate}>
            + Добавить
          </button>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Поиск по имени пользователя..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="filter-select"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as 'all' | 'administrator' | 'operator')}
        >
          <option value="all">Роль: все</option>
          <option value="administrator">Администратор</option>
          <option value="operator">Оператор</option>
        </select>
        <select
          className="filter-select"
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value as 'all' | 'yes' | 'no')}
        >
          <option value="all">Статус: все</option>
          <option value="yes">Активные</option>
          <option value="no">Неактивные</option>
        </select>
        <span className="results-count">{filtered.length} из {users.length}</span>
      </div>

      {isLoading ? (
        <div className="loading">Загрузка...</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Имя пользователя</th>
              <th>Роль</th>
              <th>Активен</th>
              <th>Создан</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
                  Ничего не найдено
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id}>
                  <td className="font-bold">{u.username}</td>
                  <td>
                    <span className={u.role === 'administrator' ? 'badge badge-danger' : 'badge badge-info'}>
                      {u.role === 'administrator' ? 'Администратор' : 'Оператор'}
                    </span>
                  </td>
                  <td>{u.is_active ? '✅' : '❌'}</td>
                  <td>{new Date(u.created_at).toLocaleDateString('ru-RU')}</td>
                  <td>
                    <button className="btn-sm btn-edit" onClick={() => openEdit(u)}>
                      Изменить
                    </button>
                    <button className="btn-sm btn-delete" onClick={() => handleDelete(u.id)}>
                      Удалить
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId !== null ? 'Редактировать пользователя' : 'Добавить пользователя'}</h2>
            <div className="modal-form">
              {error && <div className="modal-error">{error}</div>}

              <div className="form-group">
                <label>Имя пользователя *</label>
                <input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="username"
                  autoComplete="off"
                />
              </div>

              <div className="form-group">
                <label>{editingId !== null ? 'Новый пароль (оставьте пустым, чтобы не менять)' : 'Пароль *'}</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label>Роль</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                >
                  <option value="operator">Оператор</option>
                  <option value="administrator">Администратор</option>
                </select>
              </div>

              <div className="form-group">
                <label>Сотрудник</label>
                <select
                  value={form.employee_id ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, employee_id: e.target.value ? Number(e.target.value) : undefined })
                  }
                >
                  <option value="">— Не привязан —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {editingId !== null && (
                <div className="form-group">
                  <div className="checkbox-row">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    />
                    <label htmlFor="is_active">Активен</label>
                  </div>
                </div>
              )}

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

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import API from '../api';
import OnlineBadge from '../components/OnlineBadge';
import { useAuth } from '../auth';
import { useLang } from '../i18n';
import { ROLE_KEYS, SPECIALITE_KEYS } from '../constants';

const emptyForm = {
  username: '',
  email: '',
  password: '',
  role: 'INFORMATICIEN',
  site: '',
  specialite: 'RESEAU',
};

export default function Utilisateurs() {
  const { user: me } = useAuth();
  const { t, formatDate } = useLang();
  const isAdmin = me?.role === 'ADMIN_GENERAL';

  const [users, setUsers] = useState([]);
  const [sites, setSites] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([API.get('utilisateurs/?page_size=500'), API.get('sites/')])
      .then(([u, s]) => {
        setUsers(u.data.results || u.data);
        setSites(s.data.results || s.data);
        setError('');
      })
      .catch(() => setError(t('users.loadError')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const startEdit = (u) => {
    setForm({
      username: u.username,
      email: u.email || '',
      password: '',
      role: u.role,
      site: u.site ?? '',
      specialite: u.specialite || 'RESEAU',
    });
    setEditingId(u.id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      if (editingId) {
        await API.patch(`utilisateurs/${editingId}/`, {
          username: form.username,
          email: form.email,
          role: form.role,
          site: form.site || null,
          specialite: form.specialite,
        });
        setMsg(t('users.updated'));
      } else {
        await API.post('utilisateurs/', { ...form, site: form.site || null });
        setMsg(t('users.created'));
      }
      resetForm();
      load();
    } catch (err) {
      const d = err.response?.data || {};
      const keys = ['username', 'email', 'password', 'role', 'site', 'specialite'];
      const parts = keys
        .filter((k) => d[k])
        .map((k) => `${k}: ${Array.isArray(d[k]) ? d[k].join(' ') : d[k]}`);
      setError(parts.length ? parts.join(' · ') : t('users.createError'));
    }
  };

  const handleDelete = async (id, username) => {
    if (!window.confirm(t('users.deleteConfirm', { name: username }))) return;
    try {
      await API.delete(`utilisateurs/${id}/`);
      setMsg(t('users.deleted'));
      if (editingId === id) resetForm();
      load();
    } catch {
      setError(t('users.deleteError'));
    }
  };

  const selectRole = (v) => setRoleFilter(v);
  const panelClass = (active) => (active ? 'option-panel active' : 'option-panel');

  const filtered = roleFilter ? users.filter((u) => u.role === roleFilter) : users;

  return (
    <div>
      <div className="page-head">
        <h2>{t('users.title')}</h2>
      </div>

      {msg && <p className="alert alert-success">{msg}</p>}
      {error && <p className="alert alert-danger">{error}</p>}

      <div className="card filter-form">
        <div className="filter-form-head">
          <h3>{t('users.allRoles')}</h3>
        </div>
        <div className="option-group">
          <div className="option-panels">
            <button
              type="button"
              className={panelClass(roleFilter === '')}
              onClick={() => selectRole('')}
            >
              {t('common.allRoles')}
            </button>
            {ROLE_KEYS.map((key) => (
              <button
                type="button"
                key={key}
                className={panelClass(roleFilter === key)}
                onClick={() => selectRole(key)}
              >
                {t(`role.${key}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="card">
          <h3>
            <UserPlus size={16} /> {editingId ? t('users.edit', { name: form.username }) : t('users.new')}
          </h3>
          <form onSubmit={handleSubmit} className="grid-form">
            <label>
              {t('users.username')}
              <input
                type="text"
                required
                value={form.username}
                onChange={(e) => set('username', e.target.value)}
              />
            </label>
            <label>
              {t('users.email')}
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </label>
            {!editingId && (
              <label>
                {t('users.password')}
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                />
              </label>
            )}
            <label>
              {t('users.role')}
              <select value={form.role} onChange={(e) => set('role', e.target.value)}>
                {ROLE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {t(`role.${key}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('users.site')}
              <select value={form.site} onChange={(e) => set('site', e.target.value)}>
                <option value="">{t('users.chooseSite')}</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom}
                  </option>
                ))}
              </select>
            </label>
            {form.role === 'INFORMATICIEN' && (
              <label>
                {t('users.specialty')}
                <select value={form.specialite} onChange={(e) => set('specialite', e.target.value)}>
                  {SPECIALITE_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {t(`specialite.${key}`)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="grid-actions">
              <button type="submit" className="btn btn-primary">
                {editingId ? t('common.save') : t('users.create')}
              </button>
              {editingId && (
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  {t('common.cancel')}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="muted">{t('common.loading')}</p>
      ) : filtered.length === 0 ? (
        <p className="muted">{t('users.empty')}</p>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>{t('users.username')}</th>
                <th>{t('table.email')}</th>
                <th>{t('users.role')}</th>
                <th>{t('users.site')}</th>
                <th>{t('table.specialty')}</th>
                <th>{t('table.online')}</th>
                <th>{t('table.lastLogin')}</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.username}</strong>
                  </td>
                  <td>{u.email || '—'}</td>
                  <td>{t(`role.${u.role}`)}</td>
                  <td>{u.site_nom || '—'}</td>
                  <td>
                    {u.role === 'INFORMATICIEN'
                      ? u.specialite
                        ? t(`specialite.${u.specialite}`)
                        : '—'
                      : '—'}
                  </td>
                  <td>
                    <OnlineBadge connecte={u.connecte} />
                  </td>
                  <td>{formatDate(u.derniere_connexion)}</td>
                  {isAdmin && (
                    <td className="actions">
                      <button className="icon-btn" onClick={() => startEdit(u)} aria-label={t('common.edit')}>
                        <Plus size={16} />
                      </button>
                      <button
                        className="icon-btn danger"
                        onClick={() => handleDelete(u.id, u.username)}
                        aria-label={t('common.delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
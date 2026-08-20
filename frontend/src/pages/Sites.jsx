import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Phone,
  Archive,
  RotateCcw,
  Trash2 as TrashForever,
} from 'lucide-react';
import API from '../api';
import OnlineBadge from '../components/OnlineBadge';
import { useAuth } from '../auth';
import { useLang } from '../i18n';

export default function Sites() {
  const { user } = useAuth();
  const { t, formatDate } = useLang();
  const isAdmin = user?.role === 'ADMIN_GENERAL';

  const [sites, setSites] = useState([]);
  const [showTrash, setShowTrash] = useState(false);
  const [nom, setNom] = useState('');
  const [adresse, setAdresse] = useState('');
  const [ville, setVille] = useState('');
  const [telephone, setTelephone] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(
    (trash = showTrash) => {
      setLoading(true);
      API.get(`sites/${trash ? '?archives=1' : ''}`)
        .then((res) => {
          setSites(res.data.results || res.data);
          setError('');
        })
        .catch(() => setError(t('sites.createError')))
        .finally(() => setLoading(false));
    },
    [showTrash, t]
  );

  useEffect(() => {
    load(showTrash);
  }, [load, showTrash]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      await API.post('sites/', { nom, adresse, ville, telephone });
      setNom('');
      setAdresse('');
      setVille('');
      setTelephone('');
      setMsg(t('sites.created'));
      load();
    } catch (err) {
      const detail = err.response?.data?.nom;
      setError(detail ? `Nom : ${Array.isArray(detail) ? detail.join(' ') : detail}` : t('sites.createError'));
    }
  };

  const handleArchive = async (id, nomSite) => {
    if (!window.confirm(t('sites.deleteConfirm', { name: nomSite }))) return;
    try {
      await API.delete(`sites/${id}/`);
      setMsg(t('sites.deleted'));
      load();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || t('sites.deleteError'));
    }
  };

  const handleRestore = async (id) => {
    try {
      await API.post(`sites/${id}/restaurer/`);
      setMsg(t('sites.restored'));
      load();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || t('sites.createError'));
    }
  };

  const handleDeleteForever = async (id, nomSite) => {
    if (!window.confirm(t('sites.deleteForeverConfirm', { name: nomSite }))) return;
    try {
      await API.delete(`sites/${id}/`);
      setMsg(t('sites.deletedForever'));
      load();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || t('sites.deleteError'));
    }
  };

  const toggleRow = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div>
      <div className="page-head">
        <h2>{t('sites.title')}</h2>
        {isAdmin && (
          <button className="btn btn-secondary" onClick={() => setShowTrash((v) => !v)}>
            <Archive size={16} /> {showTrash ? t('sites.back') : t('sites.trash')}
          </button>
        )}
      </div>

      {msg && <p className="alert alert-success">{msg}</p>}
      {error && <p className="alert alert-danger">{error}</p>}

      {isAdmin && !showTrash && (
        <div className="card">
          <h3>
            <Plus size={16} /> {t('sites.new')}
          </h3>
          <form onSubmit={handleCreate} className="grid-form">
            <label>
              {t('sites.name')}
              <input type="text" required value={nom} onChange={(e) => setNom(e.target.value)} />
            </label>
            <label>
              {t('sites.city')}
              <input type="text" value={ville} onChange={(e) => setVille(e.target.value)} />
            </label>
            <label>
              {t('sites.address')}
              <input type="text" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
            </label>
            <label>
              {t('sites.phone')}
              <input type="text" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
            </label>
            <div className="grid-actions">
              <button type="submit" className="btn btn-primary">
                {t('sites.create')}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="muted">{t('common.loading')}</p>
      ) : sites.length === 0 ? (
        <p className="muted">{showTrash ? t('sites.trashEmpty') : t('sites.empty')}</p>
      ) : (
        <div className="table-wrap">
          <table className="site-table">
            <thead>
              <tr>
                <th />
                <th>{t('sites.name')}</th>
                <th>{t('sites.city')}</th>
                <th>{t('sites.address')}</th>
                <th>{t('sites.phone')}</th>
                <th>{t('sites.pannes')}</th>
                <th>{t('sites.infos')}</th>
                {isAdmin && <th />}
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => {
                const open = expanded.has(s.id);
                return (
                  <SiteRow
                    key={s.id}
                    site={s}
                    open={open}
                    isAdmin={isAdmin}
                    trash={showTrash}
                    onToggle={() => toggleRow(s.id)}
                    onArchive={() => handleArchive(s.id, s.nom)}
                    onRestore={() => handleRestore(s.id)}
                    onDeleteForever={() => handleDeleteForever(s.id, s.nom)}
                    t={t}
                    formatDate={formatDate}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SiteRow({ site: s, open, isAdmin, trash, onToggle, onArchive, onRestore, onDeleteForever, t, formatDate }) {
  const colSpan = isAdmin ? 8 : 7;
  return (
    <>
      <tr className={`site-main-row${trash ? ' archived-row' : ''}`} onClick={onToggle}>
        <td className="expand-cell">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </td>
        <td>
          <strong>{s.nom}</strong>
          {trash && <span className="archived-tag">{t('sites.trash')}</span>}
        </td>
        <td>
          <span className="cell-icon">
            <MapPin size={14} /> {s.ville || '—'}
          </span>
        </td>
        <td>{s.adresse || '—'}</td>
        <td>
          {s.telephone ? (
            <span className="cell-icon">
              <Phone size={14} /> {s.telephone}
            </span>
          ) : (
            '—'
          )}
        </td>
        <td>
          <span className="count-badge">{s.nb_pannes ?? 0}</span>
        </td>
        <td>
          <span className="count-badge count-badge-alt">{s.nb_informaticiens ?? 0}</span>
        </td>
        {isAdmin && (
          <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
            {trash ? (
              <div className="actions">
                <button className="icon-btn" onClick={onRestore} aria-label={t('sites.restore')} title={t('sites.restore')}>
                  <RotateCcw size={16} />
                </button>
                <button className="icon-btn danger" onClick={onDeleteForever} aria-label={t('sites.deleteForever')} title={t('sites.deleteForever')}>
                  <TrashForever size={16} />
                </button>
              </div>
            ) : (
              <button className="icon-btn danger" onClick={onArchive} aria-label={t('common.delete')} title={t('common.delete')}>
                <Trash2 size={16} />
              </button>
            )}
          </td>
        )}
      </tr>
      {open && (
        <tr className="site-detail-row">
          <td colSpan={colSpan}>
            <div className="site-detail">
              <h4>
                {t('sites.infos')} — {s.nom}
              </h4>
              {s.informaticiens?.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>{t('table.informaticien')}</th>
                      <th>{t('table.email')}</th>
                      <th>{t('table.specialty')}</th>
                      <th>{t('table.online')}</th>
                      <th>{t('table.lastLogin')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.informaticiens.map((i) => (
                      <tr key={i.id}>
                        <td>{i.username}</td>
                        <td>{i.email || '—'}</td>
                        <td>{i.specialite ? t(`specialite.${i.specialite}`) : '—'}</td>
                        <td>
                          <OnlineBadge connecte={i.connecte} />
                        </td>
                        <td>{formatDate(i.derniere_connexion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted">{t('sites.noInfos')}</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
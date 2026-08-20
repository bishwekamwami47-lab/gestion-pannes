import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, AlertTriangle, CheckCircle2, ClipboardList, Filter, X, Send } from 'lucide-react';
import API from '../api';
import StatutBadge from '../components/StatutBadge';
import OnlineBadge from '../components/OnlineBadge';
import NouvellePanneModal from '../components/NouvellePanneModal';
import { useAuth } from '../auth';
import { useLang } from '../i18n';
import { STATUT_KEYS, STATUT_BG, STATUT_COLORS } from '../constants';

export default function Dashboard() {
  const { user } = useAuth();
  const { t, formatDate, lang } = useLang();
  const isAdmin = user?.role === 'ADMIN_GENERAL';

  const [sites, setSites] = useState([]);
  const [formSite, setFormSite] = useState('');
  const [formResponsable, setFormResponsable] = useState('');
  const [formStatut, setFormStatut] = useState('');
  const [filtres, setFiltres] = useState({ site: '', responsable: '', statut: '' });

  const [stats, setStats] = useState(null);
  const [recentes, setRecentes] = useState([]);
  const [mesRecentes, setMesRecentes] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [listStatut, setListStatut] = useState(null);
  const [listMine, setListMine] = useState(true);
  const [listPannes, setListPannes] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');

  useEffect(() => {
    API.get('sites/')
      .then((res) => setSites(res.data.results || res.data))
      .catch(() => setSites([]));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtres.site) params.set('site', filtres.site);
    if (filtres.responsable) params.set('responsable', filtres.responsable);
    if (filtres.statut) params.set('statut', filtres.statut);
    const qs = params.toString();

    Promise.all([
      API.get(`pannes/stats/${qs ? `?${qs}` : ''}`),
      API.get(`pannes/?page_size=5${qs ? `&${qs}` : ''}`),
      API.get(`pannes/?page_size=5&responsable=me${qs ? `&${qs}` : ''}`),
    ])
      .then(([s, p, mp]) => {
        setStats(s.data);
        setRecentes(p.data.results || p.data);
        setMesRecentes(mp.data.results || mp.data);
        setError('');
      })
      .catch(() => setError(t('dashboard.loadError')))
      .finally(() => setLoading(false));
  }, [filtres, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReset = () => {
    setFormSite('');
    setFormResponsable('');
    setFormStatut('');
    setFiltres({ site: '', responsable: '', statut: '' });
  };

  const selectSite = (value) => {
    setFormSite(value);
    setFormResponsable('');
    setFiltres((f) => ({ ...f, site: value, responsable: '' }));
  };

  const selectResponsable = (value) => {
    setFormResponsable(value);
    setFiltres((f) => ({ ...f, responsable: value }));
  };

  const selectStatut = (value) => {
    setFormStatut(value);
    setFiltres((f) => ({ ...f, statut: value }));
  };

  const panelClass = (active) => (active ? 'option-panel active' : 'option-panel');

  const openMyList = (statut, mine) => {
    setListStatut(statut);
    setListMine(mine);
    setListPannes([]);
    setListError('');
    setListLoading(true);
    const params = new URLSearchParams({ page_size: '100' });
    if (mine) params.set('responsable', 'me');
    if (statut) params.set('statut', statut);
    API.get(`pannes/?${params.toString()}`)
      .then((res) => setListPannes(res.data.results || res.data))
      .catch(() => setListError(t('dashboard.loadError')))
      .finally(() => setListLoading(false));
  };

  const listTitle = () => {
    const mine = listMine;
    if (listStatut === 'EN_COURS') {
      return mine ? t('dashboard.myInProgress') : t('dashboard.inProgress');
    }
    if (listStatut === 'RESOLU') {
      return mine ? t('dashboard.myResolved') : t('dashboard.resolved');
    }
    if (listStatut === 'TRANSFERT_EXTERNE') {
      return t('dashboard.myTransfer');
    }
    return mine ? t('dashboard.myTotal') : t('dashboard.total');
  };

  if (loading) {
    return <p className="muted">{t('common.loading')}</p>;
  }
  if (error) {
    return <p className="alert alert-danger">{error}</p>;
  }

  const myCards = [
    { label: t('dashboard.myTotal'), value: stats?.mes_total ?? 0, icon: ClipboardList, color: 'var(--card-blue)', statut: '' },
    { label: t('dashboard.myInProgress'), value: stats?.mes_en_cours ?? 0, icon: AlertTriangle, color: 'var(--card-amber)', statut: 'EN_COURS' },
    { label: t('dashboard.myResolved'), value: stats?.mes_resolues ?? 0, icon: CheckCircle2, color: 'var(--card-green)', statut: 'RESOLU' },
    { label: t('dashboard.myTransfer'), value: stats?.mes_a_transferer ?? 0, icon: Send, color: 'var(--card-red)', statut: 'TRANSFERT_EXTERNE' },
  ];

  const globalCards = [
    { label: t('dashboard.total'), value: stats?.total ?? 0, icon: ClipboardList, color: 'var(--card-blue)', statut: '' },
    { label: t('dashboard.inProgress'), value: stats?.en_cours ?? 0, icon: AlertTriangle, color: 'var(--card-amber)', statut: 'EN_COURS' },
    { label: t('dashboard.resolved'), value: stats?.resolues ?? 0, icon: CheckCircle2, color: 'var(--card-green)', statut: 'RESOLU' },
    { label: t('dashboard.myTransfer'), value: stats?.a_transferer ?? 0, icon: Send, color: 'var(--card-red)', statut: 'TRANSFERT_EXTERNE' },
  ];

  const selectedSite = sites.find((s) => String(s.id) === formSite);
  const siteInfos = selectedSite?.informaticiens || [];
  const selectedInfo = siteInfos.find((i) => String(i.id) === formResponsable);

  const renderMiniList = (rows, emptyMsg) =>
    rows.length === 0 ? (
      <p className="muted">{emptyMsg}</p>
    ) : (
      <div className="mini-list">
        {rows.map((p) => (
          <Link to={`/pannes/${p.id}`} className="mini-card" key={p.id}>
            <span className="mini-id">#{p.id}</span>
            <span className="mini-title">{p.titre}</span>
            <span className="mini-site">{p.site_nom || '—'}</span>
            <StatutBadge statut={p.statut} />
            <span className="mini-date">{formatDate(p.date_declaration)}</span>
          </Link>
        ))}
      </div>
    );

  const todayStr = new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div>
      <div className="dash-head">
        <div className="dash-head-left">
          <h2>{t('dashboard.title')}</h2>
          <p className="dash-greeting">
            {t('dashboard.welcome')} <strong>{user?.username}</strong> — {t(`role.${user?.role}`)}
          </p>
        </div>
        <div className="dash-head-right">
          <span className="dash-date">{todayStr}</span>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> {t('dashboard.report')}
          </button>
        </div>
      </div>

      <div className="card profile-card">
        <div className="avatar">{user?.username?.charAt(0)?.toUpperCase()}</div>
        <div className="profile-info">
          <strong>{user?.username}</strong>
          <span className="muted">{user?.email || '—'}</span>
          <span className="muted">{t(`role.${user?.role}`)}</span>
          {user?.site_nom && <span className="muted">{user.site_nom}</span>}
          {user?.role === 'INFORMATICIEN' && user?.specialite && (
            <span className="muted">{t(`specialite.${user.specialite}`)}</span>
          )}
        </div>
        <div className="profile-meta">
          <OnlineBadge connecte={user?.connecte} />
          <span className="muted">
            {t('table.lastLogin')} : {formatDate(user?.derniere_connexion)}
          </span>
        </div>
      </div>

      <div className="card filter-form">
        <div className="filter-form-head">
          <h3>
            <Filter size={16} /> {t('dashboard.filterTitle')}
          </h3>
          <button className="btn btn-secondary" type="button" onClick={handleReset}>
            {t('dashboard.reset')}
          </button>
        </div>

        <div className="option-group">
          <span className="option-label">{t('table.site')}</span>
          {isAdmin ? (
            <div className="option-panels">
              <button
                type="button"
                className={panelClass(formSite === '')}
                onClick={() => selectSite('')}
              >
                {t('nav.allSites')}
              </button>
              {sites.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className={panelClass(formSite === String(s.id))}
                  onClick={() => selectSite(String(s.id))}
                >
                  {s.nom}
                  {s.nb_pannes ? <small>{s.nb_pannes}</small> : null}
                </button>
              ))}
            </div>
          ) : (
            <div className="fixed-site">{sites[0]?.nom || user?.site_nom || '—'}</div>
          )}
        </div>

        {isAdmin && formSite && (
          <div className="option-group">
            <span className="option-label">{t('dashboard.infosGroup')}</span>
            <div className="option-panels">
              <button
                type="button"
                className={panelClass(formResponsable === '')}
                onClick={() => selectResponsable('')}
              >
                {t('dashboard.allInfos')}
              </button>
              {(siteInfos || []).map((i) => (
                <button
                  type="button"
                  key={i.id}
                  className={panelClass(formResponsable === String(i.id))}
                  onClick={() => selectResponsable(String(i.id))}
                >
                  <span className={i.connecte ? 'dot-online' : 'dot-offline'} />
                  {i.username}
                  {i.specialite ? <small>{t(`specialite.${i.specialite}`)}</small> : null}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="option-group">
          <span className="option-label">{t('table.status')}</span>
          <div className="option-panels">
            <button
              type="button"
              className={panelClass(formStatut === '')}
              onClick={() => selectStatut('')}
            >
              {t('common.allStatuses')}
            </button>
            {STATUT_KEYS.map((key) => {
              const active = formStatut === key;
              return (
                <button
                  type="button"
                  key={key}
                  className={panelClass(active)}
                  style={
                    active
                      ? {
                          backgroundColor: STATUT_BG[key],
                          borderColor: STATUT_COLORS[key],
                          color: STATUT_COLORS[key],
                        }
                      : undefined
                  }
                  onClick={() => selectStatut(key)}
                >
                  {t(`statut.${key}`)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {formSite && (
        <p className="info-banner">
          {selectedInfo
            ? t('dashboard.viewingInfo', { name: selectedInfo.username })
            : t('dashboard.viewingSite', { name: selectedSite?.nom })}
        </p>
      )}

      <div className="dash-grid">
        {!formSite && (
          <section className="dash-col">
            <div className="section-head">
              <span className="section-dot dot-blue" />
              <h3 className="section-title">{t('dashboard.mySection')}</h3>
            </div>
            <div className="cards">
              {myCards.map((c) => (
                <div
                  className="card card-clickable"
                  key={c.label}
                  onClick={() => openMyList(c.statut, true)}
                >
                  <span
                    className="card-icon"
                    style={{ backgroundColor: `color-mix(in srgb, ${c.color} 14%, white)` }}
                  >
                    <c.icon size={24} style={{ color: c.color }} />
                  </span>
                  <div>
                    <div className="card-value">{c.value}</div>
                    <div className="card-label">{c.label}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="card grow">
              <h3>{t('dashboard.myRecent')}</h3>
              {renderMiniList(mesRecentes, t('dashboard.myEmpty'))}
            </div>
          </section>
        )}

        {isAdmin && (
          <section className="dash-col">
            <div className="section-head">
              <span className="section-dot dot-green" />
              <h3 className="section-title">{t('dashboard.globalSection')}</h3>
            </div>
            <div className="cards">
              {globalCards.map((c) => (
                <div
                  className="card card-clickable"
                  key={c.label}
                  onClick={() => openMyList(c.statut, false)}
                >
                  <span
                    className="card-icon"
                    style={{ backgroundColor: `color-mix(in srgb, ${c.color} 14%, white)` }}
                  >
                    <c.icon size={24} style={{ color: c.color }} />
                  </span>
                  <div>
                    <div className="card-value">{c.value}</div>
                    <div className="card-label">{c.label}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="card grow">
              <h3>{t('dashboard.recent')}</h3>
              {renderMiniList(recentes, t('dashboard.empty'))}
            </div>
          </section>
        )}
      </div>

      {isAdmin && stats?.par_site?.length > 0 && (
        <div className="card">
          <h3>{t('dashboard.bySite')}</h3>
          <div className="site-stats">
            {stats.par_site.map((s) => {
              const pct = stats.total ? Math.round((s.total / stats.total) * 100) : 0;
              return (
                <div
                  key={s.id || s.site__nom}
                  className="site-stat site-stat-clickable"
                  onClick={() => selectSite(String(s.id))}
                  title={t('dashboard.viewSite', { name: s.site__nom })}
                >
                  <div className="site-stat-head">
                    <span>{s.site__nom}</span>
                    <strong>{s.total}</strong>
                  </div>
                  <div className="site-stat-bar">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <small className="muted">{pct}%</small>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <NouvellePanneModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPanneCreated={load}
      />

      {listStatut !== null && (
        <div className="modal-backdrop" onClick={() => setListStatut(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{listTitle()}</h3>
              <button
                className="icon-btn"
                onClick={() => setListStatut(null)}
                aria-label={t('common.cancel')}
              >
                <X size={18} />
              </button>
            </div>
            {listError && <p className="alert alert-danger">{listError}</p>}
            {listLoading ? (
              <p className="muted">{t('common.loading')}</p>
            ) : listPannes.length === 0 ? (
              <p className="muted">{t('dashboard.listEmpty')}</p>
            ) : (
              <div className="mini-list">
                {listPannes.map((p) => (
                  <Link
                    to={`/pannes/${p.id}`}
                    className="mini-card"
                    key={p.id}
                    onClick={() => setListStatut(null)}
                  >
                    <span className="mini-id">#{p.id}</span>
                    <span className="mini-title">{p.titre}</span>
                    <span className="mini-site">{p.site_nom || '—'}</span>
                    <StatutBadge statut={p.statut} />
                    <span className="mini-date">{formatDate(p.date_declaration)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
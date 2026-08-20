import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import API from '../api';
import StatutBadge from '../components/StatutBadge';
import NouvellePanneModal from '../components/NouvellePanneModal';
import { useLang } from '../i18n';
import { STATUT_KEYS, STATUT_BG, STATUT_COLORS } from '../constants';

const PAGE_SIZE = 12;

export default function Pannes() {
  const { t, formatDate } = useLang();

  const [sites, setSites] = useState([]);
  const [site, setSite] = useState('');
  const [statut, setStatut] = useState('');
  const [titreInput, setTitreInput] = useState('');
  const [titre, setTitre] = useState('');

  const [pannes, setPannes] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [nbPages, setNbPages] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    API.get('sites/')
      .then((res) => setSites(res.data.results || res.data))
      .catch(() => setSites([]));
  }, []);

  const load = useCallback(
    (p) => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', p);
      params.set('page_size', PAGE_SIZE);
      if (site) params.set('site', site);
      if (statut) params.set('statut', statut);
      if (titre) params.set('titre', titre);
      API.get(`pannes/?${params.toString()}`)
        .then((res) => {
          const rows = res.data.results || res.data;
          const count = res.data.count ?? rows.length;
          setPannes(rows);
          setTotal(count);
          setNbPages(Math.max(1, Math.ceil(count / PAGE_SIZE)));
          setPage(p);
          setError('');
        })
        .catch(() => setError(t('pannes.loadError')))
        .finally(() => setLoading(false));
    },
    [site, statut, titre, t]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const handleSearch = (e) => {
    e.preventDefault();
    setTitre(titreInput);
  };

  const selectSite = (v) => setSite(v);
  const selectStatut = (v) => setStatut(v);
  const panelClass = (active) => (active ? 'option-panel active' : 'option-panel');

  return (
    <div>
      <div className="page-head">
        <h2>{t('pannes.title', { total })}</h2>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> {t('dashboard.report')}
        </button>
      </div>

      <div className="card filter-form">
        <div className="filter-form-head">
          <h3>
            <Search size={16} /> {t('pannes.filters')}
          </h3>
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="search"
              placeholder={t('pannes.searchPlaceholder')}
              value={titreInput}
              onChange={(e) => setTitreInput(e.target.value)}
            />
            <button className="btn btn-secondary" type="submit">
              <Search size={16} /> {t('common.search')}
            </button>
          </form>
        </div>

        <div className="option-group">
          <span className="option-label">{t('table.site')}</span>
          <div className="option-panels">
            <button
              type="button"
              className={panelClass(site === '')}
              onClick={() => selectSite('')}
            >
              {t('nav.allSites')}
            </button>
            {sites.map((s) => (
              <button
                type="button"
                key={s.id}
                className={panelClass(site === String(s.id))}
                onClick={() => selectSite(String(s.id))}
              >
                {s.nom}
              </button>
            ))}
          </div>
        </div>

        <div className="option-group">
          <span className="option-label">{t('table.status')}</span>
          <div className="option-panels">
            <button
              type="button"
              className={panelClass(statut === '')}
              onClick={() => selectStatut('')}
            >
              {t('common.allStatuses')}
            </button>
            {STATUT_KEYS.map((key) => {
              const active = statut === key;
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

      {loading ? (
        <p className="muted">{t('common.loading')}</p>
      ) : error ? (
        <p className="alert alert-danger">{error}</p>
      ) : pannes.length === 0 ? (
        <p className="muted">{t('pannes.noResults')}</p>
      ) : (
        <>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>{t('table.id')}</th>
                  <th>{t('table.title')}</th>
                  <th>{t('table.site')}</th>
                  <th>{t('table.requester')}</th>
                  <th>{t('table.status')}</th>
                  <th>{t('table.responsible')}</th>
                  <th>{t('table.date')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pannes.map((p) => (
                  <tr key={p.id}>
                    <td>#{p.id}</td>
                    <td>{p.titre}</td>
                    <td>{p.site_nom || '—'}</td>
                    <td>
                      {p.service_demandeur}
                      {p.contact_demandeur && (
                        <small className="muted"> ({p.contact_demandeur})</small>
                      )}
                    </td>
                    <td>
                      <StatutBadge statut={p.statut} />
                    </td>
                    <td>{p.responsable_username || '—'}</td>
                    <td>{formatDate(p.date_declaration)}</td>
                    <td>
                      <Link to={`/pannes/${p.id}`} className="btn-link">
                        {t('common.details')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {nbPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-secondary"
                disabled={page <= 1}
                onClick={() => load(page - 1)}
              >
                {t('common.previous')}
              </button>
              <span>{t('common.page', { page, total: nbPages })}</span>
              <button
                className="btn btn-secondary"
                disabled={page >= nbPages}
                onClick={() => load(page + 1)}
              >
                {t('common.next')}
              </button>
            </div>
          )}
        </>
      )}

      <NouvellePanneModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPanneCreated={() => load(page)}
      />
    </div>
  );
}
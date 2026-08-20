import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import API from '../api';
import StatutBadge from '../components/StatutBadge';
import ChangerStatutModal from '../components/ChangerStatutModal';
import { useLang } from '../i18n';

export default function PanneDetail() {
  const { id } = useParams();
  const { t, formatDate } = useLang();
  const [panne, setPanne] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    API.get(`pannes/${id}/`)
      .then((res) => {
        setPanne(res.data);
        setError('');
      })
      .catch(() => setError(t('detail.loadError')))
      .finally(() => setLoading(false));
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="muted">{t('common.loading')}</p>;
  }
  if (error) {
    return <p className="alert alert-danger">{error}</p>;
  }
  if (!panne) {
    return null;
  }

  return (
    <div>
      <Link to="/pannes" className="btn-link back-link">
        <ArrowLeft size={16} /> {t('detail.back')}
      </Link>

      <div className="page-head">
        <h2>
          {t('table.id')} #{panne.id} — {panne.titre}
        </h2>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <RefreshCw size={16} /> {t('detail.changeStatus')}
        </button>
      </div>

      <div className="detail-grid">
        <div className="card">
          <h3>{t('detail.info')}</h3>
          <dl className="details">
            <div>
              <dt>{t('detail.status')}</dt>
              <dd>
                <StatutBadge statut={panne.statut} />
              </dd>
            </div>
            <div>
              <dt>{t('detail.site')}</dt>
              <dd>{panne.site_nom || '—'}</dd>
            </div>
            <div>
              <dt>{t('detail.service')}</dt>
              <dd>{panne.service_demandeur}</dd>
            </div>
            <div>
              <dt>{t('detail.contact')}</dt>
              <dd>{panne.contact_demandeur || '—'}</dd>
            </div>
            <div>
              <dt>{t('detail.responsible')}</dt>
              <dd>{panne.responsable_username || '—'}</dd>
            </div>
            <div>
              <dt>{t('detail.declaredAt')}</dt>
              <dd>{formatDate(panne.date_declaration)}</dd>
            </div>
            <div>
              <dt>{t('detail.resolvedAt')}</dt>
              <dd>{formatDate(panne.date_resolution)}</dd>
            </div>
            <div>
              <dt>{t('detail.description')}</dt>
              <dd>{panne.description}</dd>
            </div>
          </dl>
        </div>

        <div className="card">
          <h3>{t('detail.history')}</h3>
          {panne.historique.length === 0 ? (
            <p className="muted">{t('detail.noHistory')}</p>
          ) : (
            <ol className="timeline">
              {panne.historique.map((h) => (
                <li key={h.id}>
                  <div className="timeline-dot" />
                  <div className="timeline-body">
                    <div className="timeline-head">
                      <strong>
                        {h.ancien_statut ? t(`statut.${h.ancien_statut}`) : t('detail.created')} →{' '}
                        {t(`statut.${h.nouveau_statut}`)}
                      </strong>
                      <span className="muted">{formatDate(h.cree_le)}</span>
                    </div>
                    <div className="muted">
                      {t('detail.by', { user: h.auteur_username || '—' })}
                    </div>
                    {h.commentaire && <p>{h.commentaire}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <ChangerStatutModal
        panne={panne}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onChanged={load}
      />
    </div>
  );
}
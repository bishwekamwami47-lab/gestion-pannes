import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import API from '../api';
import { useAuth } from '../auth';
import { useLang } from '../i18n';
import { STATUT_KEYS } from '../constants';

export default function NouvellePanneModal({ isOpen, onClose, onPanneCreated }) {
  const { user } = useAuth();
  const { t } = useLang();
  const isAdmin = user?.role === 'ADMIN_GENERAL';

  const [serviceDemandeur, setServiceDemandeur] = useState('');
  const [contactDemandeur, setContactDemandeur] = useState('');
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [statut, setStatut] = useState('EN_COURS');
  const [site, setSite] = useState('');
  const [sites, setSites] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && isAdmin) {
      API.get('sites/')
        .then((res) => setSites(res.data.results || res.data))
        .catch(() => setSites([]));
    }
  }, [isOpen, isAdmin]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        service_demandeur: serviceDemandeur,
        contact_demandeur: contactDemandeur,
        titre,
        description,
        statut,
      };
      if (isAdmin) {
        payload.site = site;
      }
      await API.post('pannes/', payload);
      setServiceDemandeur('');
      setContactDemandeur('');
      setTitre('');
      setDescription('');
      setStatut('EN_COURS');
      setSite('');
      onPanneCreated();
      onClose();
    } catch (err) {
      const detail = err.response?.data;
      if (detail?.site) {
        setError(detail.site.join(' '));
      } else {
        setError(t('modal.panne.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('modal.panne.new')}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.cancel')}>
            <X size={18} />
          </button>
        </div>
        {error && <p className="alert alert-danger">{error}</p>}
        <form onSubmit={handleSubmit}>
          {isAdmin && (
            <label>
              {t('modal.panne.site')}
              <select value={site} onChange={(e) => setSite(e.target.value)} required>
                <option value="">{t('modal.panne.chooseSite')}</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom} ({s.ville || '—'})
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            {t('modal.panne.service')}
            <input
              type="text"
              required
              value={serviceDemandeur}
              onChange={(e) => setServiceDemandeur(e.target.value)}
              placeholder={t('modal.panne.servicePh')}
            />
          </label>
          <label>
            {t('modal.panne.contact')}
            <input
              type="text"
              value={contactDemandeur}
              onChange={(e) => setContactDemandeur(e.target.value)}
              placeholder={t('modal.panne.contactPh')}
            />
          </label>
          <label>
            {t('modal.panne.title')}
            <input
              type="text"
              required
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder={t('modal.panne.titlePh')}
            />
          </label>
          <label>
            {t('modal.panne.description')}
            <textarea
              required
              rows="4"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('modal.panne.descriptionPh')}
            />
          </label>
          <label>
            {t('modal.panne.status')}
            <select value={statut} onChange={(e) => setStatut(e.target.value)}>
              {STATUT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(`statut.${key}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
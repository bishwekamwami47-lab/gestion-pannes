import { useState } from 'react';
import { X } from 'lucide-react';
import API from '../api';
import { useLang } from '../i18n';
import { STATUT_KEYS } from '../constants';

export default function ChangerStatutModal({ panne, isOpen, onClose, onChanged }) {
  const { t } = useLang();
  const [statut, setStatut] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await API.post(`pannes/${panne.id}/changer_statut/`, {
        statut,
        commentaire,
      });
      onChanged();
      onClose();
    } catch (err) {
      const detail = err.response?.data;
      if (detail?.statut) {
        setError(Array.isArray(detail.statut) ? detail.statut.join(' ') : detail.statut);
      } else {
        setError(t('modal.statusError'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('modal.status.change')}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.cancel')}>
            <X size={18} />
          </button>
        </div>
        <p className="muted">
          {t('table.id')} <strong>#{panne.id}</strong> — {panne.titre}
        </p>
        {error && <p className="alert alert-danger">{error}</p>}
        <form onSubmit={handleSubmit}>
          <label>
            {t('modal.status.newStatus')}
            <select value={statut} onChange={(e) => setStatut(e.target.value)} required>
              <option value="">{t('modal.status.choose')}</option>
              {STATUT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(`statut.${key}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('modal.comment')}
            <textarea
              rows="3"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder={t('modal.commentPlaceholder')}
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t('common.saving') : t('modal.validate')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
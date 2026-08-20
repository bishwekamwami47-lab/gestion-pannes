import { useLang } from '../i18n';
import { STATUT_COLORS, STATUT_BG } from '../constants';

export default function StatutBadge({ statut }) {
  const { t } = useLang();
  return (
    <span
      className="badge"
      style={{
        backgroundColor: STATUT_BG[statut] || '#eee',
        color: STATUT_COLORS[statut] || '#333',
      }}
    >
      {t(`statut.${statut}`)}
    </span>
  );
}
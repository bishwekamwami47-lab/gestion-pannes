import { useLang } from '../i18n';

export default function OnlineBadge({ connecte }) {
  const { t } = useLang();
  return connecte ? (
    <span className="badge" style={{ backgroundColor: '#d4edda', color: '#155724' }}>
      {t('online.online')}
    </span>
  ) : (
    <span className="badge" style={{ backgroundColor: '#f8d7da', color: '#721c24' }}>
      {t('online.offline')}
    </span>
  );
}
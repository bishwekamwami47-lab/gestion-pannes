import { useLang, LANGUAGES } from '../i18n';

export default function LangToggle({ align = 'right' }) {
  const { lang, setLanguage } = useLang();

  return (
    <div className={`lang-toggle ${align === 'center' ? 'center' : ''}`} role="group" aria-label="Language">
      {Object.entries(LANGUAGES).map(([code, meta]) => (
        <button
          key={code}
          type="button"
          className={lang === code ? 'active' : ''}
          onClick={() => setLanguage(code)}
        >
          {meta.name}
        </button>
      ))}
    </div>
  );
}
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Home, ListChecks, Building2, Users, Activity } from 'lucide-react';
import { useAuth } from '../auth';
import { useLang } from '../i18n';
import LangToggle from './LangToggle';

export default function Layout() {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN_GENERAL';

  const menu = [
    { to: '/', end: true, icon: Home, label: t('nav.dashboard') },
    { to: '/pannes', icon: ListChecks, label: t('nav.pannes') },
    { to: '/sites', icon: Building2, label: t('nav.sites') },
  ];

  if (isAdmin) {
    menu.push({ to: '/utilisateurs', icon: Users, label: t('nav.users') });
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-logo">
            <Activity size={20} />
          </span>
          <strong>{t('app.title')}</strong>
        </div>

        <nav className="sidebar-nav">
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-user">
            <div className="avatar">{user?.username?.charAt(0)?.toUpperCase()}</div>
            <div>
              <strong>{user?.username}</strong>
              <small>
                {t(`role.${user?.role}`)}
                {user?.site_nom ? ` · ${user.site_nom}` : ''}
              </small>
            </div>
          </div>
          <button className="btn btn-secondary sidebar-logout" onClick={handleLogout}>
            <LogOut size={16} /> {t('nav.logout')}
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="brand">
            <strong>{user?.username}</strong>
            <small>{user?.site_nom || t('nav.allSites')}</small>
          </div>
          <div className="topbar-right">
            <LangToggle />
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
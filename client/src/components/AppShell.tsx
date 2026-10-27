import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.tsx';
import { BrandWordmark } from './Brand.tsx';
import { ThemeSwitcher } from './ThemeSwitcher.tsx';
import './AppShell.css';

const NAV = [
  { to: '/', label: 'Signals', code: '01', end: true },
  { to: '/library', label: 'Library', code: '02' },
  { to: '/vault', label: 'Vault', code: '03' },
  { to: '/graph', label: 'Graph', code: '04' },
  { to: '/next', label: 'Next move', code: '05' },
  { to: '/workspace', label: 'Workspace', code: '06' },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="shell">
      <header className="shell__bar">
        <NavLink to="/" className="shell__brand" aria-label="AlgoForge home">
          <BrandWordmark compact />
        </NavLink>
        <nav className="shell__nav" aria-label="Primary">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `shell__link ${isActive ? 'shell__link--active' : ''}`}>
              <span className="shell__code">{n.code}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="shell__right">
          <ThemeSwitcher />
          <NavLink to="/connect" className={({ isActive }) => `shell__user ${isActive ? 'shell__user--active' : ''}`} title="Connections & settings">
            <span className="shell__avatar" aria-hidden="true">
              {user?.displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="shell__name">{user?.displayName}</span>
          </NavLink>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onLogout} data-testid="logout">
            Log out
          </button>
        </div>
      </header>
      <main className="shell__main">
        <Outlet />
      </main>
    </div>
  );
}

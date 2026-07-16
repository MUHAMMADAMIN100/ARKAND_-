import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { clsx } from 'clsx';
import { navForRole } from '../nav';
import { useAuthStore } from '../../shared/auth/auth.store';
import { http } from '../../shared/api/http';
import { RoleLabel } from '@sheben/shared';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = navForRole(user?.role);
  const primary = items.filter((i) => i.primary).slice(0, 5);

  const logout = async () => {
    const rt = useAuthStore.getState().refreshToken;
    try {
      if (rt) await http.post('/auth/logout', { refreshToken: rt });
    } catch {
      /* игнор */
    }
    clear();
    navigate('/login');
  };

  return (
    <div className={styles.shell}>
      {/* Сайдбар (десктоп) */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>🪨</span>
          <span className={styles.brandText}>Щебзавод</span>
        </div>
        <nav className={styles.nav}>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => clsx(styles.navLink, isActive && styles.active)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Основная область */}
      <div className={styles.main}>
        <header className={styles.header}>
          <button className={styles.burger} onClick={() => setMenuOpen((v) => !v)} aria-label="Меню">
            ☰
          </button>
          <span className={styles.headerTitle}>Щебёночный завод</span>
          <div className={styles.userBox}>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user?.fullName}</span>
              <span className={styles.userRole}>{user ? RoleLabel[user.role] : ''}</span>
            </div>
            <button className={styles.logout} onClick={logout} aria-label="Выйти" title="Выйти">
              ⎋
            </button>
          </div>
        </header>

        {/* Мобильное выезжающее меню */}
        {menuOpen && (
          <div className={styles.drawer} onClick={() => setMenuOpen(false)}>
            <nav className={styles.drawerNav} onClick={(e) => e.stopPropagation()}>
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => clsx(styles.navLink, isActive && styles.active)}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        )}

        <main className={styles.content}>
          <Outlet />
        </main>

        {/* Нижняя навигация (мобильный) */}
        <nav className={styles.bottomNav}>
          {primary.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => clsx(styles.bottomItem, isActive && styles.bottomActive)}
            >
              <span className={styles.bottomIcon}>{item.icon}</span>
              <span className={styles.bottomLabel}>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

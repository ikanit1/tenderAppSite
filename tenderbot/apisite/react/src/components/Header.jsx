import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { getMainSiteUrl } from '../utils/siteUrl';
import { getCatalogNavItems } from '../utils/navConfig';

export default function Header({ onCartToggle }) {
  const mainSiteUrl = getMainSiteUrl().replace(/\/$/, '');
  const navItems = getCatalogNavItems();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const headerMotionProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.3, ease: 'easeOut' },
      };

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleResize = () => {
      if (window.innerWidth > 767) setMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('resize', handleResize);
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <div className="site-nav-wrapper">
      <motion.header className="site-nav-header" {...headerMotionProps}>
        <motion.div whileHover={shouldReduceMotion ? undefined : { y: -1, scale: 1.02 }} whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}>
          <a href={mainSiteUrl + '/'} className="site-nav-logo">
            <img src={mainSiteUrl + '/work.png'} alt="Логотип G&R Group" className="site-nav-logo-image" />
          </a>
        </motion.div>

        <nav className="site-nav-nav" aria-label="Основное меню">
          <ul className="site-nav-list">
            {navItems.map((item) => (
              <li key={item.label}>
                {item.isCatalog ? (
                  <NavLink
                    to={item.href}
                    className={({ isActive }) =>
                      isActive ? 'site-nav-link site-nav-link-active' : 'site-nav-link'
                    }
                    end
                  >
                    {item.label}
                  </NavLink>
                ) : (
                  <a href={item.href} className="site-nav-link" target="_blank" rel="noopener noreferrer">
                    {item.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="site-nav-right">
          {/* Кнопки действий перемещены в FloatingActionsBar */}
          <button
            type="button"
            className="site-nav-burger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={menuOpen}
          >
            <span className="site-nav-burger-line" />
            <span className="site-nav-burger-line" />
            <span className="site-nav-burger-line" />
          </button>
        </div>
      </motion.header>

      <div
        className={`site-nav-overlay ${menuOpen ? 'site-nav-overlay-open' : ''}`}
        aria-hidden={!menuOpen}
      >
        <nav className="site-nav-menu-nav" aria-label="Мобильное меню">
          <ul className="site-nav-menu-list">
            {navItems.map((item) => (
              <li key={item.label} className="site-nav-menu-item">
                {item.isCatalog ? (
                  <NavLink
                    to={item.href}
                    className={({ isActive }) =>
                      isActive ? 'site-nav-menu-link site-nav-menu-link-active' : 'site-nav-menu-link'
                    }
                    end
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </NavLink>
                ) : (
                  <a href={item.href} className="site-nav-menu-link" target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>
                    {item.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/shared/context/CartContext';
import styles from './Header.module.css';
import { navItems } from './navConfig';

interface HeaderProps {
  onCartToggle?: () => void;
}

export function Header({ onCartToggle }: HeaderProps = {} as HeaderProps) {
  const { totalCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  const headerMotionProps = shouldReduceMotion
    ? {}
    : {
        initial: { y: -16, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        transition: { duration: 0.45, ease: 'easeOut' as const },
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
    <div className={styles.wrapper}>
      <motion.header className={styles.header} {...headerMotionProps}>
        <motion.div
          whileHover={shouldReduceMotion ? undefined : { y: -1, scale: 1.02 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
        >
          <Link to="/" className={styles.logo}>
            <img src="/work.png" alt="Логотип G&R Group" className={styles.logoImage} />
          </Link>
        </motion.div>

        <nav className={styles.nav} aria-label="Основное меню">
          <ul className={styles.navList}>
            {navItems.map((item) => (
              <li key={item.to ?? item.href ?? item.label}>
                {item.external && item.href ? (
                  <a href={item.href} className={styles.navLink}>
                    {item.label}
                  </a>
                ) : (
                  <NavLink
                    to={item.to!}
                    className={({ isActive }) =>
                      isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                    }
                    end={item.to === '/'}
                  >
                    {item.label}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.right}>
          {onCartToggle && (
            <motion.button
              type="button"
              className={styles.cartButton}
              onClick={onCartToggle}
              aria-label="Открыть корзину"
              whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 3h1.5l1.5 8h7l1.5-8H13M3 3L2 1H1M3 3l1.5 8h7M6 13.5a.5.5 0 11-1 0 .5.5 0 011 0zM13 13.5a.5.5 0 11-1 0 .5.5 0 011 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <AnimatePresence>
                {totalCount > 0 && (
                  <motion.span
                    key={totalCount}
                    className={styles.cartBadge}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  >
                    {totalCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )}
          <button
            type="button"
            className={styles.burger}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={menuOpen}
          >
            <span className={styles.burgerLine} />
            <span className={styles.burgerLine} />
            <span className={styles.burgerLine} />
          </button>
        </div>
      </motion.header>

      <div
        className={`${styles.menuOverlay} ${menuOpen ? styles.menuOverlayOpen : ''}`}
        aria-hidden={!menuOpen}
      >
        <nav className={styles.menuNav} aria-label="Мобильное меню">
          <ul className={styles.menuList}>
            {navItems.map((item) => (
              <li key={item.to ?? item.href ?? item.label} className={styles.menuItem}>
                {item.external && item.href ? (
                  <a href={item.href} className={styles.menuLink} onClick={() => setMenuOpen(false)}>
                    {item.label}
                  </a>
                ) : (
                  <NavLink
                    to={item.to!}
                    className={({ isActive }) =>
                      isActive ? `${styles.menuLink} ${styles.menuLinkActive}` : styles.menuLink
                    }
                    end={item.to === '/'}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

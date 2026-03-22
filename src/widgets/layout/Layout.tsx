import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Header } from './Header';
import { Footer } from './Footer';
import { Background } from '@/widgets/background/Background';
import { CartPanel } from '@/widgets/cart/CartPanel';
import styles from './Layout.module.css';

const pageVariants = {
  initial: { opacity: 1, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

const pageTransition = { type: 'tween' as const, duration: 0.25, ease: 'easeOut' as const };

export function Layout() {
  const [cartOpen, setCartOpen] = useState(false);
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className={styles.layout}>
      <Background />
      <Header onCartToggle={() => setCartOpen((prev) => !prev)} />
      <main className={styles.main}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={shouldReduceMotion ? undefined : pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            className={styles.mainContent}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
      <CartPanel isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}

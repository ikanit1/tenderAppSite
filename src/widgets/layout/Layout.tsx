import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { Background } from '@/widgets/background/Background';
import { CartPanel } from '@/widgets/cart/CartPanel';
import styles from './Layout.module.css';

export function Layout() {
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <div className={styles.layout}>
      <Background />
      <Header onCartToggle={() => setCartOpen((prev) => !prev)} />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
      <CartPanel isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}

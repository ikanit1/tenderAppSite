import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { contactsContent } from '@/shared/content/contacts';
import { navItems } from './navConfig';
import styles from './Footer.module.css';

export function Footer() {
  const { phone, email, address, schedule, whatsapp, telegram } = contactsContent;
  const shouldReduceMotion = useReducedMotion();

  const footerMotionProps = shouldReduceMotion
    ? {}
    : {
        initial: { y: 16, opacity: 0 },
        whileInView: { y: 0, opacity: 1 },
        viewport: { once: true, amount: 0.05 },
        transition: { duration: 0.45, ease: 'easeOut' as const },
      };

  return (
    <motion.footer className={styles.footer} {...footerMotionProps}>
      <div className={styles.container}>
        <div className={styles.grid}>
          <div className={styles.block}>
            <h3 className={styles.title}>Навигация</h3>
            <ul className={styles.navList}>
              {navItems.map((item) => (
                <li key={item.to ?? item.href ?? item.label}>
                  {item.external && item.href ? (
                    <a href={item.href} className={styles.navLink}>
                      {item.label}
                    </a>
                  ) : (
                    <Link to={item.to!} className={styles.navLink}>
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.block}>
            <h3 className={styles.title}>Контакты</h3>
            <p className={styles.line}>{phone}</p>
            <p className={styles.line}>
              <a href={`mailto:${email}`}>{email}</a>
            </p>
            <p className={styles.line}>{address}</p>
            <p className={styles.line}>{schedule}</p>
          </div>
          <div className={styles.block}>
            <h3 className={styles.title}>Связаться</h3>
            <div className={styles.social}>
              <a href={whatsapp.href} target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                WhatsApp
              </a>
              <a href={telegram.href} target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                Telegram
              </a>
            </div>
            <Link to="/contacts" className={styles.cta}>
              Форма заявки
            </Link>
          </div>
        </div>
        <div className={styles.bottom}>
          <span className={styles.copyright}>
            © {new Date().getFullYear()} ТОО «G&R Group»
          </span>
        </div>
      </div>
    </motion.footer>
  );
}

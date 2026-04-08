import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { servicesList } from '@/shared/content/services';
import { Button } from '@/shared/ui/Button/Button';
import {
  viewportReveal,
  sectionVariants,
  headerVariants,
  gridVariants,
  cardVariants,
  itemVariants,
} from '@/shared/animations/sectionReveal';
import styles from './ServicesSection.module.css';

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.12 },
  },
};

interface ServicesSectionProps {
  fullPage?: boolean;
}

export function ServicesSection({ fullPage }: ServicesSectionProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className={styles.section}
      aria-labelledby="services-heading"
      variants={reduceMotion ? undefined : sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={viewportReveal}
    >
      <motion.div className={styles.container} variants={reduceMotion ? undefined : sectionVariants}>
        <motion.h2 id="services-heading" className={styles.heading} variants={reduceMotion ? undefined : headerVariants}>
          Наши услуги
        </motion.h2>
        <motion.p className={styles.subtitle} variants={reduceMotion ? undefined : headerVariants}>
          Полный спектр слаботочных систем и систем безопасности
        </motion.p>
        <motion.div
          className={styles.grid}
          variants={reduceMotion ? undefined : gridVariants}
        >
          {servicesList.map((service) => (
            <Link
              key={service.id}
              to={`/contacts?service=${service.id}`}
              className={styles.cardLink}
              aria-label={`Оставить заявку на ${service.title}`}
            >
              <motion.article
                className={styles.card}
                variants={reduceMotion ? undefined : cardVariants}
                whileHover={reduceMotion ? undefined : { y: -6, scale: 1.02 }}
                whileTap={reduceMotion ? undefined : { scale: 0.99 }}
                transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
              >
                <h3 className={styles.cardTitle}>{service.title}</h3>
                <motion.ul
                  className={styles.items}
                  variants={reduceMotion ? undefined : listVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {service.items.map((item) => (
                    <motion.li
                      key={item}
                      className={styles.item}
                      variants={reduceMotion ? undefined : itemVariants}
                    >
                      <span className={styles.itemBullet} />
                      {item}
                    </motion.li>
                  ))}
                </motion.ul>
              </motion.article>
            </Link>
          ))}
        </motion.div>
        {fullPage && (
          <motion.div className={styles.cta} variants={reduceMotion ? undefined : headerVariants}>
            <Link to="/contacts">
              <Button variant="primary">Оставить заявку</Button>
            </Link>
          </motion.div>
        )}
      </motion.div>
    </motion.section>
  );
}

import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { servicesList } from '@/shared/content/services';
import { Button } from '@/shared/ui/Button/Button';
import styles from './ServicesSection.module.css';

const sectionVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

const headerVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 280, damping: 22 },
  },
};

const gridVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 260, damping: 22 },
  },
};

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.12,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
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
      viewport={{ once: true, margin: '-60px', amount: 0.2 }}
    >
      <motion.div className={styles.container} variants={reduceMotion ? undefined : sectionVariants}>
        <motion.h2 id="services-heading" className={styles.heading} variants={reduceMotion ? undefined : headerVariants}>
          Наши услуги
        </motion.h2>
        <motion.p className={styles.subtitle} variants={reduceMotion ? undefined : headerVariants}>
          Полный спектр электромонтажных и слаботочных работ
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
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
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

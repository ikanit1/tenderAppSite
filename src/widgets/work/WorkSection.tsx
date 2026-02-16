import { Link } from 'react-router-dom';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { workContent } from '@/shared/content/work';
import styles from './WorkSection.module.css';

const sectionVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.08 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 24 },
  },
};

const listContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const listItemVariants: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 },
  },
};

const spring = { type: 'spring' as const, stiffness: 380, damping: 22 };

const MINIAPP_TELEGRAM_URL = 'https://t.me/tenderlbot';

function getMiniappUrl(): string {
  const envUrl = import.meta.env?.VITE_MINIAPP_URL;
  if (typeof envUrl === 'string' && envUrl.trim()) return envUrl.trim().replace(/\/+$/, '');
  return MINIAPP_TELEGRAM_URL;
}

export function WorkSection() {
  const reduceMotion = useReducedMotion();
  const c = workContent;
  const miniappUrl = getMiniappUrl();

  return (
    <motion.section
      className={styles.section}
      aria-labelledby="work-heading"
      variants={reduceMotion ? undefined : sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '0px', amount: 0.05 }}
    >
      <motion.div
        className={styles.hero}
        variants={reduceMotion ? undefined : sectionVariants}
        initial="hidden"
        animate="visible"
      >
        <div className={styles.heroGlow} aria-hidden />
        <motion.div variants={reduceMotion ? undefined : itemVariants} className={styles.heroLogoWrap}>
          <Link to="/" className={styles.heroLogo} aria-label="На главную">
            <img src="/work.png" alt="Логотип G&R Group" className={styles.heroLogoImage} />
          </Link>
        </motion.div>
        <motion.p className={styles.heroLabel} variants={reduceMotion ? undefined : itemVariants}>
          {c.subtitle}
        </motion.p>
        <motion.h1 id="work-heading" className={styles.heroTitle} variants={reduceMotion ? undefined : itemVariants}>
          {c.title}
        </motion.h1>
        <motion.p className={styles.heroTagline} variants={reduceMotion ? undefined : itemVariants}>
          {c.heroTagline}
        </motion.p>
        <motion.p className={styles.heroIntro} variants={reduceMotion ? undefined : itemVariants}>
          {c.intro}
        </motion.p>

        <motion.div className={styles.block} variants={reduceMotion ? undefined : itemVariants}>
          <motion.h2 className={styles.blockHeading} variants={reduceMotion ? undefined : itemVariants}>
            В мини-приложении доступно
          </motion.h2>
          <motion.ul
            className={styles.featuresList}
            variants={reduceMotion ? undefined : listContainerVariants}
          >
            {c.features.map((text) => (
              <motion.li
                key={text}
                variants={reduceMotion ? undefined : listItemVariants}
                whileHover={reduceMotion ? undefined : { x: 4, transition: spring }}
              >
                {text}
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>

        <motion.div className={styles.block} variants={reduceMotion ? undefined : itemVariants}>
          <motion.h2 className={styles.blockHeading} variants={reduceMotion ? undefined : itemVariants}>
            {c.directionsTitle}
          </motion.h2>
          <motion.p className={styles.directionsText} variants={reduceMotion ? undefined : itemVariants}>
            {c.directions}
          </motion.p>
          <motion.p className={styles.accessNote} variants={reduceMotion ? undefined : itemVariants}>
            {c.accessNote}
          </motion.p>
        </motion.div>

        <motion.div className={styles.heroCta} variants={reduceMotion ? undefined : itemVariants}>
          <motion.a
            href={miniappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.ctaPrimary}
            whileHover={reduceMotion ? undefined : { scale: 1.03, transition: spring }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
          >
            {c.ctaLabel}
          </motion.a>
        </motion.div>
      </motion.div>
    </motion.section>
  );
}

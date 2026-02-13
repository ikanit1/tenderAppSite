import { Link } from 'react-router-dom';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { digitalEcosystemContent } from '@/shared/content/digitalEcosystem';
import styles from './DigitalEcosystemSection.module.css';

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

const gridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const spring = { type: 'spring' as const, stiffness: 380, damping: 22 };

const iconVariants: Variants = {
  hidden: { scale: 0, rotate: -180 },
  visible: {
    scale: 1,
    rotate: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 20,
    },
  },
};

const iconHoverVariants = {
  scale: 1.1,
  rotate: 5,
  transition: { type: 'spring' as const, stiffness: 400, damping: 15 },
};

export function DigitalEcosystemSection() {
  const reduceMotion = useReducedMotion();
  const c = digitalEcosystemContent;

  return (
    <motion.section
      className={styles.section}
      aria-labelledby="digital-ecosystem-heading"
      variants={reduceMotion ? undefined : sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px', amount: 0.1 }}
    >
      {/* Hero */}
      <motion.div
        className={styles.hero}
        variants={reduceMotion ? undefined : sectionVariants}
        initial="hidden"
        animate="visible"
      >
        <div className={styles.heroGlow} aria-hidden />
        <motion.p className={styles.heroLabel} variants={reduceMotion ? undefined : itemVariants}>
          {c.subtitle}
        </motion.p>
        <motion.h1 id="digital-ecosystem-heading" className={styles.heroTitle} variants={reduceMotion ? undefined : itemVariants}>
          {c.title}
        </motion.h1>
        <motion.p className={styles.heroTagline} variants={reduceMotion ? undefined : itemVariants}>
          {c.heroTagline}
        </motion.p>
        <motion.p className={styles.heroIntro} variants={reduceMotion ? undefined : itemVariants}>
          {c.intro}
        </motion.p>
        <motion.div className={styles.heroCta} variants={reduceMotion ? undefined : itemVariants}>
          <a
            href="/docs/kommercheskoe-predlozhenie-IP-domofoniya-i-videonablyudenie.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.ctaPrimary}
          >
            Скачать предложение (PDF)
          </a>
          <Link to="/contacts" className={styles.ctaSecondary}>
            Обсудить проект
          </Link>
        </motion.div>
      </motion.div>

      {/* Scope — Что входит */}
      <motion.div className={styles.block} variants={reduceMotion ? undefined : sectionVariants}>
        <motion.h2 className={styles.blockHeading} variants={reduceMotion ? undefined : itemVariants}>
          Что вы получаете
        </motion.h2>
        <motion.p className={styles.blockNote} variants={reduceMotion ? undefined : itemVariants}>
          {c.scopeNote}
        </motion.p>
        <motion.div className={styles.scopeGrid} variants={reduceMotion ? undefined : gridVariants}>
          {c.scope.map((block, idx) => (
            <motion.article
              key={block.title}
              className={styles.scopeCard}
              variants={reduceMotion ? undefined : itemVariants}
              whileHover={reduceMotion ? undefined : { y: -6, transition: spring }}
              whileTap={reduceMotion ? undefined : { scale: 0.99 }}
            >
              {block.image && (
                <motion.div
                  className={styles.scopeImage}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  whileHover={reduceMotion ? undefined : { scale: 1.05 }}
                >
                  <img src={block.image} alt={block.title} loading="lazy" />
                </motion.div>
              )}
              <motion.div
                className={styles.scopeIcon}
                variants={reduceMotion ? undefined : iconVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                whileHover={reduceMotion ? undefined : iconHoverVariants}
              >
                <motion.div
                  className={styles.iconShape}
                  animate={{
                    boxShadow: [
                      '0 0 10px rgba(157, 78, 221, 0.3)',
                      '0 0 20px rgba(157, 78, 221, 0.5)',
                      '0 0 10px rgba(157, 78, 221, 0.3)',
                    ],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              </motion.div>
              <span className={styles.scopeNum}>{idx + 1}</span>
              <h3 className={styles.scopeTitle}>{block.title}</h3>
              <ul className={styles.scopeList}>
                {block.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </motion.article>
          ))}
        </motion.div>
      </motion.div>

      {/* Advantages — Почему мы */}
      <motion.div className={styles.block} variants={reduceMotion ? undefined : sectionVariants}>
        <motion.h2 className={styles.blockHeading} variants={reduceMotion ? undefined : itemVariants}>
          {c.advantagesTitle}
        </motion.h2>
        <motion.div className={styles.advGrid} variants={reduceMotion ? undefined : gridVariants}>
          {c.advantages.map((a) => (
            <motion.article
              key={a.title}
              className={styles.advCard}
              variants={reduceMotion ? undefined : itemVariants}
              whileHover={reduceMotion ? undefined : { y: -4, transition: spring }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            >
              <motion.div
                className={styles.advIcon}
                variants={reduceMotion ? undefined : iconVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                whileHover={reduceMotion ? undefined : iconHoverVariants}
              >
                <motion.div
                  className={styles.iconShape}
                  animate={{
                    boxShadow: [
                      '0 0 8px rgba(157, 78, 221, 0.3)',
                      '0 0 15px rgba(157, 78, 221, 0.5)',
                      '0 0 8px rgba(157, 78, 221, 0.3)',
                    ],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              </motion.div>
              <h3 className={styles.advTitle}>{a.title}</h3>
              <p className={styles.advText}>{a.text}</p>
            </motion.article>
          ))}
        </motion.div>
      </motion.div>

      {/* Terms — условия */}
      <motion.div className={styles.termsStrip} variants={reduceMotion ? undefined : sectionVariants}>
        <motion.h2 className={styles.blockHeading} variants={reduceMotion ? undefined : itemVariants}>
          {c.termsTitle}
        </motion.h2>
        <motion.div className={styles.termsPills} variants={reduceMotion ? undefined : gridVariants}>
          {c.terms.map((t, i) => (
            <motion.span key={i} className={styles.pill} variants={reduceMotion ? undefined : itemVariants}>
              {t}
            </motion.span>
          ))}
        </motion.div>
      </motion.div>

      {/* Service */}
      <motion.div className={styles.block} variants={reduceMotion ? undefined : sectionVariants}>
        <motion.h2 className={styles.blockHeading} variants={reduceMotion ? undefined : itemVariants}>
          {c.serviceTitle}
        </motion.h2>
        <motion.div className={styles.cardsGrid} variants={reduceMotion ? undefined : gridVariants}>
          {c.service.map((s) => (
            <motion.article
              key={s.title}
              className={styles.serviceCard}
              variants={reduceMotion ? undefined : itemVariants}
              whileHover={reduceMotion ? undefined : { y: -4, transition: spring }}
            >
              <h3 className={styles.cardTitle}>{s.title}</h3>
              <p className={styles.cardText}>{s.text}</p>
            </motion.article>
          ))}
        </motion.div>
      </motion.div>

      {/* Scale */}
      <motion.div className={styles.block} variants={reduceMotion ? undefined : sectionVariants}>
        <motion.h2 className={styles.blockHeading} variants={reduceMotion ? undefined : itemVariants}>
          {c.scaleTitle}
        </motion.h2>
        <motion.p className={styles.blockNote} variants={reduceMotion ? undefined : itemVariants}>
          {c.scaleNote}
        </motion.p>
        <motion.div className={styles.cardsGrid} variants={reduceMotion ? undefined : gridVariants}>
          {c.scale.map((s) => (
            <motion.article
              key={s.title}
              className={styles.scaleCard}
              variants={reduceMotion ? undefined : itemVariants}
              whileHover={reduceMotion ? undefined : { y: -4, transition: spring }}
            >
              <h3 className={styles.cardTitle}>{s.title}</h3>
              <p className={styles.cardText}>{s.text}</p>
            </motion.article>
          ))}
        </motion.div>
      </motion.div>

      {/* Equipment */}
      <motion.div className={styles.block} variants={reduceMotion ? undefined : sectionVariants}>
        <motion.h2 className={styles.blockHeading} variants={reduceMotion ? undefined : itemVariants}>
          {c.equipmentTitle}
        </motion.h2>
        <div className={styles.equipmentGrid}>
          {c.equipment.map((eq) => (
            <motion.article
              key={eq.title}
              className={styles.equipmentCard}
              variants={reduceMotion ? undefined : itemVariants}
              whileHover={reduceMotion ? undefined : { y: -2, transition: spring }}
            >
              <h3 className={styles.equipmentTitle}>{eq.title}</h3>
              <ul className={styles.equipmentList}>
                {eq.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </motion.article>
          ))}
        </div>
      </motion.div>

      {/* Conclusion + CTA */}
      <motion.div className={styles.ctaBlock} variants={reduceMotion ? undefined : sectionVariants}>
        <motion.p className={styles.conclusion} variants={reduceMotion ? undefined : itemVariants}>
          {c.conclusion}
        </motion.p>
        <motion.div className={styles.ctaRow} variants={reduceMotion ? undefined : itemVariants}>
          <a
            href="/docs/kommercheskoe-predlozhenie-IP-domofoniya-i-videonablyudenie.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.ctaPrimary}
          >
            Получить коммерческое предложение
          </a>
          <Link to="/contacts" className={styles.ctaSecondary}>
            Связаться с нами
          </Link>
        </motion.div>
      </motion.div>
    </motion.section>
  );
}

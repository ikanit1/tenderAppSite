import { Link } from 'react-router-dom';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { aboutContent } from '@/shared/content/home';
import { Card } from '@/shared/ui/Card/Card';
import { Button } from '@/shared/ui/Button/Button';
import styles from './AboutSection.module.css';

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.08,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 280, damping: 22 },
  },
};

export function AboutSection() {
  const { title, intro, historyTitle, historyText, advantagesTitle, advantages, missionValues, whyChoose, stats, footerText } = aboutContent;
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className={styles.section}
      aria-labelledby="about-heading"
      variants={reduceMotion ? undefined : sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '0px', amount: 0.05 }}
    >
      <div className={styles.container}>
        <motion.div className={styles.headerWrapper} variants={reduceMotion ? undefined : itemVariants}>
          <motion.h2 id="about-heading" className={styles.heading} variants={reduceMotion ? undefined : itemVariants}>
            {title}
          </motion.h2>
          <motion.img
            src="/work.png"
            alt="Логотип G&R Group"
            className={styles.logo}
            variants={reduceMotion ? undefined : itemVariants}
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.05 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            whileHover={{ scale: 1.05 }}
          />
        </motion.div>
        <motion.p className={styles.intro} variants={reduceMotion ? undefined : itemVariants}>
          {intro}
        </motion.p>
        <motion.h3 className={styles.blockTitle} variants={reduceMotion ? undefined : itemVariants}>
          Направления нашей деятельности
        </motion.h3>
        <motion.div className={styles.missionGrid} variants={reduceMotion ? undefined : sectionVariants}>
          {missionValues.map((item) => (
            <motion.div key={item.title} className={styles.missionCard} variants={reduceMotion ? undefined : itemVariants}>
              <h4 className={styles.missionTitle}>{item.title}</h4>
              <p className={styles.missionText}>{item.text}</p>
            </motion.div>
          ))}
        </motion.div>
        <motion.div className={styles.grid} variants={reduceMotion ? undefined : sectionVariants}>
          <motion.div variants={reduceMotion ? undefined : itemVariants}>
            <Card title={historyTitle} className={styles.card}>
              <div className={styles.text} style={{ whiteSpace: 'pre-line' }}>
                {historyText}
              </div>
            </Card>
          </motion.div>
          <motion.div variants={reduceMotion ? undefined : itemVariants}>
            <h3 className={styles.advTitle}>{advantagesTitle}</h3>
            <ul className={styles.list}>
              {advantages.map((item) => (
                <li key={item} className={styles.listItem}>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
        <motion.div className={styles.stats} variants={reduceMotion ? undefined : sectionVariants}>
          {stats.map((s) => (
            <motion.div key={s.label} className={styles.stat} variants={reduceMotion ? undefined : itemVariants}>
              <span className={styles.statValue}>{s.value}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </motion.div>
          ))}
        </motion.div>
        <motion.h3 className={styles.blockTitle} variants={reduceMotion ? undefined : itemVariants}>
          Почему выбирают G&R Group
        </motion.h3>
        <motion.div className={styles.whyChooseGrid} variants={reduceMotion ? undefined : sectionVariants}>
          {whyChoose.map((item) => (
            <motion.div key={item.title} className={styles.whyChooseCard} variants={reduceMotion ? undefined : itemVariants}>
              <h4 className={styles.whyChooseTitle}>{item.title}</h4>
              <p className={styles.whyChooseText}>{item.text}</p>
            </motion.div>
          ))}
        </motion.div>
        {footerText && (
          <motion.div className={styles.footerText} variants={reduceMotion ? undefined : itemVariants}>
            <p className={styles.footerParagraph}>{footerText}</p>
          </motion.div>
        )}
        <motion.div className={styles.projectsCta} variants={reduceMotion ? undefined : itemVariants}>
          <Link to="/projects">
            <Button variant="secondary">Смотреть наши проекты</Button>
          </Link>
        </motion.div>
      </div>
    </motion.section>
  );
}

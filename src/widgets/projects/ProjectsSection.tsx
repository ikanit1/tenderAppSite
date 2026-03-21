import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { projectsList } from '@/shared/content/projects';
import {
  viewportReveal,
  sectionVariants,
  headerVariants,
  gridVariants,
  cardVariants,
} from '@/shared/animations/sectionReveal';
import styles from './ProjectsSection.module.css';

const springTransition = { type: 'spring' as const, stiffness: 400, damping: 25 };

const PROJECTS_EXPANDED_KEY = 'grgroup-projects-expanded';

function loadExpandedId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const id = sessionStorage.getItem(PROJECTS_EXPANDED_KEY);
    return id && projectsList.some((p) => p.id === id) ? id : null;
  } catch {
    return null;
  }
}

const expandedVariants = {
  collapsed: { height: 0, opacity: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
  },
};

export function ProjectsSection() {
  const reduceMotion = useReducedMotion();
  const [expandedId, setExpandedIdState] = useState<string | null>(loadExpandedId);
  const setExpandedId = (id: string | null) => {
    setExpandedIdState(id);
    try {
      if (id) sessionStorage.setItem(PROJECTS_EXPANDED_KEY, id);
      else sessionStorage.removeItem(PROJECTS_EXPANDED_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <motion.section
      className={styles.section}
      aria-labelledby="projects-heading"
      variants={reduceMotion ? undefined : sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ ...viewportReveal, once: false, amount: 0.1 }}
    >
      <motion.div className={styles.container} variants={reduceMotion ? undefined : sectionVariants}>
        <motion.h2 id="projects-heading" className={styles.heading} variants={reduceMotion ? undefined : headerVariants}>
          Наши проекты
        </motion.h2>
        <motion.p className={styles.subtitle} variants={reduceMotion ? undefined : headerVariants}>
          Реализованные решения для предприятий и организаций Казахстана
        </motion.p>
        <motion.div className={styles.grid} variants={reduceMotion ? undefined : gridVariants}>
          {projectsList.map((project) => {
            const isExpanded = expandedId === project.id;
            return (
              <motion.article
                key={project.id}
                className={`${styles.card} ${isExpanded ? styles.cardExpanded : ''}`}
                variants={reduceMotion ? undefined : cardVariants}
                layout
                whileHover={reduceMotion ? undefined : { y: -4, transition: springTransition }}
                whileTap={reduceMotion ? undefined : { scale: 0.99 }}
                onClick={() => setExpandedId(isExpanded ? null : project.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setExpandedId(isExpanded ? null : project.id);
                  }
                }}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? 'Свернуть описание проекта' : 'Развернуть описание проекта'}
              >
                {project.logo && (
                  <div className={styles.logoWrap}>
                    <img src={project.logo} alt="" className={styles.logo} />
                  </div>
                )}
                <h3 className={styles.cardTitle}>{project.title}</h3>
                <p className={styles.description}>{project.description}</p>
                {project.scale && (
                  <span className={styles.scale}>{project.scale}</span>
                )}
                {project.details && project.details.length > 0 && (
                  <ul className={styles.details}>
                    {project.details.map((item) => (
                      <li key={item} className={styles.detailItem}>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
                {project.fullDescription && (
                  <motion.div
                    className={styles.expandedContent}
                    initial={false}
                    animate={isExpanded ? 'expanded' : 'collapsed'}
                    variants={reduceMotion ? undefined : expandedVariants}
                    style={{ overflow: 'hidden' }}
                  >
                    <p className={styles.fullDescription}>{project.fullDescription}</p>
                  </motion.div>
                )}
                {project.fullDescription && (
                  <span className={styles.expandHint}>
                    {isExpanded ? 'Нажмите, чтобы свернуть' : 'Нажмите, чтобы подробнее'}
                  </span>
                )}
              </motion.article>
            );
          })}
        </motion.div>
      </motion.div>
    </motion.section>
  );
}

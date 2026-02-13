import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  assistantCapabilities,
  assistantExampleQuestions,
} from '@/shared/content/assistant';
import { Button } from '@/shared/ui/Button/Button';
import { LeadForm } from '@/features/lead-form/LeadForm';
import { Modal } from '@/shared/ui/Modal/Modal';
import styles from './AssistantSection.module.css';

const sectionVariants = {
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

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 22 },
  },
};

export function AssistantSection() {
  const [showForm, setShowForm] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className={styles.section}
      aria-labelledby="assistant-heading"
      variants={reduceMotion ? undefined : sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px', amount: 0.2 }}
    >
      <div className={styles.container}>
        <motion.h2 id="assistant-heading" className={styles.heading} variants={reduceMotion ? undefined : itemVariants}>
          ИИ-Помощник
        </motion.h2>
        <motion.p className={styles.subtitle} variants={reduceMotion ? undefined : itemVariants}>
          Получите профессиональную консультацию и расчёт проекта с помощью искусственного интеллекта
        </motion.p>
        <motion.div className={styles.grid} variants={reduceMotion ? undefined : sectionVariants}>
          <motion.div className={styles.block} variants={reduceMotion ? undefined : itemVariants}>
            <h3 className={styles.blockTitle}>Возможности Умного Инженера</h3>
            <ul className={styles.list}>
              {assistantCapabilities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3 className={styles.blockTitle}>Примеры вопросов:</h3>
            <ul className={styles.examples}>
              {assistantExampleQuestions.map((q) => (
                <li key={q} className={styles.example}>
                  &quot;{q}&quot;
                </li>
              ))}
            </ul>
            <Button variant="primary" onClick={() => setShowForm(true)}>
              Оформить заявку
            </Button>
          </motion.div>
        </motion.div>
      </div>
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Оформить заявку"
      >
        <LeadForm onSuccess={() => setShowForm(false)} />
      </Modal>
    </motion.section>
  );
}

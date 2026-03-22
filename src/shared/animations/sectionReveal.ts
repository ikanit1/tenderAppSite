/**
 * Общие варианты анимации появления блоков (как на /services).
 * Используются на /projects, /calculator и при необходимости на других страницах.
 * Framer Motion; срабатывает по viewport (Intersection Observer).
 * На мобильных работает корректно; при «Уменьшить движение» (useReducedMotion) варианты отключаются.
 */
import type { Variants } from 'framer-motion';

export const viewportReveal = {
  once: true,
  margin: '0px',
  amount: 0.05 as const,
} as const;

/** Секция: скрыта → видима с лёгким stagger дочерних элементов */
export const sectionVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

/** Заголовок секции: снизу вверх, spring */
export const headerVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 22 },
  },
};

/** Сетка карточек: stagger дочерних */
export const gridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

/** Карточка (услуга, проект): снизу вверх, spring */
export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 260, damping: 22 },
  },
};

/** Элемент списка: слева направо, spring (для списков внутри карточек) */
export const itemVariants: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 },
  },
};

/** Для шагов калькулятора: появление секции (при смене шага) */
export const stepSectionVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 22 },
  },
};

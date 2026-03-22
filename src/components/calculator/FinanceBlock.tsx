import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import type { CalculatorResult } from '@/widgets/calculator/calculatorLogic';
import styles from './FinanceBlock.module.css';

interface Props {
  result: CalculatorResult;
}

function fmt(n: number) {
  return new Intl.NumberFormat('ru-KZ', {
    style: 'currency',
    currency: 'KZT',
    maximumFractionDigits: 0,
  }).format(n);
}

export function FinanceBlock({ result }: Props) {
  const paybackMonths = result.paybackMonths ?? 0;
  const paybackYears = (paybackMonths / 12).toFixed(1);
  const progressPct = Math.min(100, Math.round((paybackMonths / 60) * 100));

  return (
    <motion.div
      className={styles.wrap}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <GlassCard className={styles.card}>
        <div className={styles.header}>
          <span className={styles.icon}>💼</span>
          <div>
            <div className={styles.title}>Финансовые условия</div>
            <div className={styles.subtitle}>Инвестиционная модель ТОО G&amp;R Group</div>
          </div>
        </div>

        <div className={styles.investRow}>
          <span className={styles.investLabel}>
            Оборудование, монтаж, ПО и мобильное приложение —<br />
            <strong>полностью за счёт ТОО G&amp;R Group</strong>
          </span>
          <span className={styles.investAmount}>{fmt(result.grandTotal)}</span>
        </div>

        <div className={styles.divider} />

        <div className={styles.sectionTitle}>📱 Абонентская плата с квартиры в месяц</div>

        <div className={styles.ratesGrid}>
          <div className={styles.rateCard}>
            <span className={styles.rateIcon}>🔔</span>
            <span className={styles.rateName}>Домофония</span>
            <span className={styles.ratePrice}>
              от {(result.monthlyIntercomPerFlat ?? 0).toLocaleString('ru-KZ')} ₸
            </span>
            <span className={styles.rateDesc}>с квартиры / мес.</span>
          </div>
          <div className={styles.rateCard}>
            <span className={styles.rateIcon}>📷</span>
            <span className={styles.rateName}>Видеонаблюдение</span>
            <span className={styles.ratePrice}>
              от {(result.monthlyCctvPerFlat ?? 0).toLocaleString('ru-KZ')} ₸
            </span>
            <span className={styles.rateDesc}>с квартиры / мес.</span>
          </div>
        </div>

        <div className={styles.monthlyTotal}>
          <div className={styles.monthlyRow}>
            <span>🔔 Домофония × {result.totalFlats ?? 0} кв.</span>
            <span className={styles.mono}>{fmt(result.monthlyIntercomTotal ?? 0)}/мес</span>
          </div>
          <div className={styles.monthlyRow}>
            <span>📷 Видеонаблюдение × {result.totalFlats ?? 0} кв.</span>
            <span className={styles.mono}>{fmt(result.monthlyCctvTotal ?? 0)}/мес</span>
          </div>
          <div className={`${styles.monthlyRow} ${styles.monthlyTotalRow}`}>
            <span>Итого с дома в месяц</span>
            <span className={styles.monoAccent}>{fmt(result.monthlyTotal ?? 0)}</span>
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.sectionTitle}>📈 Срок окупаемости инвестиции</div>
        <div className={styles.paybackRow}>
          <span className={styles.paybackVal}>~{paybackMonths} мес.</span>
          <span className={styles.paybackYears}>(~{paybackYears} лет)</span>
        </div>
        <div className={styles.progressTrack}>
          <motion.div
            className={styles.progressBar}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
          />
        </div>
        <div className={styles.progressLabels}>
          <span>0</span>
          <span>2 года</span>
          <span>4 года</span>
          <span>5+ лет</span>
        </div>

        <div className={styles.disclaimer}>
          Оплата производится ежемесячно. Расчёт приблизительный, условия уточняйте у менеджера.
        </div>
      </GlassCard>
    </motion.div>
  );
}

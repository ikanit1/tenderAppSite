import { useState } from 'react';
import { motion } from 'framer-motion';
import type { CalculatorResult } from '@/widgets/calculator/calculatorLogic';
import { formatKzt } from '@/lib/calculations';
import { getDeviceImage } from '@/lib/deviceImages';
import styles from './ResultTable.module.css';

interface ResultTableProps {
  result: CalculatorResult;
  /** Показывать блок рассрочки */
  showInstallment?: boolean;
  /** Количество квартир в доме (для расчёта "с квартиры") */
  flatCount?: number;
  onFlatsChange?: (val: number) => void;
}

const cardVariants = {
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 22 } },
};

export function ResultTable({
  result,
  showInstallment = true,
  flatCount = 0,
  onFlatsChange,
}: ResultTableProps) {
  const monthsOptions = [12, 24, 36, 48, 60] as const;
  const [selectedMonths, setSelectedMonths] = useState<number>(36);
  const [initialPaymentText, setInitialPaymentText] = useState<string>('');

  const projectTotal = result.grandTotal;
  const apartmentsCount = Math.max(0, flatCount);

  const initialPayment = Math.max(0, parseInt(initialPaymentText || '0', 10) || 0);
  const remainingToInstallment = Math.max(0, projectTotal - initialPayment);
  const isFullyCovered = projectTotal > 0 && initialPayment >= projectTotal;
  const hasApartments = apartmentsCount > 0;

  const paymentsByMonths = monthsOptions.map((months) => {
    const houseMonthly = Math.floor(remainingToInstallment / months);
    const perFlat = hasApartments ? Math.floor(houseMonthly / apartmentsCount) : null;
    return { months, houseMonthly, perFlat };
  });

  const selected = paymentsByMonths.find((p) => p.months === selectedMonths) ?? paymentsByMonths[2];

  return (
    <div className={styles.wrap}>
      {result.warnings.length > 0 && (
        <motion.div className={styles.warningsBlock} variants={cardVariants} initial="visible" animate="visible">
          <h4 className={styles.warningsTitle}>Предупреждения</h4>
          <ul className={styles.warningsList}>
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </motion.div>
      )}

      {result.groups.map((group) => (
        <motion.div key={group.title} className={styles.resultGroup} variants={cardVariants} initial="visible" animate="visible">
          <h3 className={styles.resultGroupTitle}>{group.title}</h3>
          <div className={styles.tableWrap}>
            <table className={styles.resultTable}>
              <thead>
                <tr>
                  <th className={styles.thImage}>Фото</th>
                  <th>Наименование</th>
                  <th>Кол-во</th>
                  <th>Цена за ед.</th>
                  <th>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row, i) => {
                  const imgSrc = getDeviceImage(row.name);
                  return (
                    <tr key={i}>
                      <td className={styles.cellImage}>
                        {imgSrc ? (
                          <img src={imgSrc} alt="" className={styles.deviceImage} width={48} height={48} loading="lazy" />
                        ) : (
                          <span className={styles.devicePlaceholder} aria-hidden>—</span>
                        )}
                      </td>
                      <td>
                        <span className={styles.rowName}>{row.name}</span>
                        {row.note && <div className={styles.rowNote}>{row.note}</div>}
                      </td>
                      <td>{row.qty > 0 ? row.qty : '—'}</td>
                      <td>{row.unitPrice != null ? formatKzt(row.unitPrice) : '—'}</td>
                      <td className={styles.cellSum}>{formatKzt(row.sum)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={styles.groupSubtotal}>
            Итого по разделу: <strong>{formatKzt(group.subtotal)}</strong>
          </div>
        </motion.div>
      ))}

      <motion.div className={styles.totalBlock} variants={cardVariants} initial="visible" animate="visible">
        <div className={styles.totalRow}>
          <span>Оборудование</span>
          <strong>{formatKzt(result.equipment)}</strong>
        </div>
        <div className={styles.totalRow}>
          <span>Расходные материалы</span>
          <strong>{formatKzt(result.consumables ?? 0)}</strong>
        </div>
        {result.installation.breakdown?.map((item, i) => (
          <div key={i} className={styles.totalRow}>
            <span>{item.name}</span>
            <strong>{formatKzt(item.sum)}</strong>
          </div>
        ))}
        <div className={styles.totalRowHighlight}>
          <span>ИТОГО ПО ПРОЕКТУ</span>
          <strong>{formatKzt(result.grandTotal)}</strong>
        </div>
      </motion.div>

      {showInstallment && result.grandTotal > 0 && (
        <motion.div className={styles.installmentBlock} variants={cardVariants} initial="visible" animate="visible">
          <h4 className={styles.installmentTitle}>Рассрочка</h4>
          {typeof onFlatsChange === 'function' && (
            <div className={styles.installmentInputRow}>
              <label className={styles.installmentField}>
                <span className={styles.installmentFieldLabel}>Количество квартир в доме</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className={styles.installmentFieldInput}
                  value={flatCount || ''}
                  onChange={(e) => onFlatsChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  placeholder="0"
                />
              </label>
            </div>
          )}

          <div className={styles.installmentInputRow}>
            <label className={styles.installmentField}>
              <span className={styles.installmentFieldLabel}>Первоначальный взнос (₸)</span>
              <input
                type="number"
                min={0}
                step={1}
                className={styles.installmentFieldInput}
                value={initialPaymentText}
                onChange={(e) => setInitialPaymentText(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>

          {!hasApartments && (
            <p className={styles.installmentError}>Укажите количество квартир.</p>
          )}
          {isFullyCovered && (
            <p className={styles.installmentMessage}>Первоначальный взнос покрывает всю сумму проекта.</p>
          )}

          <div className={styles.installmentSummary}>
            <div className={styles.installmentSummaryRow}>
              <span className={styles.installmentSummaryLabel}>Итого по проекту</span>
              <span className={styles.installmentSummaryValue}>{formatKzt(projectTotal)}</span>
            </div>
            <div className={styles.installmentSummaryRow}>
              <span className={styles.installmentSummaryLabel}>Первоначальный взнос</span>
              <span className={styles.installmentSummaryValue}>{formatKzt(initialPayment)}</span>
            </div>
            <div className={styles.installmentSummaryRow}>
              <span className={styles.installmentSummaryLabel}>Остаток к рассрочке</span>
              <span className={styles.installmentSummaryValue}>{formatKzt(remainingToInstallment)}</span>
            </div>
            <div className={styles.installmentSummaryRow}>
              <span className={styles.installmentSummaryLabel}>Срок рассрочки</span>
              <span className={styles.installmentSummaryValue}>{selectedMonths} месяцев</span>
            </div>
            <div className={styles.installmentSummaryRow}>
              <span className={styles.installmentSummaryLabel}>Платёж в месяц с квартиры</span>
              <span className={styles.installmentSummaryValue}>
                {hasApartments && selected.perFlat != null ? `${formatKzt(selected.perFlat)} ₸` : '—'}
              </span>
            </div>
          </div>

          <div className={styles.installmentTableWrap}>
            <table className={styles.installmentTable}>
              <thead>
                <tr>
                  <th>Срок</th>
                  <th>Платёж с квартиры в месяц</th>
                </tr>
              </thead>
              <tbody>
                {paymentsByMonths.map((p) => (
                  <tr
                    key={p.months}
                    className={p.months === selectedMonths ? styles.installmentSelectedRow : undefined}
                    onClick={() => setSelectedMonths(p.months)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setSelectedMonths(p.months);
                    }}
                    aria-label={`Выбрать срок ${p.months} месяцев`}
                  >
                    <td className={styles.installmentTermCell}>{p.months} мес.</td>
                    <td className={styles.installmentAmountCell}>
                      {p.perFlat != null ? `${formatKzt(p.perFlat)} ₸` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className={styles.installmentAfterText}>
            После полного погашения рассрочки оборудование переходит в собственность ЖК.
          </p>
        </motion.div>
      )}
    </div>
  );
}

import { motion } from 'framer-motion';
import type { CalculatorResult } from '@/widgets/calculator/calculatorLogic';
import { formatKzt } from '@/lib/calculations';
import { getDeviceImage } from '@/lib/deviceImages';
import styles from './ResultTable.module.css';

interface ResultTableProps {
  result: CalculatorResult;
  /** Показывать блок рассрочки */
  showInstallment?: boolean;
  /** Количество квартир для расчёта "с квартиры" (если 0 — подставляется 200) */
  flatCount?: number;
}

const cardVariants = {
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 22 } },
};

export function ResultTable({ result, showInstallment = true, flatCount }: ResultTableProps) {
  const derivedFlats = flatCount && flatCount > 0 ? flatCount : 200;
  const perFlatMonthly = result.grandTotal > 0 ? Math.round(result.grandTotal / derivedFlats) : 0;

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

      {(result.totalCctv != null || result.totalIntercom != null) && (result.totalCctv ?? 0) + (result.totalIntercom ?? 0) > 0 && (
        <motion.div className={styles.totalBlock} variants={cardVariants} initial="visible" animate="visible">
          {result.totalCctv != null && result.totalCctv > 0 && (
            <div className={styles.totalRow}>
              <span>Итого CCTV</span>
              <strong>{formatKzt(result.totalCctv)}</strong>
            </div>
          )}
          {result.totalIntercom != null && result.totalIntercom > 0 && (
            <div className={styles.totalRow}>
              <span>Итого Домофония</span>
              <strong>{formatKzt(result.totalIntercom)}</strong>
            </div>
          )}
        </motion.div>
      )}

      <motion.div className={styles.totalBlock} variants={cardVariants} initial="visible" animate="visible">
        <div className={styles.totalRow}>
          <span>Оборудование</span>
          <strong>{formatKzt(result.equipment)}</strong>
        </div>
        <div className={styles.totalRow}>
          <span>Расходные материалы</span>
          <strong>{formatKzt(result.consumables ?? 0)}</strong>
        </div>
        <div className={styles.totalRow}>
          <span>Монтажные работы</span>
          <strong>{formatKzt(result.installation.work ?? result.installation.total)}</strong>
        </div>
        <div className={styles.totalRow}>
          <span>Пусконаладка</span>
          <strong>{formatKzt(result.installation.commissioning ?? 0)}</strong>
        </div>
        <div className={styles.totalRow}>
          <span>Монтаж кабеля</span>
          <strong>{formatKzt(result.installation.cableInstall ?? 0)}</strong>
        </div>
        <div className={styles.totalRowHighlight}>
          <span>ИТОГО ПО ПРОЕКТУ</span>
          <strong>{formatKzt(result.grandTotal)}</strong>
        </div>
      </motion.div>

      {showInstallment && result.grandTotal > 0 && (
        <motion.div className={styles.installmentBlock} variants={cardVariants} initial="visible" animate="visible">
          <h4 className={styles.installmentTitle}>Рассрочка</h4>
          <div className={styles.installmentCards}>
            {[36, 48, 60].map((months) => (
              <div key={months} className={styles.installmentCard}>
                <span className={styles.installmentMonths}>{months} мес.</span>
                <span className={styles.installmentPayment}>{formatKzt(Math.round(result.grandTotal / months))}</span>
                <span className={styles.installmentLabel}>в месяц</span>
              </div>
            ))}
          </div>
          <p className={styles.installmentPerFlat}>
            Ежемесячная оплата с квартиры: <strong>{formatKzt(perFlatMonthly)}</strong> (Итого / {derivedFlats})
          </p>
          <p className={styles.installmentDisclaimer}>Расчёт приблизительный, условия уточняйте у менеджера</p>
        </motion.div>
      )}
    </div>
  );
}

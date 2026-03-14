import { useState, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  cameraTypes,
  storageMonthsOptions,
  calculatorContact,
} from '@/shared/content/calculatorConfig';
import {
  type CalculatorInputs,
  type CalculatorResult,
  type CameraCounts,
  calculateResult,
} from '@/widgets/calculator/calculatorLogic';
import { submitLead } from '@/shared/api/leadApi';
import { useToast } from '@/features/toast/ToastProvider';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import styles from './CctvCalculatorSection.module.css';

const formatKzt = (n: number) => n.toLocaleString('ru-RU') + ' ₸';

const sectionVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.03 } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 22 } },
};

const defaultCameraCounts: CameraCounts = {
  outdoor2mp: 0,
  indoor2mp: 0,
  indoor4mp: 0,
  anpr3mp: 0,
};

const defaultInputs: CalculatorInputs = {
  cameraTypes: defaultCameraCounts,
  elevatorCount: 0,
  elevatorCameraType: '2mp',
  archiveSettings: { months: 1, recordingType: 'continuous' },
  cableSettings: {
    useManualLength: false,
    manualLengthPerCamera: undefined,
    buildingFloors: 0,
    buildingRisers: 1,
  },
  intercom: {
    entrances: 0,
    floorsPerEntrance: 0,
    flatsPerFloor: 4,
    carEntrance: {
      enabled: false,
      gates: 0,
      parking: 0,
    },
    hasConcierge: false,
  },
  videoAnalytics: false,
};

function buildSummaryText(input: CalculatorInputs, result: CalculatorResult): string {
  const ct = input.cameraTypes;
  const lines: string[] = [
    'Расчёт с калькулятора видеонаблюдения и домофонии (grgroup.kz)',
    '',
    '── Параметры ──',
    `Камеры: уличные 2MP ${ct.outdoor2mp}, внутр. 2MP ${ct.indoor2mp}, внутр. 4MP ${ct.indoor4mp}, АНПР ${ct.anpr3mp}`,
    `Лифты: ${input.elevatorCount} шт., тип ${input.elevatorCameraType}`,
    `Видеоаналитика: ${input.videoAnalytics ? 'да' : 'нет'}`,
    `Архив: ${input.archiveSettings.months} мес., запись: ${(input.videoAnalytics ? 'continuous' : input.archiveSettings.recordingType) === 'continuous' ? 'постоянная' : 'по движению'}`,
    `Кабель: ${input.cableSettings.useManualLength ? `ручная длина ${input.cableSettings.manualLengthPerCamera ?? 0} м/камера` : `этажей ${input.cableSettings.buildingFloors}, стояков ${input.cableSettings.buildingRisers}`}`,
    `Домофония: подъездов ${input.intercom.entrances}, этажей ${input.intercom.floorsPerEntrance}, квартир на этаже ${input.intercom.flatsPerFloor}; въездная группа ${input.intercom.carEntrance.enabled ? `да (калитки ${input.intercom.carEntrance.gates}, паркинг ${input.intercom.carEntrance.parking})` : 'нет'}, консьерж ${input.intercom.hasConcierge ? 'да' : 'нет'}`,
    '',
    '── Смета по группам ──',
  ];
  for (const g of result.groups) {
    lines.push('', g.title);
    for (const r of g.rows) {
      const q = r.qty > 0 ? `${r.qty}` : '—';
      const up = r.unitPrice != null ? formatKzt(r.unitPrice) : '—';
      lines.push(`  ${r.name} | ${q} | ${up} | ${formatKzt(r.sum)}`);
    }
    lines.push(`  Итого: ${formatKzt(g.subtotal)}`);
  }
  if (result.warnings.length > 0) {
    lines.push('', '── Предупреждения ──', ...result.warnings);
  }
  lines.push('', '── МОНТАЖНЫЕ РАБОТЫ ──');
  for (const b of result.installation.breakdown) {
    lines.push(b.name + ': ' + formatKzt(b.sum));
  }
  lines.push('Итого монтаж: ' + formatKzt(result.installation.total));
  lines.push('', 'Общая стоимость системы: ' + formatKzt(result.equipment));
  lines.push('ИТОГО с монтажом: ' + formatKzt(result.grandTotal));
  return lines.join('\n');
}

async function downloadPdf(result: CalculatorResult, contentEl: HTMLElement | null): Promise<void> {
  if (contentEl) {
    const canvas = await html2canvas(contentEl, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });
    const imgData = canvas.toDataURL('image/png');
    const pageWidthMm = 210;
    const aspect = canvas.height / canvas.width;
    const pageHeightMm = Math.max(297, pageWidthMm * aspect);
    const doc = new jsPDF({
      unit: 'mm',
      format: [pageWidthMm, pageHeightMm],
      hotfixes: ['px_scaling'],
    });
    doc.addImage(imgData, 'PNG', 0, 0, pageWidthMm, pageHeightMm);
    doc.save('raschet-videonablyudenie-domofoniya.pdf');
    return;
  }
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth ? doc.internal.pageSize.getWidth() : doc.internal.pageSize.width;
  let y = 20;
  const lineHeight = 7;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Result (use browser PDF for Russian)', 14, y);
  y += lineHeight * 2;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  for (const g of result.groups) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.text(g.title, 14, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    for (const r of g.rows) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const name = r.name.length > 50 ? r.name.slice(0, 47) + '…' : r.name;
      doc.text(name, 14, y);
      doc.text(String(r.qty || '—'), pageWidth - 70, y);
      doc.text(r.unitPrice != null ? formatKzt(r.unitPrice) : '—', pageWidth - 50, y);
      doc.text(formatKzt(r.sum), pageWidth - 25, y);
      y += lineHeight;
    }
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: ${formatKzt(g.subtotal)}`, pageWidth - 60, y);
    y += lineHeight * 1.2;
  }
  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ${formatKzt(result.grandTotal)}`, 14, y);
  doc.save('raschet-videonablyudenie-domofoniya.pdf');
}

/** Пропсы для числового поля: при фокусе 0 очищается, при blur пустое → emptyBlurValue (по умолчанию 0), select при фокусе. */
function numericInputProps(
  value: number,
  onChange: (val: number) => void,
  options?: { emptyBlurValue?: number; max?: number },
) {
  const emptyBlur = options?.emptyBlurValue ?? 0;
  return {
    type: 'number' as const,
    min: 0,
    value: value || '',
    placeholder: String(emptyBlur || '0'),
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => e.target.select(),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0);
      const val = options?.max != null ? Math.min(options.max, raw) : raw;
      onChange(val);
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      if (e.target.value === '') onChange(emptyBlur);
    },
  };
}

export function CctvCalculatorSection() {
  const reduceMotion = useReducedMotion();
  const { show } = useToast();
  const formTopRef = useRef<HTMLDivElement>(null);
  const pdfContentRef = useRef<HTMLDivElement>(null);

  const [inputs, setInputs] = useState<CalculatorInputs>(defaultInputs);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitName, setSubmitName] = useState('');
  const [submitPhone, setSubmitPhone] = useState('');
  const [submitEmail, setSubmitEmail] = useState('');
  const [submitSending, setSubmitSending] = useState(false);

  const result = useMemo(() => calculateResult(inputs), [inputs]);

  const handleReset = () => {
    setInputs(defaultInputs);
    formTopRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmitRequest = async () => {
    if (!result) return;
    const name = submitName.trim();
    const phone = submitPhone.trim();
    if (!name || !phone) {
      show('Укажите имя и телефон', 'error');
      return;
    }
    setSubmitSending(true);
    try {
      await submitLead({
        name,
        phone,
        email: submitEmail.trim() || undefined,
        projectType: 'calculator',
        message: buildSummaryText(inputs, result),
      });
      show('Заявка отправлена. Мы свяжемся с вами в ближайшее время.');
      setModalOpen(false);
      setSubmitName('');
      setSubmitPhone('');
      setSubmitEmail('');
    } catch {
      show('Ошибка отправки. Попробуйте позже.', 'error');
    } finally {
      setSubmitSending(false);
    }
  };

  return (
    <motion.section
      className={styles.section}
      aria-labelledby="calculator-heading"
      variants={reduceMotion ? undefined : sectionVariants}
      initial="visible"
      animate="visible"
    >
      <motion.div ref={formTopRef} className={styles.container} variants={reduceMotion ? undefined : sectionVariants} initial="visible" animate="visible">
        <motion.h2 id="calculator-heading" className={styles.heading} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
          Калькулятор видеонаблюдения и домофонии
        </motion.h2>
        <motion.p className={styles.subtitle} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
          Рассчитайте примерную стоимость системы по вашим параметрам
        </motion.p>

        {/* Блок: Камеры видеонаблюдения */}
        <motion.div className={styles.formCard} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
          <div className={styles.formTitle}>
            <span className={styles.formTitleIcon}>📹</span>
            Камеры видеонаблюдения
          </div>
          <div className={styles.cameraList}>
            <div className={styles.cameraRow}>
              <span className={styles.cameraLabel}>{cameraTypes.outdoor2mp.label}</span>
              <input
                className={styles.input}
                aria-label={cameraTypes.outdoor2mp.label}
                {...numericInputProps(inputs.cameraTypes.outdoor2mp, (val) =>
                  setInputs((p) => ({ ...p, cameraTypes: { ...p.cameraTypes, outdoor2mp: val } })),
                  { max: 999 },
                )}
              />
            </div>
            <div className={styles.cameraRow}>
              <span className={styles.cameraLabel}>{cameraTypes.indoor2mp.label}</span>
              <input
                className={styles.input}
                aria-label={cameraTypes.indoor2mp.label}
                {...numericInputProps(inputs.cameraTypes.indoor2mp, (val) =>
                  setInputs((p) => ({ ...p, cameraTypes: { ...p.cameraTypes, indoor2mp: val } })),
                  { max: 999 },
                )}
              />
            </div>
            <div className={styles.cameraRow}>
              <span className={styles.cameraLabel}>{cameraTypes.indoor4mp.label}</span>
              <input
                className={styles.input}
                aria-label={cameraTypes.indoor4mp.label}
                {...numericInputProps(inputs.cameraTypes.indoor4mp, (val) =>
                  setInputs((p) => ({ ...p, cameraTypes: { ...p.cameraTypes, indoor4mp: val } })),
                  { max: 999 },
                )}
              />
            </div>
            <div className={styles.cameraRow}>
              <span className={styles.cameraLabel}>{cameraTypes.anpr3mp.label}</span>
              <input
                className={styles.input}
                aria-label={cameraTypes.anpr3mp.label}
                {...numericInputProps(inputs.cameraTypes.anpr3mp, (val) =>
                  setInputs((p) => ({ ...p, cameraTypes: { ...p.cameraTypes, anpr3mp: val } })),
                  { max: 999 },
                )}
              />
            </div>
          </div>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={inputs.videoAnalytics}
              onChange={(e) => setInputs((p) => ({ ...p, videoAnalytics: e.target.checked }))}
            />
            <span>Добавить видеоаналитику</span>
          </label>
        </motion.div>

        {/* Блок: Лифтовые камеры */}
        <motion.div className={styles.formCard} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
          <div className={styles.formTitle}>
            <span className={styles.formTitleIcon}>🛗</span>
            Лифтовые камеры (с радиомостом)
          </div>
          <div className={styles.inputsGrid}>
            <div className={styles.inputGroup}>
              <label htmlFor="calc-elevators" className={styles.inputLabel}>
                Количество лифтов
              </label>
              <input
                id="calc-elevators"
                className={styles.input}
                {...numericInputProps(inputs.elevatorCount, (val) =>
                  setInputs((p) => ({ ...p, elevatorCount: val })), { max: 999 })}
              />
            </div>
            <div className={styles.inputGroup}>
              <span className={styles.inputLabel}>Тип камеры</span>
              <div className={styles.radioGroup}>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="elevatorType"
                    checked={inputs.elevatorCameraType === '2mp'}
                    onChange={() => setInputs((p) => ({ ...p, elevatorCameraType: '2mp' }))}
                  />
                  <span>2MP</span>
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="elevatorType"
                    checked={inputs.elevatorCameraType === '4mp'}
                    onChange={() => setInputs((p) => ({ ...p, elevatorCameraType: '4mp' }))}
                  />
                  <span>4MP</span>
                </label>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Блок: Домофония */}
        <motion.div className={styles.formCard} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
          <div className={styles.formTitle}>
            <span className={styles.formTitleIcon}>🚪</span>
            Домофония
          </div>
          <div className={styles.inputsGrid}>
            <div className={styles.inputGroup}>
              <label htmlFor="calc-entrances" className={styles.inputLabel}>
                Количество подъездов
              </label>
              <input
                id="calc-entrances"
                className={styles.input}
                {...numericInputProps(inputs.intercom.entrances, (val) =>
                  setInputs((p) => ({ ...p, intercom: { ...p.intercom, entrances: val } })), { max: 99 })}
              />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="calc-floors" className={styles.inputLabel}>
                Этажей в подъезде
              </label>
              <input
                id="calc-floors"
                className={styles.input}
                {...numericInputProps(inputs.intercom.floorsPerEntrance, (val) =>
                  setInputs((p) => ({ ...p, intercom: { ...p.intercom, floorsPerEntrance: val } })), { max: 99 })}
              />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="calc-flats" className={styles.inputLabel}>
                Квартир на этаже
              </label>
              <input
                id="calc-flats"
                className={styles.input}
                {...numericInputProps(inputs.intercom.flatsPerFloor, (val) =>
                  setInputs((p) => ({ ...p, intercom: { ...p.intercom, flatsPerFloor: val || 4 } })),
                  { max: 99, emptyBlurValue: 4 })}
              />
            </div>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={inputs.intercom.carEntrance.enabled}
                onChange={(e) =>
                  setInputs((p) => ({
                    ...p,
                    intercom: {
                      ...p.intercom,
                      carEntrance: {
                        ...p.intercom.carEntrance,
                        enabled: e.target.checked,
                      },
                    },
                  }))
                }
              />
              <span>Въездная группа (домофон на шлагбаум/ворота)</span>
            </label>
            {inputs.intercom.carEntrance.enabled && (
              <div className={styles.carEntranceDetails}>
                <div className={styles.fieldRow}>
                  <label className={styles.inputLabel}>Калитки</label>
                  <input
                    className={styles.input}
                    {...numericInputProps(inputs.intercom.carEntrance.gates, (val) =>
                      setInputs((p) => ({
                        ...p,
                        intercom: {
                          ...p.intercom,
                          carEntrance: { ...p.intercom.carEntrance, gates: val },
                        },
                      })))}
                  />
                </div>
                <div className={styles.fieldRow}>
                  <label className={styles.inputLabel}>Въезды в паркинг</label>
                  <input
                    className={styles.input}
                    {...numericInputProps(inputs.intercom.carEntrance.parking, (val) =>
                      setInputs((p) => ({
                        ...p,
                        intercom: {
                          ...p.intercom,
                          carEntrance: { ...p.intercom.carEntrance, parking: val },
                        },
                      })))}
                  />
                </div>
              </div>
            )}
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={inputs.intercom.hasConcierge}
                onChange={(e) => setInputs((p) => ({ ...p, intercom: { ...p.intercom, hasConcierge: e.target.checked } }))}
              />
              <span>Пост консьержа</span>
            </label>
          </div>
        </motion.div>

        {/* Блок: Кабель — здание и трассы */}
        <motion.div className={styles.formCard} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
          <div className={styles.formTitle}>
            <span className={styles.formTitleIcon}>🔌</span>
            Кабельные трассы
          </div>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={inputs.cableSettings.useManualLength}
              onChange={(e) => setInputs((p) => ({ ...p, cableSettings: { ...p.cableSettings, useManualLength: e.target.checked } }))}
            />
            <span>Задать длину кабеля вручную (м на камеру)</span>
          </label>
          {inputs.cableSettings.useManualLength ? (
            <div className={styles.inputGroup}>
              <label htmlFor="calc-cable-manual" className={styles.inputLabel}>
                Метров на камеру
              </label>
              <input
                id="calc-cable-manual"
                className={styles.input}
                {...numericInputProps(inputs.cableSettings.manualLengthPerCamera ?? 0, (val) =>
                  setInputs((p) => ({ ...p, cableSettings: { ...p.cableSettings, manualLengthPerCamera: val } })))}
              />
            </div>
          ) : (
            <>
              <div className={styles.inputGroup}>
                <label htmlFor="calc-building-floors" className={styles.inputLabel}>
                  Этажей в здании
                </label>
                <input
                  id="calc-building-floors"
                  className={styles.input}
                  {...numericInputProps(inputs.cableSettings.buildingFloors, (val) =>
                    setInputs((p) => ({ ...p, cableSettings: { ...p.cableSettings, buildingFloors: val } })),
                    { max: 999 })}
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="calc-building-risers" className={styles.inputLabel}>
                  Стояков / вертикальных трасс
                </label>
                <input
                  id="calc-building-risers"
                  className={styles.input}
                  {...numericInputProps(inputs.cableSettings.buildingRisers, (val) =>
                    setInputs((p) => ({
                      ...p,
                      cableSettings: { ...p.cableSettings, buildingRisers: Math.max(1, val) },
                    })),
                    { max: 99, emptyBlurValue: 1 })}
                />
              </div>
            </>
          )}
        </motion.div>

        {/* Блок: Срок и тип записи архива */}
        <motion.div className={styles.formCard} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
          <div className={styles.formTitle}>
            <span className={styles.formTitleIcon}>📅</span>
            Хранение архива
          </div>
          <div className={styles.inputGroup}>
            <span className={styles.inputLabel}>Срок хранения</span>
            <div className={styles.radioGroup}>
              {storageMonthsOptions.map((m) => (
                <label key={m} className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="storageMonths"
                    checked={inputs.archiveSettings.months === m}
                    onChange={() => setInputs((p) => ({ ...p, archiveSettings: { ...p.archiveSettings, months: m } }))}
                  />
                  <span>{m} мес</span>
                </label>
              ))}
            </div>
          </div>
          <div className={styles.inputGroup}>
            <span className={styles.inputLabel}>Тип записи</span>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="recordingType"
                  checked={inputs.videoAnalytics || inputs.archiveSettings.recordingType === 'continuous'}
                  disabled={inputs.videoAnalytics}
                  onChange={() => setInputs((p) => ({ ...p, archiveSettings: { ...p.archiveSettings, recordingType: 'continuous' } }))}
                />
                <span>Постоянная</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="recordingType"
                  checked={!inputs.videoAnalytics && inputs.archiveSettings.recordingType === 'motion'}
                  disabled={inputs.videoAnalytics}
                  onChange={() => setInputs((p) => ({ ...p, archiveSettings: { ...p.archiveSettings, recordingType: 'motion' } }))}
                />
                <span>По движению</span>
              </label>
            </div>
            {inputs.videoAnalytics && (
              <span className={styles.hint}>Видеоаналитика требует постоянной записи</span>
            )}
          </div>
        </motion.div>

        {/* Результат по группам */}
        {result ? (
          <>
            <div ref={pdfContentRef} className={styles.pdfContentWrap}>
              <motion.div className={styles.resultsTitle} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
                Результат расчёта — видеонаблюдение и домофония
              </motion.div>

              {result.warnings.length > 0 && (
                <motion.div className={styles.warningsBlock} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
                  <h4 className={styles.warningsTitle}>⚠️ Предупреждения</h4>
                  <ul className={styles.warningsList}>
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {result.groups.map((group) => (
                <motion.div key={group.title} className={styles.resultGroup} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
                  <h3 className={styles.resultGroupTitle}>{group.title}</h3>
                  <table className={styles.resultTable}>
                    <thead>
                      <tr>
                        <th>Наименование</th>
                        <th>Кол-во</th>
                        <th>Цена за ед.</th>
                        <th>Сумма</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row, i) => (
                        <tr key={i}>
                          <td>
                            <span className={styles.rowName}>{row.name}</span>
                            {row.note && <div className={styles.rowNote}>{row.note}</div>}
                          </td>
                          <td>{row.qty > 0 ? row.qty : '—'}</td>
                          <td>{row.unitPrice != null ? formatKzt(row.unitPrice) : '—'}</td>
                          <td className={styles.cellSum}>{formatKzt(row.sum)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className={styles.groupSubtotal}>
                    Итого {group.title.toLowerCase()}: <strong>{formatKzt(group.subtotal)}</strong>
                  </div>
                </motion.div>
              ))}

              <motion.div className={styles.totalBlock} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
                <div className={styles.totalRow}>
                  <span>Общая стоимость системы</span>
                  <strong>{formatKzt(result.equipment)}</strong>
                </div>
                {result.installation.breakdown.length > 0 && (
                  <div className={styles.installationBreakdown}>
                    <span className={styles.installationBreakdownTitle}>Монтаж по статьям:</span>
                    <ul>
                      {result.installation.breakdown.map((b, i) => (
                        <li key={i}>
                          {b.name}: <strong>{formatKzt(b.sum)}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className={styles.totalRow}>
                  <span>Монтажные работы</span>
                  <strong>{formatKzt(result.installation.total)}</strong>
                </div>
                <div className={styles.totalRowHighlight}>
                  <span>Итого с монтажом</span>
                  <strong>{formatKzt(result.grandTotal)}</strong>
                </div>
              </motion.div>
            </div>

            <p className={styles.estimateDisclaimer}>
              Расчёт является предварительным. Для точной сметы свяжитесь с нашим специалистом.
            </p>

            <motion.div className={styles.actionsRow} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
              <button type="button" className={styles.btnPrimary} onClick={() => downloadPdf(result, pdfContentRef.current)}>
                Скачать PDF
              </button>
              <button type="button" className={styles.btnPrimary} onClick={() => setModalOpen(true)}>
                Отправить на email
              </button>
              <button type="button" className={styles.btnSecondary} onClick={handleReset}>
                Пересчитать
              </button>
              <span className={styles.contactHint}>
                или напишите на <a href={`mailto:${calculatorContact.email}`}>{calculatorContact.email}</a>
                {' / '}
                <a href={`tel:${calculatorContact.phone.replace(/\s/g, '')}`}>{calculatorContact.phone}</a>
              </span>
            </motion.div>
          </>
        ) : (
          <motion.div className={styles.emptyState} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
            <div className={styles.emptyStateIcon}>📐</div>
            Укажите количество камер или параметры домофонии, чтобы увидеть расчёт
          </motion.div>
        )}
      </motion.div>

      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => !submitSending && setModalOpen(false)}>
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={styles.modalTitle}>Отправить расчёт менеджеру</h3>
            <p className={styles.modalDesc}>
              Укажите контакты — мы отправим расчёт на {calculatorContact.email} и перезвоним.
            </p>
            <div className={styles.modalForm}>
              <div className={styles.inputGroup}>
                <label htmlFor="calc-lead-name" className={styles.inputLabel}>Имя *</label>
                <input
                  id="calc-lead-name"
                  type="text"
                  className={styles.input}
                  value={submitName}
                  onChange={(e) => setSubmitName(e.target.value)}
                  placeholder="Ваше имя"
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="calc-lead-phone" className={styles.inputLabel}>Телефон *</label>
                <input
                  id="calc-lead-phone"
                  type="tel"
                  className={styles.input}
                  value={submitPhone}
                  onChange={(e) => setSubmitPhone(e.target.value)}
                  placeholder="+7 771 000 00 00"
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="calc-lead-email" className={styles.inputLabel}>Email</label>
                <input
                  id="calc-lead-email"
                  type="email"
                  className={styles.input}
                  value={submitEmail}
                  onChange={(e) => setSubmitEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <div className={styles.modalButtons}>
                <button type="button" className={styles.btnSecondary} onClick={() => setModalOpen(false)} disabled={submitSending}>
                  Отмена
                </button>
                <button type="button" className={styles.btnPrimary} onClick={handleSubmitRequest} disabled={submitSending}>
                  {submitSending ? 'Отправка…' : 'Отправить'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.section>
  );
}

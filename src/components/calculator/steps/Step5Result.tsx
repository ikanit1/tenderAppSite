import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useCalculatorStore } from '@/store/calculatorStore';
import { stepSectionVariants } from '@/shared/animations/sectionReveal';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlowButton } from '@/components/ui/GlowButton';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { ResultTable } from '@/components/calculator/ResultTable';
import { formatKzt } from '@/lib/calculations';
import { submitLead } from '@/shared/api/leadApi';
import { useToast } from '@/features/toast/ToastProvider';
import { calculatorContact } from '@/shared/content/calculatorConfig';
import type { BuildingParams, CalculatorResult } from '@/widgets/calculator/calculatorLogic';
import type { IntercomResult } from '@/store/calculatorStore';
import { getDeviceImage } from '@/lib/deviceImages';
import styles from './Step5Result.module.css';

function buildSummaryText(
  params: BuildingParams | null,
  result: CalculatorResult | null,
  intercomParams?: { entrances: number; entranceInputs: number; floors: number; flats: number; gates: number },
  intercomResult?: IntercomResult
): string {
  const lines: string[] = ['Расчёт с калькулятора систем безопасности (grgroup.kz)', ''];

  // Видеонаблюдение
  if (result && params) {
    lines.push(
      '── ВИДЕОНАБЛЮДЕНИЕ ──',
      'Параметры:',
      `Подъездов: ${params.entrances}, этажей: ${params.floors}, лифтов: ${params.elevators}`,
      `Калитки: ${params.yardGates}, паркинг: ${params.hasParking ? `да, ${params.parkingGates} въезд(ов)` : 'нет'}`,
      `Охват: ${params.coverageType === 'whole_building' ? 'весь дом' : 'только входные группы'}${params.coverageType === 'whole_building' ? `, ${params.twoCamerasPerFloor ? '2' : '1'} камеры на этаж` : ''}, камеры в лифтах: ${params.hasCamerasInLifts ? 'да' : 'нет'}`,
      '',
      'Итог:',
      `Камер: ${result.totalCameras}, кабель: ${result.totalCableMeters} м`,
      `Оборудование: ${formatKzt(result.equipment)}`,
      `Расходные материалы: ${formatKzt(result.consumables ?? 0)}`,
      `Монтаж: ${formatKzt(result.installation.total)}`,
      `ИТОГО видеонаблюдение: ${formatKzt(result.grandTotal)}`,
      ''
    );
  }

  // Домофония
  if (intercomResult && intercomParams) {
    lines.push(
      '── ДОМОФОНИЯ ──',
      'Параметры:',
      `Подъездов: ${intercomParams.entrances}, входов у подъезда: ${intercomParams.entranceInputs}`,
      `Этажей: ${intercomParams.floors}, квартир: ${intercomParams.flats}, калиток: ${intercomParams.gates}`,
      '',
      'Итог:',
      `Оборудование: ${formatKzt(intercomResult.costSwitches4port + intercomResult.costPanelEquip + intercomResult.costManagedSwitches + intercomResult.costUtp + intercomResult.costConsumables)}`,
      `Монтаж: ${formatKzt(intercomResult.totalInstall)}`,
      `ПНР: ${formatKzt(intercomResult.totalComm)}`,
      `ИТОГО домофония: ${formatKzt(intercomResult.grandTotal)}`,
      ''
    );
  }

  // Общий итог
  const cctvTotal = result?.grandTotal ?? 0;
  const intercomTotal = intercomResult?.grandTotal ?? 0;
  const grandTotal = cctvTotal + intercomTotal;
  lines.push(`ИТОГО ПО ПРОЕКТУ: ${formatKzt(grandTotal)}`);

  return lines.join('\n');
}

function IntercomSmeta({ r }: { r: IntercomResult }) {
  const fmt = (n: number) => n.toLocaleString('ru-RU');

  return (
    <div className={styles.intercomSmeta}>
      {/* Оборудование */}
      <div className={styles.intercomGroup}>
        <h3 className={styles.intercomGroupTitle}>Домофония — оборудование</h3>
        <table className={styles.intercomTable}>
          <thead>
            <tr>
              <th className={styles.intercomThImg}></th>
              <th>Наименование</th>
              <th>Кол-во</th>
              <th>Ед. цена</th>
              <th>Сумма</th>
            </tr>
          </thead>
          <tbody>
            {([
              { name: '4-портовый коммутатор', qty: `${r.switches4port} шт.`, price: `${fmt(13_301)} ₸`, sum: fmt(r.costSwitches4port) },
              { name: 'Вызывная панель',        qty: `${r.callPanels} шт.`,   price: `${fmt(255_000)} ₸`, sum: fmt(r.costPanelEquip) },
              { name: 'Управляемый коммутатор', qty: `${r.managedSwitches} шт.`, price: `${fmt(51_333)} ₸`, sum: fmt(r.costManagedSwitches) },
              { name: 'Кабель UTP',             qty: `${r.utpMeters} м`,      price: `${fmt(170)} ₸/м`, sum: fmt(r.costUtp) },
              { name: 'Расходные материалы',    qty: '1 компл.',              price: '—',              sum: fmt(r.costConsumables) },
            ] as const).map((row) => {
              const img = getDeviceImage(row.name);
              return (
                <tr key={row.name}>
                  <td className={styles.intercomCellImg}>
                    {img
                      ? <img src={img} alt="" className={styles.intercomDeviceImg} width={48} height={48} loading="lazy" />
                      : <span className={styles.intercomDevicePlaceholder}>—</span>
                    }
                  </td>
                  <td>{row.name}</td>
                  <td>{row.qty}</td>
                  <td>{row.price}</td>
                  <td className={styles.intercomCellSum}>{row.sum} ₸</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className={styles.intercomSubtotal}>
          Итого оборудование: <strong>{fmt(r.costSwitches4port + r.costPanelEquip + r.costManagedSwitches + r.costUtp + r.costConsumables)} ₸</strong>
        </div>
      </div>

      {/* Монтажные работы */}
      <div className={styles.intercomGroup}>
        <h3 className={styles.intercomGroupTitle}>Домофония — монтажные работы</h3>
        <table className={styles.intercomTable}>
          <thead>
            <tr>
              <th>Наименование</th>
              <th>Кол-во</th>
              <th>Ед. цена</th>
              <th>Сумма</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Прокладка кабеля UTP</td>
              <td>{r.utpMeters} м</td>
              <td>120 ₸/м</td>
              <td className={styles.intercomCellSum}>{fmt(r.installUtp)} ₸</td>
            </tr>
            <tr>
              <td>Монтаж вызывной панели</td>
              <td>{r.callPanels} шт.</td>
              <td>{fmt(80_000)} ₸</td>
              <td className={styles.intercomCellSum}>{fmt(r.installPanels)} ₸</td>
            </tr>
            <tr>
              <td>Монтаж коммутатора</td>
              <td>{r.switches4port + r.managedSwitches} шт.</td>
              <td>{fmt(4_000)} ₸</td>
              <td className={styles.intercomCellSum}>{fmt(r.installSwitches)} ₸</td>
            </tr>
          </tbody>
        </table>
        <div className={styles.intercomSubtotal}>
          Итого монтаж: <strong>{fmt(r.totalInstall)} ₸</strong>
        </div>
      </div>

      {/* Пусконаладочные работы */}
      <div className={styles.intercomGroup}>
        <h3 className={styles.intercomGroupTitle}>Домофония — пусконаладочные работы</h3>
        <table className={styles.intercomTable}>
          <thead>
            <tr>
              <th>Наименование</th>
              <th>Кол-во</th>
              <th>Ед. цена</th>
              <th>Сумма</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Пусконаладочные работы</td>
              <td>1 компл.</td>
              <td>—</td>
              <td className={styles.intercomCellSum}>{fmt(r.totalComm)} ₸</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.intercomSubtotal} style={{ fontSize: '1.05em', marginTop: 8 }}>
        ИТОГО по домофонии: <strong>{fmt(r.grandTotal)} ₸</strong>
      </div>
    </div>
  );
}

export function Step5Result() {
  const reduceMotion = useReducedMotion();
  const result = useCalculatorStore((s) => s.result);
  const params = useCalculatorStore((s) => s.params);
  const reset = useCalculatorStore((s) => s.reset);
  const intercomResult = useCalculatorStore((s) => s.intercomResult);
  const intercomParams = useCalculatorStore((s) => s.intercomParams);
  const intercomDirty = useCalculatorStore((s) => s.intercomDirty);
  const { show } = useToast();
  const [flatCount, setFlatCount] = useState<number>(0);
  // Квартиры: приоритет — ручной ввод, затем из формы домофонии, затем из калькулятора видео
  const effectiveFlats = flatCount > 0
    ? flatCount
    : intercomDirty && intercomParams.flats > 0
      ? intercomParams.flats
      : (result?.totalFlats ?? 0);
  const [exporting, setExporting] = useState<'kpfull' | 'finmodel' | null>(null);
  const [installmentMonths, setInstallmentMonths] = useState<number>(60);
  const [downPayment, setDownPayment] = useState<number>(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitName, setSubmitName] = useState('');
  const [submitPhone, setSubmitPhone] = useState('');
  const [submitEmail, setSubmitEmail] = useState('');
  const [submitSending, setSubmitSending] = useState(false);

  const cctv = result?.grandTotal ?? 0;
  const intercom = intercomDirty ? intercomResult.grandTotal : 0;
  const total = cctv + intercom;

  const handleReset = () => {
    if (window.confirm('Сбросить все данные и начать заново?')) {
      reset();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleEmail = () => setModalOpen(true);

  const handleSubmitRequest = async () => {
    if (!result && !intercomDirty) return;
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
        message: buildSummaryText(params, result, intercomDirty ? intercomParams : undefined, intercomDirty ? intercomResult : undefined),
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

  const handleDocx = async () => {
    if (!result && !intercomDirty) return;
    setExporting('kpfull');
    try {
      const { downloadKPFullPDF } = await import('@/widgets/calculator/generateKPFullPDF');
      await downloadKPFullPDF(result, intercomDirty ? intercomResult : null, {
        apartments: effectiveFlats,
        installmentMonths,
        downPayment,
      });
    } catch {
      show('Не удалось сформировать PDF.', 'error');
    } finally {
      setExporting(null);
    }
  };

  const handleFinModel = async () => {
    if (!result && !intercomDirty) return;
    setExporting('finmodel');
    try {
      const { downloadFinModelPDF } = await import('@/widgets/calculator/generateFinModelPDF');
      await downloadFinModelPDF(result, intercomDirty ? intercomResult : null, {
        apartments: effectiveFlats,
        downPayment,
        installmentMonths,
      });
    } catch {
      show('Не удалось сформировать PDF.', 'error');
    } finally {
      setExporting(null);
    }
  };

  return (
    <motion.div
      className={styles.wrap}
      variants={reduceMotion ? undefined : stepSectionVariants}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0 }}
    >
      <h2 className={styles.title}>Итоговая смета</h2>

      {/* Общий итог по двум системам */}
      <GlassCard className={styles.totalCard}>
        <div className={styles.totalSplit}>
          <div className={styles.totalSplitItem}>
            <div className={styles.totalSplitLabel}>Видеонаблюдение</div>
            <div className={styles.totalSplitValue}>{formatKzt(cctv)}</div>
          </div>
          {intercomDirty && (<>
            <div className={styles.totalSplitDivider} aria-hidden>+</div>
            <div className={styles.totalSplitItem}>
              <div className={styles.totalSplitLabel}>Домофония</div>
              <div className={styles.totalSplitValue}>{formatKzt(intercom)}</div>
            </div>
          </>)}
          <div className={styles.totalSplitDivider} aria-hidden>=</div>
          <div className={`${styles.totalSplitItem} ${styles.totalSplitGrand}`}>
            <div className={styles.totalLabel}>Итого по проекту</div>
            <AnimatedCounter value={total} className={styles.totalValue} />
          </div>
        </div>
      </GlassCard>

      {/* Двухколонный блок смет */}
      <div className={intercomDirty ? styles.twoColumns : styles.oneColumn}>
        {/* Левая — Видеонаблюдение */}
        <div className={styles.column}>
          <h3 className={styles.columnTitle}>Видеонаблюдение</h3>
          {result ? (
            <ResultTable
              result={result}
              showInstallment={false}
              flatCount={effectiveFlats}
              onFlatsChange={setFlatCount}
              extraTotal={intercom}
              extraLabel="Домофония"
            />
          ) : (
            <p className={styles.emptyHint}>Заполните параметры объекта выше, чтобы увидеть смету.</p>
          )}
        </div>

        {/* Правая — Домофония (только если пользователь заполнил форму) */}
        {intercomDirty && (
          <div className={styles.column}>
            <h3 className={styles.columnTitle}>Домофония</h3>
            <IntercomSmeta r={intercomResult} />
          </div>
        )}
      </div>

      {/* Общий итог по проекту (видеонаблюдение + домофония) */}
      {result && intercomDirty && (
        <GlassCard className={styles.grandSummaryCard}>
          <h3 className={styles.grandSummaryTitle}>Общий итог по проекту</h3>
          <table className={styles.grandSummaryTable}>
            <tbody>
              <tr>
                <td className={styles.grandSummarySection} colSpan={3}>Видеонаблюдение</td>
              </tr>
              <tr>
                <td className={styles.grandSummaryName}>Оборудование и расходники</td>
                <td></td>
                <td className={styles.grandSummarySum}>{formatKzt(result.equipment + result.consumables)} ₸</td>
              </tr>
              <tr>
                <td className={styles.grandSummaryName}>Монтажные работы</td>
                <td></td>
                <td className={styles.grandSummarySum}>{formatKzt(result.installation.total)} ₸</td>
              </tr>
              <tr className={styles.grandSummarySubrow}>
                <td className={styles.grandSummaryName}>Итого видеонаблюдение</td>
                <td></td>
                <td className={styles.grandSummarySub}>{formatKzt(cctv)} ₸</td>
              </tr>
              <tr>
                <td className={styles.grandSummarySection} colSpan={3}>Домофония</td>
              </tr>
              <tr>
                <td className={styles.grandSummaryName}>Оборудование</td>
                <td></td>
                <td className={styles.grandSummarySum}>{formatKzt(intercomResult.costSwitches4port + intercomResult.costPanelEquip + intercomResult.costManagedSwitches + intercomResult.costUtp + intercomResult.costConsumables)} ₸</td>
              </tr>
              <tr>
                <td className={styles.grandSummaryName}>Монтажные работы</td>
                <td></td>
                <td className={styles.grandSummarySum}>{formatKzt(intercomResult.totalInstall)} ₸</td>
              </tr>
              <tr>
                <td className={styles.grandSummaryName}>Пусконаладочные работы</td>
                <td></td>
                <td className={styles.grandSummarySum}>{formatKzt(intercomResult.totalComm)} ₸</td>
              </tr>
              <tr className={styles.grandSummarySubrow}>
                <td className={styles.grandSummaryName}>Итого домофония</td>
                <td></td>
                <td className={styles.grandSummarySub}>{formatKzt(intercomResult.grandTotal)} ₸</td>
              </tr>
              <tr className={styles.grandSummaryTotalRow}>
                <td className={styles.grandSummaryTotalLabel} colSpan={2}>ИТОГО ПО ПРОЕКТУ</td>
                <td className={styles.grandSummaryTotalVal}>{formatKzt(total)} ₸</td>
              </tr>
            </tbody>
          </table>
        </GlassCard>
      )}

      {/* Рассрочка (полная ширина, только если есть CCTV-результат) */}
      {result && (
        <ResultTable
          result={result}
          showInstallment={true}
          hideGroups={true}
          flatCount={flatCount}
          onFlatsChange={setFlatCount}
          extraTotal={intercom}
          extraLabel="Домофония"
          onInstallmentChange={({ selectedMonths, initialPayment }) => {
            setInstallmentMonths(selectedMonths);
            setDownPayment(initialPayment);
          }}
        />
      )}

      <div className={styles.actions}>
        <div className={styles.actionsLeft}>
          <GlowButton variant="ghost" onClick={handleReset}>
            Начать заново
          </GlowButton>
        </div>
        <div className={styles.actionsRight}>
          <GlowButton variant="secondary" onClick={handleEmail}>
            Отправить на почту
          </GlowButton>
          <GlowButton variant="primary" onClick={handleDocx} disabled={(!result && !intercomDirty) || exporting === 'kpfull'}>
            {exporting === 'kpfull' ? 'Генерация…' : 'КП полное .pdf'}
          </GlowButton>
          <GlowButton variant="secondary" onClick={handleFinModel} disabled={(!result && !intercomDirty) || exporting === 'finmodel'}>
            {exporting === 'finmodel' ? 'Генерация…' : 'Финансовая модель .pdf'}
          </GlowButton>
          <a
            href="/kp-intercom-monitors.pdf"
            download="КП мониторы и панели домофонии.pdf"
            className={styles.downloadLink}
          >
            КП мониторы (интерком панели)
          </a>
        </div>
      </div>

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
                <label htmlFor="step5-lead-name" className={styles.inputLabel}>Имя *</label>
                <input
                  id="step5-lead-name"
                  type="text"
                  className={styles.modalInput}
                  value={submitName}
                  onChange={(e) => setSubmitName(e.target.value)}
                  placeholder="Ваше имя"
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="step5-lead-phone" className={styles.inputLabel}>Телефон *</label>
                <input
                  id="step5-lead-phone"
                  type="tel"
                  className={styles.modalInput}
                  value={submitPhone}
                  onChange={(e) => setSubmitPhone(e.target.value)}
                  placeholder="+7 771 000 00 00"
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="step5-lead-email" className={styles.inputLabel}>Email</label>
                <input
                  id="step5-lead-email"
                  type="email"
                  className={styles.modalInput}
                  value={submitEmail}
                  onChange={(e) => setSubmitEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <div className={styles.modalButtons}>
                <GlowButton variant="ghost" onClick={() => setModalOpen(false)} disabled={submitSending}>
                  Отмена
                </GlowButton>
                <GlowButton onClick={handleSubmitRequest} disabled={submitSending}>
                  {submitSending ? 'Отправка…' : 'Отправить'}
                </GlowButton>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

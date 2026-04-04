import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useCalculatorStore } from '@/store/calculatorStore';
import { stepSectionVariants } from '@/shared/animations/sectionReveal';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlowButton } from '@/components/ui/GlowButton';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { ResultTable } from '@/components/calculator/ResultTable';
import { formatKzt } from '@/lib/calculations';
import { sendKPByEmail } from '@/shared/api/leadApi';
import { useToast } from '@/features/toast/ToastProvider';
import type { IntercomResult } from '@/store/calculatorStore';
import { getDeviceImage } from '@/lib/deviceImages';
import styles from './Step5Result.module.css';

interface ProjectInfo {
  complexName: string;
  address: string;
  phone: string;
  email: string;
}

const SESSION_KEY = 'kp_project_info';

function loadProjectInfo(): ProjectInfo {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) return JSON.parse(saved) as ProjectInfo;
  } catch { /* ignore */ }
  return { complexName: '', address: '', phone: '', email: '' };
}

function saveProjectInfo(info: ProjectInfo): void {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(info)); } catch { /* ignore */ }
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
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>(loadProjectInfo);
  const [downloadType, setDownloadType] = useState<'kpfull' | 'finmodel' | null>(null);
  const [projectInfoSending, setProjectInfoSending] = useState(false);

  const updateProjectInfo = (patch: Partial<ProjectInfo>) => {
    setProjectInfo(prev => {
      const next = { ...prev, ...patch };
      saveProjectInfo(next);
      return next;
    });
  };

  const isProjectInfoValid =
    projectInfo.complexName.trim().length >= 2 &&
    projectInfo.address.trim().length >= 5 &&
    /^\+?[0-9\s\-()+]{7,}$/.test(projectInfo.phone.trim()) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(projectInfo.email.trim());

  const [installmentMonths, setInstallmentMonths] = useState<number>(60);
  const [downPayment, setDownPayment] = useState<number>(0);

  const cctv = result?.grandTotal ?? 0;
  const intercom = intercomDirty ? intercomResult.grandTotal : 0;
  const total = cctv + intercom;

  const handleReset = () => {
    if (window.confirm('Сбросить все данные и начать заново?')) {
      reset();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleProjectInfoSubmit = async () => {
    if (!isProjectInfoValid || !downloadType) return;
    setProjectInfoSending(true);
    try {
      let blob: Blob;
      let filename: string;

      if (downloadType === 'kpfull') {
        const { generateKPFullPDF } = await import('@/widgets/calculator/generateKPFullPDF');
        const out = await generateKPFullPDF(
          result,
          intercomDirty ? intercomResult : null,
          { apartments: effectiveFlats, installmentMonths, downPayment },
          { complexName: projectInfo.complexName, address: projectInfo.address, phone: projectInfo.phone }
        );
        blob = out.blob;
        filename = out.filename;
      } else {
        const { generateFinModelPDF } = await import('@/widgets/calculator/generateFinModelPDF');
        const out = await generateFinModelPDF(
          result,
          intercomDirty ? intercomResult : null,
          { apartments: effectiveFlats, downPayment, installmentMonths },
          { complexName: projectInfo.complexName, address: projectInfo.address, phone: projectInfo.phone }
        );
        blob = out.blob;
        filename = out.filename;
      }

      // base64
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Send to backend
      await sendKPByEmail({
        complexName: projectInfo.complexName,
        address: projectInfo.address,
        phone: projectInfo.phone,
        email: projectInfo.email,
        documentType: downloadType,
        pdfBase64,
        fileName: filename,
      });

      // Download locally
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      show(`Расчёт отправлен на ${projectInfo.email}`);
      setDownloadType(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка отправки. Попробуйте позже.';
      show(msg, 'error');
    } finally {
      setProjectInfoSending(false);
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
          <GlowButton
            variant="primary"
            onClick={() => setDownloadType('kpfull')}
            disabled={!result && !intercomDirty}
          >
            КП полное .pdf
          </GlowButton>
          <GlowButton
            variant="secondary"
            onClick={() => setDownloadType('finmodel')}
            disabled={!result && !intercomDirty}
          >
            Финансовая модель .pdf
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

      {downloadType !== null && (
        <div
          className={styles.modalOverlay}
          onClick={() => !projectInfoSending && setDownloadType(null)}
        >
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={styles.modalTitle}>
              {downloadType === 'kpfull'
                ? 'Получить Коммерческое предложение'
                : 'Получить Финансовую модель'}
            </h3>
            <p className={styles.modalDesc}>
              Заполните данные объекта — подготовим документ и пришлём на почту.
            </p>
            <div className={styles.modalForm}>
              <div className={styles.inputGroup}>
                <label htmlFor="pi-complex" className={styles.inputLabel}>Название ЖК *</label>
                <input
                  id="pi-complex"
                  type="text"
                  className={styles.modalInput}
                  value={projectInfo.complexName}
                  onChange={(e) => updateProjectInfo({ complexName: e.target.value })}
                  placeholder="ЖК «Солнечный»"
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="pi-address" className={styles.inputLabel}>Адрес объекта *</label>
                <input
                  id="pi-address"
                  type="text"
                  className={styles.modalInput}
                  value={projectInfo.address}
                  onChange={(e) => updateProjectInfo({ address: e.target.value })}
                  placeholder="г. Астана, ул. Примерная, 1"
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="pi-phone" className={styles.inputLabel}>Телефон *</label>
                <input
                  id="pi-phone"
                  type="tel"
                  className={styles.modalInput}
                  value={projectInfo.phone}
                  onChange={(e) => updateProjectInfo({ phone: e.target.value })}
                  placeholder="+7 700 000 00 00"
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="pi-email" className={styles.inputLabel}>Email *</label>
                <input
                  id="pi-email"
                  type="email"
                  className={styles.modalInput}
                  value={projectInfo.email}
                  onChange={(e) => updateProjectInfo({ email: e.target.value })}
                  placeholder="manager@example.com"
                />
                <span className={styles.inputHint}>
                  Укажите почту — продублируем расчёт, чтобы не потерять
                </span>
              </div>
              <div className={styles.modalButtons}>
                <GlowButton
                  variant="ghost"
                  onClick={() => setDownloadType(null)}
                  disabled={projectInfoSending}
                >
                  Отмена
                </GlowButton>
                <GlowButton
                  onClick={handleProjectInfoSubmit}
                  disabled={!isProjectInfoValid || projectInfoSending}
                >
                  {projectInfoSending ? 'Отправка…' : 'Получить расчёт на почту и скачать'}
                </GlowButton>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

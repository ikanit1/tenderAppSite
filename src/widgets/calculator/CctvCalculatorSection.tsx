import { useState, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  calculatorContact,
  pdfConfig,
} from '@/shared/content/calculatorConfig';
import {
  type BuildingParams,
  type CalculatorResult,
  calculateResult,
} from '@/widgets/calculator/calculatorLogic';
import { submitLead } from '@/shared/api/leadApi';
import { getCatalogUrl } from '@/shared/utils/catalogUrl';
import { downloadKP } from '@/widgets/calculator/generateKP';
import { downloadFinModel } from '@/widgets/calculator/generateFinModel';
import { downloadKPFull } from '@/widgets/calculator/generateKPFull';
import { useCalculatorStore } from '@/store/calculatorStore';
import { itemPurposes } from '@/widgets/calculator/itemPurposes';
import { usePersistedCalculator } from '@/widgets/calculator/usePersistedCalculator';
import { useToast } from '@/features/toast/ToastProvider';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import styles from './CctvCalculatorSection.module.css';

const formatKzt = (n: number) => n.toLocaleString('ru-RU') + ' ₸';

/** Тариф абонентской платы видеонаблюдения (₸/мес с квартиры) */
const TARIFF_CCTV_PER_FLAT = 900;

/** Маппинг: подстрока row.name → артикул модели из portal_export. Изображения через API каталога. */
const deviceModelMap: Record<string, string> = {
  // Позиции калькулятора видеонаблюдения (название — модель в row.name), изображения из portal_export
  'IPC-3612-APF28': 'IPC-3612-APF28E',
  'IPC-2122-APF28': 'IPC-2122-APF28',
  'PKC2630@Z28-IR-P': 'PKC2630@Z28-IR-P',
  'IPC-324-PF28': 'IPC-324-PF28',
  'WK-WB08-KIT': 'WK-WB08-KIT',
  'NVR501-16B': 'NVR501-16B',
  'NVR-302-32-IQ': 'NVR-302-32-IQ',
  'NVR-508-48-E': 'NVR-508-64-E',
  'NVR-508-64-E': 'NVR-508-64-E',
  'NVR508-128E-R': 'NVR508-128E-R',
  'NSW2100-9GT1GP-POE-IN': 'NSW2100-9GT1GP-POE-IN',
  'WK-PS320GF': 'WK-PS320GF',
  'WK-PS328GF': 'WK-PS328GF',
  'WI-PCMS554F-L3 V2': 'WI-PCMS554F-L3 V2',
  'SEAGATE HDD SkyHawkAI': 'ST10000VE000',
  'Жёсткий диск 10 ТБ': 'ST10000VE000',
  'Патч-панель 19"': 'PP24-1UC5EU-D05-1',
  'Кабель UTP Cat5e': 'CAB-LC2110B-IN',
  'Уличная цилиндрическая 2MP': 'IPC-2122-APF28',
  'Уличная цилиндрическая': 'IPC-2122-APF28',
  'Внутренняя купольная 2MP': 'IPC-3612-APF28-DL',
  'Внутренняя купольная 4MP': 'IPC-3614-APF28-NB',
  'Камера опознавания номерного знака 3MP': 'DHI-ITC413-PW4D-Z1',
  'опознавания номерного знака': 'DHI-ITC413-PW4D-Z1',
  'Камера опознавания номерного знака': 'DHI-ITC413-PW4D-Z1',
  'Лифтовая камера 2MP': 'IPC-3612-APF28-DL',
  'Лифтовая камера 4MP': 'IPC-324-PF28',
  'Лифтовая камера': 'IPC-3612-APF28-DL',
  'WK-WB08': 'WK-WB08-KIT',
  'WK-PS227GF': 'WK-PS227GF',
  'WK-PS216GF': 'WK-PS216GF',
  'WK-PS208GF': 'WK-PS208GF',
  'PoE-коммутатор 4-порт': 'WK-PS208GF',
  'PoE-коммутатор 8-порт': 'WK-PS208GF',
  'PoE-коммутатор': 'WK-PS227GF',
  'CAB-LC2100B-E2-IN': 'CAB-LC2100B-E2-IN',
  'CAB-LC2110B': 'CAB-LC2110B-IN',
  'CAB-LC': 'CAB-LC2100B-E2-IN',
  'SkyHawk': 'ST8000VX010',
  'SEAGATE SkyHawk': 'ST8000VX010',
  'NVR824-256R': 'NVR308-64X',
  'NVR308-64E': 'NVR308-64X',
  'NVR304-32E': 'NVR304-32B-IQ',
  'NVR302-16E': 'NVR302-16B-IQ',
  'NVR824': 'NVR308-64X',
  'NVR308': 'NVR308-64X',
  'NVR304': 'NVR304-32B-IQ',
  'NVR302': 'NVR302-16B-IQ',
  'Коммутатор управляемый 24п': 'NS-1010-8GT',
  'Вызывная панель (вход)': 'OEU-201S-HMK-W',
  'Домофон для входа': 'OEU-201S-HMK-W',
  'Вызывная панель': 'C313S',
  'Вызывная панель IP': 'OEU-201S-HMK-W',
  'Интерком панели для квартир': 'C313S',
  'Контроллер доступа': 'GVAE11',
  'Шкаф 18U': 'LWR3-18U66-GF',
  'Шкаф 42U': 'LWR3-18U66-GF',
  'SHIP 700402112T': 'SHIP 700402112T',
  'SHIP 701402120': 'CO05-1M5RM',
  'SHIP 700508102': 'SHIP 700508102',
  'Патч-корд': 'PC01-C5EU-02M',
  'Патч-панель 24 порта': 'PP24-1UMU',
  'Патч-панель 48 портов': 'PP24-1UMU',
  'ИБП 3 кВА': 'ИБП 3 кВА',
  'ИБП 2 кВА': 'ИБП 2 кВА',
  'ИБП 1 кВА': 'ИБП 1 кВА',
};

/** Локальные изображения из КП (приоритет над каталогом). Файлы из docs/ — в public/docs/ для доступа по /docs/... */
const deviceLocalImageMap: Record<string, string> = {
  'Домофон для входа': '/oeu-301s-hmka.jpg',
  'Вызывная панель (вход)': '/oeu-301s-hmka.jpg',
  'Вызывная панель IP': '/oeu-301s-hmka.jpg',
  'Стойка настенная 9U': '/docs/stoika.jpg',
  'Монтажный шкаф напольный 19" 27U': '/docs/shkaf-27u.jpg',
  'SHIP 601S.6027.24.100': '/docs/shkaf-27u.jpg',
  'ИБП онлайн 3000 ВА': '/docs/ibp-3kva.jpg',
  'LRT-3KL-LCD': '/docs/ibp-3kva.jpg',
  'Вентиляторная панель с термостатом': '/docs/vent.jpg',
  'SHIP 700402112T': '/docs/vent.jpg',
  'SHIP 700402112Т': '/docs/vent.jpg',
  'SHIP 700508102': '/docs/setevoifilt.jpg',
};

function getDeviceImage(rowName: string): string | null {
  for (const [key, localPath] of Object.entries(deviceLocalImageMap)) {
    if (rowName.includes(key)) return localPath;
  }
  const base = getCatalogUrl();
  for (const [key, model] of Object.entries(deviceModelMap)) {
    if (rowName.includes(key)) {
      return `${base.replace(/\/$/, '')}/api/products/${encodeURIComponent(model)}/image?index=0`;
    }
  }
  return null;
}

const sectionVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.03 } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 22 } },
};

function buildSummaryText(params: BuildingParams, result: CalculatorResult): string {
  const lines: string[] = [
    'Расчёт с калькулятора видеонаблюдения (grgroup.kz)',
    '',
    '── Параметры ──',
    `Подъездов: ${params.entrances}, этажей: ${params.floors}, лифтов: ${params.elevators}`,
    `Калитки: ${params.yardGates}, паркинг: ${params.hasParking ? `да, ${params.parkingGates} въезд(ов)` : 'нет'}`,
    `Охват: ${params.coverageType === 'whole_building' ? 'весь дом' : 'только входные группы'}${params.coverageType === 'whole_building' ? `, ${params.twoCamerasPerFloor ? '2' : '1'} камеры на этаж` : ''}, камеры в лифтах: ${params.hasCamerasInLifts ? 'да' : 'нет'}`,
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
  lines.push('', '── ИТОГ ──');
  lines.push('Оборудование: ' + formatKzt(result.equipment));
  lines.push('Расходные материалы: ' + formatKzt(result.consumables ?? 0));
  for (const b of result.installation.breakdown) {
    lines.push(b.name + ': ' + formatKzt(b.sum));
  }
  lines.push('ИТОГО: ' + formatKzt(result.grandTotal));
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
  let y = 18;
  const lineHeight = 7;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(pdfConfig.companyName, 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  y += lineHeight;
  doc.text(pdfConfig.address, 14, y);
  y += lineHeight;
  doc.text(pdfConfig.phone + ' / ' + pdfConfig.email, 14, y);
  y += lineHeight * 1.2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Коммерческое предложение / Смета', 14, y);
  y += lineHeight;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Дата: ' + new Date().toLocaleDateString('ru-RU'), 14, y);
  y += lineHeight * 2;
  doc.setFontSize(10);
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

  const { params, setParams, reset: resetCalculator } = usePersistedCalculator();
  const { intercomResult, intercomDirty } = useCalculatorStore((s) => ({
    intercomResult: s.intercomResult,
    intercomDirty: s.intercomDirty,
  }));
  const [modalOpen, setModalOpen] = useState(false);
  const [submitName, setSubmitName] = useState('');
  const [submitPhone, setSubmitPhone] = useState('');
  const [submitEmail, setSubmitEmail] = useState('');
  const [submitSending, setSubmitSending] = useState(false);
  const [flatCount, setFlatCount] = useState(0);

  const result = useMemo(() => calculateResult(params), [params]);
  const derivedFlats = result?.totalFlats ?? 0;
  const apartments = flatCount > 0 ? flatCount : derivedFlats;
  const hasCctv = (result?.totalCameras ?? 0) > 0;
  const intercomMonthly = 0;
  const cctvMonthly = hasCctv && apartments > 0 ? apartments * TARIFF_CCTV_PER_FLAT : 0;
  const totalSubscriptionMonthly = intercomMonthly + cctvMonthly;
  const paybackMonths = result && totalSubscriptionMonthly > 0
    ? Math.round((result.grandTotal / totalSubscriptionMonthly) * 10) / 10
    : 0;
  const paybackYears = paybackMonths > 0 ? Math.round((paybackMonths / 12) * 10) / 10 : 0;

  const handleReset = () => {
    resetCalculator();
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
        message: buildSummaryText(params, result),
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
          Калькулятор систем видеонаблюдения и домофонии
        </motion.h2>
        <motion.p className={styles.subtitle} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
          Рассчитайте примерную стоимость системы по вашим параметрам
        </motion.p>

        {/* Расчет видеонаблюдения ЖК */}
        {/* Форма: параметры здания (BuildingParams) */}
        <motion.div className={styles.formCard} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
          <div className={styles.formTitle}>
            <span className={styles.formTitleIcon}>🏢</span>
            Расчет видеонаблюдения ЖК
          </div>
          <div className={styles.inputsGrid}>
            <div className={styles.inputGroup}>
              <label htmlFor="calc-entrances" className={styles.inputLabel}>Подъездов</label>
              <input
                id="calc-entrances"
                className={styles.input}
                {...numericInputProps(params.entrances, (val) => setParams((p) => ({ ...p, entrances: Math.max(1, val) })), { max: 50 })}
              />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="calc-floors" className={styles.inputLabel}>Этажей</label>
              <input
                id="calc-floors"
                className={styles.input}
                {...numericInputProps(params.floors, (val) => setParams((p) => ({ ...p, floors: Math.max(1, val) })), { max: 30 })}
              />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="calc-elevators" className={styles.inputLabel}>Лифтов</label>
              <input
                id="calc-elevators"
                className={styles.input}
                {...numericInputProps(params.elevators, (val) => setParams((p) => ({ ...p, elevators: Math.max(0, val) })), { max: 20 })}
              />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="calc-yard-gates" className={styles.inputLabel}>Дворовые калитки</label>
              <input
                id="calc-yard-gates"
                className={styles.input}
                {...numericInputProps(params.yardGates, (val) => setParams((p) => ({ ...p, yardGates: Math.max(0, val) })), { max: 20 })}
              />
            </div>
          </div>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={params.hasParking}
              onChange={(e) => setParams((p) => ({ ...p, hasParking: e.target.checked }))}
            />
            <span>Есть паркинг (въезд/шлагбаум)</span>
          </label>
          {params.hasParking && (
            <div className={styles.inputGroup} style={{ marginTop: 8 }}>
              <label htmlFor="calc-parking-gates" className={styles.inputLabel}>Въездов / шлагбаумов паркинга</label>
              <input
                id="calc-parking-gates"
                className={styles.input}
                {...numericInputProps(params.parkingGates, (val) => setParams((p) => ({ ...p, parkingGates: Math.max(0, val) })), { max: 20 })}
              />
            </div>
          )}
          <div className={styles.inputGroup} style={{ marginTop: 12 }}>
            <span className={styles.inputLabel}>Охват видеонаблюдением</span>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="coverageType"
                  checked={params.coverageType === 'entrance_only'}
                  onChange={() => setParams((p) => ({ ...p, coverageType: 'entrance_only' }))}
                />
                <span>Только входные группы</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="coverageType"
                  checked={params.coverageType === 'whole_building'}
                  onChange={() => setParams((p) => ({ ...p, coverageType: 'whole_building' }))}
                />
                <span>Весь дом</span>
              </label>
            </div>
          </div>
          {params.coverageType === 'whole_building' && (
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={params.twoCamerasPerFloor}
                onChange={(e) => setParams((p) => ({ ...p, twoCamerasPerFloor: e.target.checked }))}
              />
              <span>2 камеры на этаж</span>
            </label>
          )}
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={params.hasCamerasInLifts}
              onChange={(e) => setParams((p) => ({ ...p, hasCamerasInLifts: e.target.checked }))}
            />
            <span>Камеры в лифтах</span>
          </label>
        </motion.div>

        {/* Результат по группам */}
        {result ? (
          <>
            <div ref={pdfContentRef} className={styles.pdfContentWrap}>
              <motion.div className={styles.resultsTitle} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
                Результат расчёта — видеонаблюдение и домофония
              </motion.div>

              {/* Карточка «Расчет видеонаблюдения ЖК» (BuildingParams) */}
              <motion.div className={styles.paramsCard} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
                <h3 className={styles.paramsCardTitle}>Расчет видеонаблюдения ЖК</h3>

                <div className={styles.paramsBlock}>
                  <div className={styles.paramsBlockTitle}>Здание</div>
                  <div className={styles.paramsRow}>
                    <span className={styles.paramsLabel}>Подъездов</span>
                    <span className={styles.paramsValueNum}>{params.entrances}</span>
                  </div>
                  <div className={styles.paramsRow}>
                    <span className={styles.paramsLabel}>Этажей</span>
                    <span className={styles.paramsValueNum}>{params.floors}</span>
                  </div>
                  <div className={styles.paramsRow}>
                    <span className={styles.paramsLabel}>Лифтов</span>
                    <span className={styles.paramsValueNum}>{params.elevators}</span>
                  </div>
                  <div className={styles.paramsRow}>
                    <span className={styles.paramsLabel}>Дворовые калитки</span>
                    <span className={styles.paramsValueNum}>{params.yardGates}</span>
                  </div>
                  <div className={styles.paramsRow}>
                    <span className={styles.paramsLabel}>Паркинг</span>
                    <span className={styles.paramsValueNum}>{params.hasParking ? `да, ${params.parkingGates} въезд(ов)` : 'нет'}</span>
                  </div>
                  <div className={styles.paramsRow}>
                    <span className={styles.paramsLabel}>Охват</span>
                    <span className={styles.paramsValueNum}>{params.coverageType === 'whole_building' ? 'весь дом' : 'только входные группы'}</span>
                  </div>
                  {params.coverageType === 'whole_building' && (
                    <div className={styles.paramsRow}>
                      <span className={styles.paramsLabel}>Камер на этаж</span>
                      <span className={styles.paramsValueNum}>{params.twoCamerasPerFloor ? '2' : '1'}</span>
                    </div>
                  )}
                  <div className={styles.paramsRow}>
                    <span className={styles.paramsLabel}>Камеры в лифтах</span>
                    <span className={styles.paramsValueNum}>{params.hasCamerasInLifts ? 'да' : 'нет'}</span>
                  </div>
                </div>

                <div className={styles.paramsBlock}>
                  <div className={styles.paramsBlockTitle}>Видеонаблюдение</div>
                  {result.totalCameras > 0 && (
                    <div className={styles.paramsRow}>
                      <span className={styles.paramsLabel}>Всего камер</span>
                      <span className={styles.paramsValueNum}>{result.totalCameras}</span>
                    </div>
                  )}
                  {(result.liftCameras ?? 0) > 0 && (
                    <div className={styles.paramsRow}>
                      <span className={styles.paramsLabel}>В т.ч. лифтовые</span>
                      <span className={styles.paramsValueNum}>{result.liftCameras}</span>
                    </div>
                  )}
                  {result.totalCableMeters != null && result.totalCableMeters > 0 && (
                    <div className={styles.paramsRow}>
                      <span className={styles.paramsLabel}>Кабель, м</span>
                      <span className={styles.paramsValueNum}>{result.totalCableMeters}</span>
                    </div>
                  )}
                </div>

                <p className={styles.paramsFooter}>
                  Расчёт сформирован на основе введённых данных. Итоговые значения могут быть скорректированы менеджером.
                </p>
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
                                <img src={imgSrc} alt="" className={styles.deviceImage} width={48} height={48} />
                              ) : (
                                <span className={styles.devicePlaceholder} aria-hidden>—</span>
                              )}
                            </td>
                            <td>
                              <span className={styles.rowName}>{row.name}</span>
                              {row.unitPrice != null && itemPurposes[row.name] && (
                                <div className={styles.rowPurpose}>💡 {itemPurposes[row.name]}</div>
                              )}
                            </td>
                            <td>{row.qty > 0 ? row.qty : '—'}</td>
                            <td>{row.unitPrice != null ? formatKzt(row.unitPrice) : '—'}</td>
                            <td className={styles.cellSum}>{formatKzt(row.sum)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className={styles.groupSubtotal}>
                    Итого {group.title.toLowerCase()}: <strong>{formatKzt(group.subtotal)}</strong>
                  </div>
                </motion.div>
              ))}


              <motion.div className={styles.totalBlock} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
                <div className={styles.totalRow}>
                  <span>Оборудование</span>
                  <strong>{formatKzt(result.equipment)}</strong>
                </div>
                <div className={styles.totalRow}>
                  <span>Расходные материалы</span>
                  <strong>{formatKzt(result.consumables ?? 0)}</strong>
                </div>
                {result.installation.breakdown.map((b) => (
                  <div key={b.name} className={styles.totalRow}>
                    <span>{b.name}</span>
                    <strong>{formatKzt(b.sum)}</strong>
                  </div>
                ))}
                <div className={styles.totalRowHighlight}>
                  <span>ИТОГО ПО ПРОЕКТУ</span>
                  <strong>{formatKzt(result.grandTotal)}</strong>
                </div>
              </motion.div>

              {result.grandTotal > 0 && hasCctv && (
                <motion.div className={styles.subscriptionBlock} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
                  <h4 className={styles.subscriptionTitle}>Абонентская плата</h4>
                  <p className={styles.subscriptionHint}>Расчёт только по числу квартир</p>
                  <div className={styles.inputGroup}>
                    <label htmlFor="calc-flat-count" className={styles.inputLabel}>Количество квартир</label>
                    <input
                      id="calc-flat-count"
                      type="number"
                      min={0}
                      className={styles.input}
                      value={flatCount > 0 ? flatCount : ''}
                      onChange={(e) => setFlatCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      placeholder={derivedFlats ? String(derivedFlats) : '0'}
                    />
                  </div>

                  <div className={styles.subscriptionRates}>
                    {hasCctv && (
                      <div className={styles.subscriptionRow}>
                        <span className={styles.subscriptionIcon} aria-hidden>📷</span>
                        <span className={styles.subscriptionLabel}>Видеонаблюдение</span>
                        <span className={styles.subscriptionFormula}>
                          {formatKzt(TARIFF_CCTV_PER_FLAT)} × {apartments} кв. = <strong>{formatKzt(cctvMonthly)}</strong>/мес
                        </span>
                      </div>
                    )}
                  </div>

                  <div className={styles.subscriptionDivider} />
                  <div className={styles.subscriptionTotalRow}>
                    <span>Итого с дома в месяц</span>
                    <strong>{formatKzt(totalSubscriptionMonthly)}</strong>
                  </div>

                  {totalSubscriptionMonthly > 0 && (
                    <div className={styles.subscriptionPayback}>
                      <span className={styles.subscriptionIcon} aria-hidden>📈</span>
                      <span>Срок окупаемости:</span>
                      <strong> {paybackMonths} мес.</strong>
                      <span className={styles.subscriptionPaybackYears}> (~{paybackYears} лет)</span>
                    </div>
                  )}

                  <div className={styles.installmentRef}>
                    <span className={styles.installmentRefTitle}>Рассрочка (справочно)</span>
                    <div className={styles.installmentRefRow}>
                      <span>36 мес.</span>
                      <span>{formatKzt(Math.round(result.grandTotal / 36))} ₸/мес</span>
                    </div>
                    <div className={styles.installmentRefRow}>
                      <span>48 мес.</span>
                      <span>{formatKzt(Math.round(result.grandTotal / 48))} ₸/мес</span>
                    </div>
                    <div className={styles.installmentRefRow}>
                      <span>60 мес.</span>
                      <span>{formatKzt(Math.round(result.grandTotal / 60))} ₸/мес</span>
                    </div>
                  </div>

                  <p className={styles.subscriptionDisclaimer}>Расчёт приблизительный, условия уточняйте у менеджера</p>
                </motion.div>
              )}
            </div>

            <p className={styles.estimateDisclaimer}>
              Расчёт является предварительным. Для точной сметы свяжитесь с нашим специалистом.
            </p>

            <motion.div className={styles.actionsRow} variants={reduceMotion ? undefined : cardVariants} initial="visible" animate="visible">
              <button type="button" className={styles.btnPrimary} onClick={() => downloadKP(result)}>
                Скачать КП (.docx)
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() =>
                  downloadKPFull(result, intercomDirty ? intercomResult : null, {
                    apartments,
                    installmentMonths: 60,
                  })
                }
              >
                КП Полное (.docx)
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() =>
                  downloadFinModel(result, intercomDirty ? intercomResult : null, {
                    apartments,
                    downPayment: 0,
                    installmentMonths: 60,
                  })
                }
              >
                Финансовая модель (.docx)
              </button>
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

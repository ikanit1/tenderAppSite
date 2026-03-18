import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useCalculatorStore } from '@/store/calculatorStore';
import { stepSectionVariants } from '@/shared/animations/sectionReveal';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlowButton } from '@/components/ui/GlowButton';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { ResultTable } from '@/components/calculator/ResultTable';
import { formatKzt } from '@/lib/calculations';
import { exportResultToPDFDirect, type ExportMeta } from '@/lib/exportPDF';
import { downloadKP } from '@/widgets/calculator/generateKP';
import { submitLead } from '@/shared/api/leadApi';
import { useToast } from '@/features/toast/ToastProvider';
import { calculatorContact } from '@/shared/content/calculatorConfig';
import type { BuildingParams, CalculatorResult } from '@/widgets/calculator/calculatorLogic';
import styles from './Step5Result.module.css';

function buildSummaryText(params: BuildingParams, result: CalculatorResult): string {
  const lines: string[] = [
    'Расчёт с калькулятора видеонаблюдения (grgroup.kz)',
    '',
    '── Параметры ──',
    `Подъездов: ${params.entrances}, этажей: ${params.floors}, лифтов: ${params.elevators}`,
    `Калитки: ${params.yardGates}, паркинг: ${params.hasParking ? `да, ${params.parkingGates} въезд(ов)` : 'нет'}`,
    `Охват: ${params.coverageType === 'whole_building' ? 'весь дом' : 'только входные группы'}${params.coverageType === 'whole_building' ? `, ${params.twoCamerasPerFloor ? '2' : '1'} камеры на этаж` : ''}, камеры в лифтах: ${params.hasCamerasInLifts ? 'да' : 'нет'}`,
    '',
    '── ИТОГ ──',
    `Камер: ${result.totalCameras}, кабель: ${result.totalCableMeters} м`,
    `Оборудование: ${formatKzt(result.equipment)}`,
    `Расходные материалы: ${formatKzt(result.consumables ?? 0)}`,
    `Монтаж: ${formatKzt(result.installation.total)}`,
    `ИТОГО: ${formatKzt(result.grandTotal)}`,
  ];
  return lines.join('\n');
}

export function Step5Result() {
  const reduceMotion = useReducedMotion();
  const result = useCalculatorStore((s) => s.result);
  const params = useCalculatorStore((s) => s.params);
  const reset = useCalculatorStore((s) => s.reset);
  const { show } = useToast();
  const [flatCount, setFlatCount] = useState<number>(0);
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitName, setSubmitName] = useState('');
  const [submitPhone, setSubmitPhone] = useState('');
  const [submitEmail, setSubmitEmail] = useState('');
  const [submitSending, setSubmitSending] = useState(false);

  const total = result?.grandTotal ?? 0;
  const meta: ExportMeta = {
    projectName: `Объект — ${params.entrances} подъезд., ${params.floors} этаж.`,
    date: new Date().toLocaleDateString('ru-KZ'),
    preparedBy: 'electro.kz',
  };

  const handleReset = () => {
    if (window.confirm('Сбросить все данные и начать заново?')) {
      reset();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleEmail = () => setModalOpen(true);

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

  const handlePDF = () => {
    if (!result) return;
    setExporting('pdf');
    try {
      exportResultToPDFDirect(result, meta);
    } catch (e) {
      show('Не удалось сформировать PDF.', 'error');
    } finally {
      setExporting(null);
    }
  };

  const handleDocx = async () => {
    if (!result) return;
    setExporting('docx');
    try {
      await downloadKP(result);
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
      <GlassCard className={styles.totalCard}>
        <div className={styles.totalLabel}>Итого по проекту</div>
        <AnimatedCounter value={total} className={styles.totalValue} />
      </GlassCard>

      {result && (
        <ResultTable
          result={result}
          showInstallment={true}
          flatCount={flatCount}
          onFlatsChange={setFlatCount}
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
          <GlowButton variant="primary" onClick={handlePDF} disabled={!result || exporting === 'pdf'}>
            {exporting === 'pdf' ? 'Генерация…' : 'Скачать PDF'}
          </GlowButton>
          <GlowButton variant="secondary" onClick={handleDocx} disabled={!result || exporting === 'docx'}>
            {exporting === 'docx' ? 'Генерация…' : 'КП полное .docx'}
          </GlowButton>
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

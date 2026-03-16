import { useState } from 'react';
import { motion } from 'framer-motion';
import { useCalculatorStore } from '@/store/calculatorStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlowButton } from '@/components/ui/GlowButton';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { ResultTable } from '@/components/calculator/ResultTable';
import { FinanceBlock } from '@/components/calculator/FinanceBlock';
import { formatKzt } from '@/lib/calculations';
import { exportResultToPDFDirect, type ExportMeta } from '@/lib/exportPDF';
import { downloadKP } from '@/widgets/calculator/generateKP';
import { submitLead } from '@/shared/api/leadApi';
import { useToast } from '@/features/toast/ToastProvider';
import { calculatorContact } from '@/shared/content/calculatorConfig';
import type { CalculatorInputs, CalculatorResult } from '@/widgets/calculator/calculatorLogic';
import styles from './Step5Result.module.css';

function buildSummaryText(input: CalculatorInputs, result: CalculatorResult): string {
  const ct = input.cameraTypes;
  const lines: string[] = [
    'Расчёт с калькулятора видеонаблюдения и домофонии (grgroup.kz)',
    '',
    '── Параметры ──',
    `Камеры: уличные 2MP ${ct.outdoor2mp}, внутр. 2MP ${ct.indoor2mp}, внутр. 4MP ${ct.indoor4mp}, опоз. номерного знака ${ct.anpr3mp}`,
    `Лифты: ${input.elevatorCount} шт., тип ${input.elevatorCameraType}`,
    `Домофония: подъездов ${input.intercom.entrances}, этажей ${input.intercom.floorsPerEntrance}, квартир на этаже ${input.intercom.flatsPerFloor}`,
    '',
    '── ИТОГ ──',
    `Оборудование: ${formatKzt(result.equipment)}`,
    `Расходные материалы: ${formatKzt(result.consumables ?? 0)}`,
    `ИТОГО: ${formatKzt(result.grandTotal)}`,
  ];
  return lines.join('\n');
}

export function Step5Result() {
  const result = useCalculatorStore((s) => s.result);
  const inputs = useCalculatorStore((s) => s.inputs);
  const setStep = useCalculatorStore((s) => s.setStep);
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
  const derivedFlats =
    flatCount > 0
      ? flatCount
      : inputs.intercom.entrances * inputs.intercom.floorsPerEntrance * inputs.intercom.flatsPerFloor || 200;

  const totalFlats = inputs.intercom.entrances * inputs.intercom.floorsPerEntrance * inputs.intercom.flatsPerFloor;
  const meta: ExportMeta = {
    projectName: `ЖК — ${totalFlats || '—'} кв., ${inputs.intercom.entrances || '—'} подъездов`,
    date: new Date().toLocaleDateString('ru-KZ'),
    preparedBy: 'electro.kz',
  };

  const handleReset = () => {
    if (window.confirm('Сбросить все данные и начать заново?')) {
      reset();
      setStep(1);
    }
  };

  const handleBack = () => setStep(4);

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
    <motion.div className={styles.wrap} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h2 className={styles.title}>Итоговая смета</h2>
      <GlassCard className={styles.totalCard}>
        <div className={styles.totalLabel}>Итого по проекту</div>
        <AnimatedCounter value={total} className={styles.totalValue} />
      </GlassCard>

      {result && (
        <ResultTable
          result={result}
          showInstallment={true}
          flatCount={flatCount > 0 ? flatCount : derivedFlats}
        />
      )}

      {result && result.grandTotal > 0 && (
        <div className={styles.installmentInput}>
          <label htmlFor="step5-flats" className={styles.installmentInputLabel}>
            Количество квартир для расчёта «с квартиры»
          </label>
          <input
            id="step5-flats"
            type="number"
            min={0}
            value={flatCount || ''}
            onChange={(e) => setFlatCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
            placeholder={String(derivedFlats)}
            className={styles.installmentInputField}
          />
        </div>
      )}

      {result && <FinanceBlock result={result} />}

      <div className={styles.actions}>
        <div className={styles.actionsLeft}>
          <GlowButton variant="ghost" onClick={handleReset}>
            Начать заново
          </GlowButton>
          <GlowButton variant="ghost" onClick={handleBack}>
            Назад
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

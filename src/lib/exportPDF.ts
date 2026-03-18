/**
 * Экспорт сметы калькулятора в PDF.
 * Для кириллицы используется шрифт Roboto из пакета roboto-base64 (без внешних запросов, без CORS).
 */
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { CalculatorResult } from '@/widgets/calculator/calculatorLogic';

// Шрифт Roboto (normal + bold) в base64 — из npm-пакета, без fetch/CORS
import robotoBase64 from 'roboto-base64';

export interface ExportMeta {
  projectName?: string;
  clientName?: string;
  date?: string;
  preparedBy?: string;
}

function getRobotoFont(): { normal: string; bold: string } {
  return { normal: robotoBase64.normal, bold: robotoBase64.bold };
}

function applyRobotoFont(pdf: jsPDF, font: { normal: string; bold: string }): void {
  pdf.addFileToVFS('Roboto-Regular.ttf', font.normal);
  pdf.addFileToVFS('Roboto-Bold.ttf', font.bold);
  pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  pdf.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
  pdf.setFont('Roboto', 'normal');
}

function formatKztPDF(n: number): string {
  return new Intl.NumberFormat('ru-KZ', {
    style: 'currency',
    currency: 'KZT',
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Экспорт полной сметы в PDF через html2canvas (скриншот DOM-элемента).
 */
export async function exportResultToPDF(
  elementId: string,
  meta: ExportMeta = {},
  filename = 'smeta-cctv.pdf'
): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) throw new Error(`Element #${elementId} not found`);

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#0A0E1A',
  });

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  applyRobotoFont(pdf, getRobotoFont());
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ratio = canvas.height / canvas.width;
  const imgW = pageW - 20;
  const imgH = imgW * ratio;

  pdf.setFontSize(10);
  pdf.setTextColor(150);
  pdf.text(`КП: ${meta.projectName ?? '—'}`, 10, 10);
  pdf.text(`Заказчик: ${meta.clientName ?? '—'}`, 10, 15);
  pdf.text(`Дата: ${meta.date ?? new Date().toLocaleDateString('ru-KZ')}`, pageW - 50, 10);

  let yPos = 20;
  let remaining = imgH;
  let srcY = 0;

  while (remaining > 0) {
    const sliceH = Math.min(remaining, pageH - yPos - 10);
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = (sliceH / imgH) * canvas.height;
    const ctx = sliceCanvas.getContext('2d')!;
    ctx.drawImage(canvas, 0, srcY, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);
    pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 10, yPos, imgW, sliceH);
    remaining -= sliceH;
    srcY += sliceCanvas.height;
    if (remaining > 0) {
      pdf.addPage();
      yPos = 10;
    }
  }

  pdf.setFontSize(8);
  pdf.setTextColor(100);
  pdf.text(`Составил: ${meta.preparedBy ?? ''}`, 10, pageH - 8);
  pdf.text('grgroup.kz', pageW - 30, pageH - 8);

  pdf.save(filename);
}

/**
 * Экспорт через jsPDF напрямую из данных (без DOM).
 * Использует шрифт Roboto для корректного отображения кириллицы.
 */
export function exportResultToPDFDirect(
  result: CalculatorResult,
  meta: ExportMeta = {},
  filename = 'smeta-cctv.pdf'
): void {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  applyRobotoFont(pdf, getRobotoFont());
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  const checkPage = (needed = 8) => {
    if (y + needed > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  pdf.setFillColor(10, 14, 26);
  pdf.rect(0, 0, pageW, 25, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.setFont('Roboto', 'bold');
  pdf.text('КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ', margin, 12);
  pdf.setFontSize(9);
  pdf.setFont('Roboto', 'normal');
  pdf.text(`${meta.projectName ?? 'Система видеонаблюдения и домофонии'}`, margin, 19);
  pdf.text(`Дата: ${meta.date ?? new Date().toLocaleDateString('ru-KZ')}`, pageW - 50, 19);
  y = 32;

  if (meta.clientName) {
    pdf.setTextColor(80, 80, 80);
    pdf.setFontSize(9);
    pdf.text(`Заказчик: ${meta.clientName}`, margin, y);
    y += 6;
  }

  result.groups.forEach((group) => {
    checkPage(12);
    pdf.setFillColor(31, 41, 55);
    pdf.rect(margin - 2, y - 4, pageW - margin * 2 + 4, 8, 'F');
    pdf.setTextColor(59, 130, 246);
    pdf.setFontSize(10);
    pdf.setFont('Roboto', 'bold');
    pdf.text(group.title, margin, y);
    y += 7;

    group.rows.forEach((row) => {
      checkPage(7);
      pdf.setTextColor(50, 50, 50);
      pdf.setFontSize(8);
      pdf.setFont('Roboto', 'normal');
      const name = row.name.length > 45 ? row.name.slice(0, 42) + '...' : row.name;
      pdf.text(name, margin, y);
      pdf.text(String(row.qty ?? ''), pageW - 70, y, { align: 'right' });
      pdf.text(formatKztPDF(row.unitPrice ?? 0), pageW - 45, y, { align: 'right' });
      pdf.setFont('Roboto', 'bold');
      pdf.text(formatKztPDF(row.sum ?? 0), pageW - margin, y, { align: 'right' });
      y += 6;
    });

    checkPage(8);
    pdf.setDrawColor(59, 130, 246);
    pdf.line(margin, y, pageW - margin, y);
    y += 3;
    pdf.setTextColor(59, 130, 246);
    pdf.setFontSize(9);
    pdf.setFont('Roboto', 'bold');
    pdf.text(`Итого: ${group.title}`, margin, y);
    pdf.text(formatKztPDF(group.subtotal), pageW - margin, y, { align: 'right' });
    y += 10;
  });

  checkPage(40);
  pdf.setFillColor(10, 14, 26);
  pdf.rect(margin - 2, y - 2, pageW - margin * 2 + 4, 38, 'F');
  const inst = result.installation;
  const work = inst?.cameraInstall ?? 0;
  const cableInstall = inst?.cableInstall ?? 0;
  const totals: [string, number][] = [
    ['Оборудование:', result.equipment],
    ['Расходные материалы:', result.consumables ?? 0],
    ['Монтажные работы:', work],
    ['Монтаж кабеля:', cableInstall],
  ];
  pdf.setFontSize(9);
  totals.forEach(([label, val]) => {
    pdf.setFont('Roboto', 'normal');
    pdf.setTextColor(180, 180, 180);
    pdf.text(String(label), margin + 2, y);
    pdf.setFont('Roboto', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text(formatKztPDF(Number(val)), pageW - margin - 2, y, { align: 'right' });
    y += 6;
  });
  pdf.setFontSize(12);
  pdf.setTextColor(59, 130, 246);
  pdf.text('ИТОГО ПО ПРОЕКТУ:', margin + 2, y + 2);
  pdf.setFontSize(14);
  pdf.text(formatKztPDF(result.grandTotal), pageW - margin - 2, y + 2, { align: 'right' });

  pdf.setFontSize(8);
  pdf.setTextColor(120);
  pdf.setFont('Roboto', 'normal');
  pdf.text(`Составил: ${meta.preparedBy ?? ''}`, margin, pageH - 8);
  pdf.text('grgroup.kz', pageW - margin, pageH - 8, { align: 'right' });

  pdf.save(filename);
}

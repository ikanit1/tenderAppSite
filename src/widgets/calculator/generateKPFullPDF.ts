/**
 * Генерация «КП Полное» в формате PDF через jsPDF.
 * Включает:
 *  — Шапка с логотипом и контактами
 *  — Секция I: Видеонаблюдение (оборудование + монтаж)
 *  — Секция II: Домофония (оборудование + монтаж + ПНР)
 *  — Сводный итог
 *  — Условия и гарантии
 *  — Подпись и печать
 *  — Нижний колонтитул на каждой странице
 */
import jsPDF from 'jspdf';
import robotoBase64 from 'roboto-base64';
import type { CalculatorResult } from '@/widgets/calculator/calculatorLogic';
import type { IntercomResult } from '@/store/calculatorStore';

// ── Константы ────────────────────────────────────────────────────────────────

const PRIMARY = '#1B3A8C';
const PRIMARY_LIGHT = '#2B4DA8';
const PRIMARY_BG_RGB: [number, number, number] = [232, 240, 254];
const ROW_ALT_RGB: [number, number, number] = [248, 249, 250];
const ROW_TOTAL_RGB: [number, number, number] = [238, 242, 255];
const DARK_BG_RGB: [number, number, number] = [27, 58, 140];
const WHITE_RGB: [number, number, number] = [255, 255, 255];


const PAGE_W = 210; // A4 width mm
const PAGE_H = 297; // A4 height mm
const ML = 20;      // margin left
const MR = 15;      // margin right
const MT = 20;      // margin top
const MB = 20;      // margin bottom
const CW = PAGE_W - ML - MR; // content width

// ── Утилиты ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('ru-KZ', {
    style: 'currency',
    currency: 'KZT',
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Масштабирует изображение через Canvas.
 * bgColor: цвет фона (hex без #) — нужен для PNG с прозрачностью чтобы jsPDF не показывал чёрный фон.
 * Для логотипа на синей шапке передать '1B3A8C', для печати на белом фоне — 'FFFFFF'.
 */
/**
 * Подготавливает изображение для вставки в PDF:
 * — рендерит в Canvas в высоком разрешении (300 dpi = 11.81 px/mm)
 * — заполняет фон bgColor (нет прозрачности — jsPDF не поддерживает)
 * — возвращает JPEG base64 + итоговые мм-размеры для addImage
 */
async function scaleImage(
  buffer: ArrayBuffer,
  maxMmW: number,
  maxMmH: number,
  bgColor = 'FFFFFF'
): Promise<{ data: string; format: 'JPEG'; mmW: number; mmH: number }> {
  const DPI = 300;
  const PX_PER_MM = DPI / 25.4; // ~11.81 px/mm при 300 dpi
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer]);
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      // Определяем соотношение сторон оригинала
      const aspect = img.naturalWidth / img.naturalHeight;
      // Целевые мм-размеры с учётом ограничений
      let mmW = maxMmW;
      let mmH = maxMmW / aspect;
      if (mmH > maxMmH) { mmH = maxMmH; mmW = maxMmH * aspect; }
      // Рендерим в высоком разрешении
      const pxW = Math.round(mmW * PX_PER_MM);
      const pxH = Math.round(mmH * PX_PER_MM);
      const canvas = document.createElement('canvas');
      canvas.width = pxW;
      canvas.height = pxH;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = `#${bgColor}`;
      ctx.fillRect(0, 0, pxW, pxH);
      ctx.drawImage(img, 0, 0, pxW, pxH);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      resolve({ data: dataUrl.split(',')[1], format: 'JPEG', mmW, mmH });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img load failed')); };
    img.src = url;
  });
}

function kpNumber(): string {
  const d = new Date();
  const ymd =
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  return `КП-${ymd}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
}

function dateText(d: Date): string {
  const months = 'января февраля марта апреля мая июня июля августа сентября октября ноября декабря'.split(' ');
  return `«${d.getDate()}» ${months[d.getMonth()]} ${d.getFullYear()} г.`;
}

function validUntilStr(d: Date): string {
  const next = new Date(d);
  next.setDate(next.getDate() + 3);
  return next.toLocaleDateString('ru-RU');
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// ── Инициализация шрифтов ────────────────────────────────────────────────────

function setupFonts(pdf: jsPDF): void {
  pdf.addFileToVFS('Roboto-Regular.ttf', robotoBase64.normal);
  pdf.addFileToVFS('Roboto-Bold.ttf', robotoBase64.bold);
  pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  pdf.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
}

// ── Класс-помощник для позиционирования ──────────────────────────────────────

class PDFWriter {
  pdf: jsPDF;
  y: number;

  constructor(pdf: jsPDF) {
    this.pdf = pdf;
    this.y = MT;
  }

  get pageCount(): number {
    return this.pdf.getNumberOfPages();
  }

  checkPage(needed: number): void {
    if (this.y + needed > PAGE_H - MB) {
      this.pdf.addPage();
      this.y = MT;
    }
  }

  setFont(bold: boolean, size: number): void {
    this.pdf.setFont('Roboto', bold ? 'bold' : 'normal');
    this.pdf.setFontSize(size);
  }

  setColor(rgb: [number, number, number]): void {
    this.pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
  }

  fillRect(x: number, y: number, w: number, h: number, rgb: [number, number, number]): void {
    this.pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
    this.pdf.rect(x, y, w, h, 'F');
  }

  strokeRect(x: number, y: number, w: number, h: number, rgb: [number, number, number], lw = 0.2): void {
    this.pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
    this.pdf.setLineWidth(lw);
    this.pdf.rect(x, y, w, h, 'S');
  }

  text(str: string, x: number, y: number, align: 'left' | 'center' | 'right' = 'left', maxWidth?: number): void {
    const opts: Parameters<jsPDF['text']>[3] = { align };
    if (maxWidth != null) opts.maxWidth = maxWidth;
    this.pdf.text(str, x, y, opts);
  }

  multilineText(str: string, x: number, _startY: number, maxWidth: number, lineH: number, bold: boolean, size: number, rgb: [number, number, number]): number {
    this.setFont(bold, size);
    this.setColor(rgb);
    const lines = this.pdf.splitTextToSize(str, maxWidth) as string[];
    for (const line of lines) {
      this.checkPage(lineH + 2);
      this.text(line, x, this.y);
      this.y += lineH;
    }
    return this.y;
  }
}

// ── Шапка документа ──────────────────────────────────────────────────────────

type ImgData = { data: string; format: 'JPEG'; mmW: number; mmH: number } | null;

async function drawHeader(w: PDFWriter, logo: ImgData, _stamp: ImgData): Promise<void> {
  const headerH = 28;
  // Dark blue background
  w.fillRect(0, 0, PAGE_W, headerH, DARK_BG_RGB);

  // Logo
  const logoPadL = ML;
  if (logo) {
    try {
      w.pdf.addImage(logo.data, logo.format, logoPadL, 3, logo.mmW, logo.mmH);
    } catch { /* skip */ }
  }

  // Company name under logo
  w.setFont(true, 8);
  w.setColor(WHITE_RGB);
  w.text('ТОО «G&R Group»', logoPadL, (logo?.mmH ?? 20) + 5);

  // Right-side contacts
  const rx = PAGE_W - MR;
  w.setFont(true, 10);
  w.setColor(WHITE_RGB);
  w.text('+7 771 421 55 93', rx, 8, 'right');
  w.setFont(false, 8);
  w.text('info@grgroup.kz', rx, 13, 'right');
  w.text('grgroup.kz', rx, 17.5, 'right');
  w.text('г. Астана, Казахстан', rx, 22, 'right');

  w.y = headerH + 8;
}

// ── Заголовок КП ─────────────────────────────────────────────────────────────

function drawKPTitle(w: PDFWriter, kpNum: string, now: Date): void {
  w.checkPage(20);
  w.setFont(true, 14);
  w.setColor(hexToRgb(PRIMARY));
  w.text(`КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ № ${kpNum}`, PAGE_W / 2, w.y, 'center');
  w.y += 7;

  const validStr = validUntilStr(now);
  w.setFont(false, 10);
  w.setColor([50, 50, 50]);
  w.text(`от ${dateText(now)}   Действительно до: ${validStr}`, PAGE_W / 2, w.y, 'center');
  w.y += 8;
}

// ── Заголовок секции ─────────────────────────────────────────────────────────

function drawSectionHeading(w: PDFWriter, title: string): void {
  w.checkPage(10);
  w.fillRect(ML, w.y - 4, CW, 8, DARK_BG_RGB);
  w.setFont(true, 11);
  w.setColor(WHITE_RGB);
  w.text(title, ML + 3, w.y + 0.5);
  w.y += 8;
}

// ── Заголовок группы ─────────────────────────────────────────────────────────

function drawGroupTitle(w: PDFWriter, title: string): void {
  w.checkPage(8);
  w.fillRect(ML, w.y - 4, CW, 7, PRIMARY_BG_RGB);
  w.setFont(true, 9);
  w.setColor(hexToRgb(PRIMARY_LIGHT));
  w.text(title, ML + 3, w.y + 0.2);
  w.y += 6;
}

// ── Таблица оборудования ─────────────────────────────────────────────────────

interface TableRow {
  num: string;
  name: string;
  qty: string;
  unitPrice: string;
  sum: string;
  isBold?: boolean;
  bgRgb?: [number, number, number];
  textRgb?: [number, number, number];
}

function drawEquipTable(w: PDFWriter, rows: TableRow[]): void {
  // Column widths (relative proportions summing to CW)
  const cols = [10, CW - 10 - 22 - 32 - 32, 22, 32, 32]; // num, name, qty, unitPrice, sum
  const colX = [ML];
  for (let i = 0; i < cols.length - 1; i++) colX.push(colX[i] + cols[i]);

  const ROW_H = 6.5;
  const HEADER_H = 7;

  // Header
  w.checkPage(HEADER_H + 2);
  w.fillRect(ML, w.y - 4, CW, HEADER_H, DARK_BG_RGB);
  const headers = ['№', 'Наименование', 'Кол-во', 'Ед. цена', 'Сумма'];
  const aligns: Array<'left' | 'center' | 'right'> = ['center', 'left', 'center', 'right', 'right'];
  w.setFont(true, 7.5);
  w.setColor(WHITE_RGB);
  for (let i = 0; i < headers.length; i++) {
    const cx = aligns[i] === 'center' ? colX[i] + cols[i] / 2 : aligns[i] === 'right' ? colX[i] + cols[i] - 1 : colX[i] + 1;
    w.text(headers[i], cx, w.y + 0.5, aligns[i]);
  }

  // Draw header border
  w.strokeRect(ML, w.y - 4, CW, HEADER_H, [200, 200, 200]);
  w.y += HEADER_H - 1;

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const bg = row.bgRgb ?? (ri % 2 === 0 ? WHITE_RGB : ROW_ALT_RGB);
    const textColor = row.textRgb ?? ([50, 50, 50] as [number, number, number]);

    // Wrap name
    w.setFont(row.isBold ?? false, 7.5);
    const nameLines = (w.pdf.splitTextToSize(row.name, cols[1] - 2) as string[]);
    const cellH = Math.max(ROW_H, nameLines.length * 4.5 + 2);

    w.checkPage(cellH + 1);

    w.fillRect(ML, w.y - 4, CW, cellH, bg);

    w.setFont(row.isBold ?? false, 7.5);
    w.setColor(textColor);

    // № centered
    w.text(row.num, colX[0] + cols[0] / 2, w.y, 'center');
    // Name left
    for (let li = 0; li < nameLines.length; li++) {
      w.text(nameLines[li], colX[1] + 1, w.y + li * 4.5);
    }
    // Qty centered
    w.text(row.qty, colX[2] + cols[2] / 2, w.y, 'center');
    // Unit price right
    w.text(row.unitPrice, colX[3] + cols[3] - 1, w.y, 'right');
    // Sum right
    w.setFont(true, 7.5);
    w.text(row.sum, colX[4] + cols[4] - 1, w.y, 'right');

    w.strokeRect(ML, w.y - 4, CW, cellH, [200, 200, 200]);
    w.y += cellH;
  }
  w.y += 2;
}

// ── Строка итога секции ───────────────────────────────────────────────────────

function drawSectionTotal(w: PDFWriter, label: string, value: number): void {
  w.checkPage(9);
  w.fillRect(ML, w.y - 4, CW, 8, ROW_TOTAL_RGB);
  w.setFont(true, 9);
  w.setColor(hexToRgb(PRIMARY_LIGHT));
  w.text(label, ML + 3, w.y + 0.5);
  w.text(fmt(value), ML + CW - 1, w.y + 0.5, 'right');
  w.strokeRect(ML, w.y - 4, CW, 8, hexToRgb(PRIMARY_LIGHT));
  w.y += 9;
}

// ── Выделенная итоговая строка (синяя) ───────────────────────────────────────

function drawHighlightTotal(w: PDFWriter, label: string, value: number): void {
  w.checkPage(10);
  w.fillRect(ML, w.y - 4, CW, 9, DARK_BG_RGB);
  w.setFont(true, 10);
  w.setColor(WHITE_RGB);
  w.text(label, ML + 3, w.y + 0.8);
  w.text(fmt(value), ML + CW - 1, w.y + 0.8, 'right');
  w.y += 11;
}

// ── Секция I: Видеонаблюдение ─────────────────────────────────────────────────

function drawCCTVSection(w: PDFWriter, cctv: CalculatorResult): void {
  drawSectionHeading(w, 'Раздел I — Видеонаблюдение');
  w.y += 2;

  let globalRowNum = 1;

  for (const group of cctv.groups) {
    drawGroupTitle(w, group.title);

    const tableRows: TableRow[] = group.rows.map((row) => ({
      num: String(globalRowNum++),
      name: row.name,
      qty: String(row.qty),
      unitPrice: row.unitPrice != null ? fmt(row.unitPrice) : '—',
      sum: fmt(row.sum),
    }));
    drawEquipTable(w, tableRows);

    drawSectionTotal(w, `Итого: ${group.title}`, group.subtotal);
    w.y += 3;
  }

  // Installation breakdown
  const installRows: TableRow[] = [];
  if (cctv.installation.cameraInstall != null && cctv.installation.cameraInstall > 0) {
    installRows.push({
      num: String(globalRowNum++),
      name: 'Монтаж камер',
      qty: String(cctv.totalCameras),
      unitPrice: fmt(Math.round(cctv.installation.cameraInstall / Math.max(cctv.totalCameras, 1))),
      sum: fmt(cctv.installation.cameraInstall),
    });
  }
  if (cctv.installation.cableInstall != null && cctv.installation.cableInstall > 0) {
    installRows.push({
      num: String(globalRowNum++),
      name: 'Прокладка кабеля UTP',
      qty: String(cctv.totalCableMeters) + ' м',
      unitPrice: fmt(Math.round(cctv.installation.cableInstall / Math.max(cctv.totalCableMeters, 1))),
      sum: fmt(cctv.installation.cableInstall),
    });
  }
  if (cctv.installation.breakdown) {
    for (const b of cctv.installation.breakdown) {
      installRows.push({
        num: String(globalRowNum++),
        name: b.name,
        qty: '—',
        unitPrice: '—',
        sum: fmt(b.sum),
      });
    }
  }

  if (installRows.length > 0) {
    drawGroupTitle(w, 'Монтажные работы');
    drawEquipTable(w, installRows);
    drawSectionTotal(w, 'Итого монтаж', cctv.installation.total);
    w.y += 3;
  }

  drawHighlightTotal(w, 'ИТОГО видеонаблюдение:', cctv.grandTotal);
  w.y += 4;
}

// ── Секция II: Домофония ──────────────────────────────────────────────────────

function drawIntercomSection(w: PDFWriter, ir: IntercomResult): void {
  drawSectionHeading(w, 'Раздел II — Домофония');
  w.y += 2;

  const equipRows: TableRow[] = [];
  let n = 1;
  if (ir.switches4port > 0) {
    equipRows.push({
      num: String(n++),
      name: 'PoE-коммутатор 4-порт Wi-Tek WK-PS305',
      qty: String(ir.switches4port),
      unitPrice: fmt(Math.round(ir.costSwitches4port / ir.switches4port)),
      sum: fmt(ir.costSwitches4port),
    });
  }
  if (ir.managedSwitches > 0) {
    equipRows.push({
      num: String(n++),
      name: 'Управляемый коммутатор DH-SG4010-2F',
      qty: String(ir.managedSwitches),
      unitPrice: fmt(Math.round(ir.costManagedSwitches / ir.managedSwitches)),
      sum: fmt(ir.costManagedSwitches),
    });
  }
  if (ir.callPanels > 0) {
    equipRows.push({
      num: String(n++),
      name: 'Вызывная панель домофона',
      qty: String(ir.callPanels),
      unitPrice: fmt(Math.round(ir.costPanelEquip / ir.callPanels)),
      sum: fmt(ir.costPanelEquip),
    });
  }
  if (ir.utpMeters > 0) {
    equipRows.push({
      num: String(n++),
      name: 'Кабель UTP Cat5e',
      qty: String(ir.utpMeters) + ' м',
      unitPrice: fmt(Math.round(ir.costUtp / Math.max(ir.utpMeters, 1))),
      sum: fmt(ir.costUtp),
    });
  }
  if (ir.costConsumables > 0) {
    equipRows.push({
      num: String(n++),
      name: 'Расходные материалы',
      qty: '1',
      unitPrice: fmt(ir.costConsumables),
      sum: fmt(ir.costConsumables),
    });
  }

  if (equipRows.length > 0) {
    drawGroupTitle(w, 'Оборудование домофонии');
    drawEquipTable(w, equipRows);
    const equipTotal = ir.costSwitches4port + ir.costPanelEquip + ir.costManagedSwitches + ir.costUtp + ir.costConsumables;
    drawSectionTotal(w, 'Итого оборудование', equipTotal);
    w.y += 3;
  }

  const installRows: TableRow[] = [];
  n = 1;
  if (ir.installUtp > 0) {
    installRows.push({
      num: String(n++),
      name: 'Прокладка кабеля UTP',
      qty: String(ir.utpMeters) + ' м',
      unitPrice: fmt(Math.round(ir.installUtp / Math.max(ir.utpMeters, 1))),
      sum: fmt(ir.installUtp),
    });
  }
  if (ir.installPanels > 0) {
    installRows.push({
      num: String(n++),
      name: 'Монтаж вызывных панелей',
      qty: String(ir.callPanels),
      unitPrice: fmt(Math.round(ir.installPanels / Math.max(ir.callPanels, 1))),
      sum: fmt(ir.installPanels),
    });
  }
  if (ir.installSwitches > 0) {
    const totalSwitches = ir.switches4port + ir.managedSwitches;
    installRows.push({
      num: String(n++),
      name: 'Монтаж коммутаторов',
      qty: String(totalSwitches),
      unitPrice: fmt(Math.round(ir.installSwitches / Math.max(totalSwitches, 1))),
      sum: fmt(ir.installSwitches),
    });
  }

  if (installRows.length > 0) {
    drawGroupTitle(w, 'Монтажные работы');
    drawEquipTable(w, installRows);
    drawSectionTotal(w, 'Итого монтаж', ir.totalInstall);
    w.y += 3;
  }

  // ПНР
  if (ir.totalComm > 0) {
    drawGroupTitle(w, 'Пусконаладочные работы (ПНР)');
    const pnrRows: TableRow[] = [{
      num: '1',
      name: 'ПНР домофонной системы',
      qty: '1',
      unitPrice: fmt(ir.totalComm),
      sum: fmt(ir.totalComm),
    }];
    drawEquipTable(w, pnrRows);
    drawSectionTotal(w, 'Итого ПНР', ir.totalComm);
    w.y += 3;
  }

  drawHighlightTotal(w, 'ИТОГО домофония:', ir.grandTotal);
  w.y += 4;
}

// ── Сводный итог ─────────────────────────────────────────────────────────────

function drawSummary(w: PDFWriter, cctvTotal: number, intercomTotal: number | null, grandTotal: number): void {
  drawSectionHeading(w, 'Сводный итог');
  w.y += 3;

  const summaryRows: Array<{ label: string; value: number; highlight?: boolean }> = [];
  if (cctvTotal > 0) summaryRows.push({ label: 'Видеонаблюдение', value: cctvTotal });
  if (intercomTotal != null && intercomTotal > 0) summaryRows.push({ label: 'Домофония', value: intercomTotal });

  const ROW_H = 8;
  for (const row of summaryRows) {
    w.checkPage(ROW_H + 2);
    w.fillRect(ML, w.y - 4, CW, ROW_H, ROW_TOTAL_RGB);
    w.setFont(false, 10);
    w.setColor(hexToRgb(PRIMARY));
    w.text(row.label, ML + 3, w.y + 0.8);
    w.setFont(true, 10);
    w.text(fmt(row.value), ML + CW - 1, w.y + 0.8, 'right');
    w.strokeRect(ML, w.y - 4, CW, ROW_H, [200, 200, 200]);
    w.y += ROW_H + 1;
  }

  // Grand total
  w.checkPage(12);
  w.fillRect(ML, w.y - 4, CW, 11, DARK_BG_RGB);
  w.setFont(true, 13);
  w.setColor(WHITE_RGB);
  w.text('ИТОГО:', ML + 3, w.y + 1.5);
  w.text(fmt(grandTotal), ML + CW - 1, w.y + 1.5, 'right');
  w.y += 13;
}

// ── Условия ───────────────────────────────────────────────────────────────────

function drawConditions(w: PDFWriter): void {
  w.y += 4;
  w.checkPage(30);

  w.setFont(true, 10);
  w.setColor(hexToRgb(PRIMARY));
  w.text('Условия коммерческого предложения:', ML, w.y);
  w.y += 6;

  const conditions = [
    'Оплата: по договору',
    'Гарантия: 36 месяцев на оборудование и монтаж',
    'Срок поставки: 5–14 рабочих дней',
    'Срок действия КП: 3 календарных дня',
  ];

  w.setFont(false, 9);
  w.setColor([50, 50, 50]);
  for (const cond of conditions) {
    w.checkPage(6);
    w.text('—  ' + cond, ML + 4, w.y);
    w.y += 5.5;
  }
  w.y += 4;
}

// ── Подпись ───────────────────────────────────────────────────────────────────

async function drawSignatureBlock(w: PDFWriter, stamp: ImgData): Promise<void> {
  w.checkPage(50);
  w.y += 4;

  const leftX = ML;
  const rightX = ML + CW / 2 + 10;

  w.setFont(false, 10);
  w.setColor([50, 50, 50]);
  w.text('Директор ТОО «G&R Group»', leftX, w.y);
  w.y += 7;
  w.text('________________________', leftX, w.y);
  w.y += 6;
  w.setFont(true, 10);
  w.text('А.А. Абоимов', leftX, w.y);

  const stampY = w.y - 18;
  if (stamp) {
    try {
      w.pdf.addImage(stamp.data, stamp.format, rightX, stampY, stamp.mmW, stamp.mmH);
    } catch { /* skip */ }
  }

  w.setFont(false, 9);
  w.setColor([100, 100, 100]);
  const mpX = rightX + (stamp ? stamp.mmW / 2 : 15);
  w.text('М.П.', mpX, stampY + (stamp ? stamp.mmH + 4 : 44), 'center');
  w.y += 10;
}

// ── Нижние колонтитулы ────────────────────────────────────────────────────────

function drawFooters(pdf: jsPDF): void {
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFont('Roboto', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(150, 150, 150);
    const footerY = PAGE_H - 8;
    pdf.text(
      `G&R Group | grgroup.kz | +7 771 421 55 93`,
      ML,
      footerY
    );
    pdf.text(
      `Стр. ${i} из ${total}`,
      PAGE_W - MR,
      footerY,
      { align: 'right' }
    );
    // Footer line
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(ML, footerY - 2, PAGE_W - MR, footerY - 2);
  }
}

// ── Главная функция ───────────────────────────────────────────────────────────

export async function downloadKPFullPDF(
  cctvResult: CalculatorResult | null,
  intercomResult: IntercomResult | null,
  opts: { apartments?: number; installmentMonths?: number; downPayment?: number }
): Promise<void> {
  void opts;

  // Fetch and compress images
  let logo: ImgData = null;
  let stamp: ImgData = null;

  try {
    const [logoRes, stampRes] = await Promise.all([
      fetch('/GR.png'),
      fetch('/pechat.png'),
    ]);
    if (logoRes.ok) {
      const buf = await logoRes.arrayBuffer();
      logo = await scaleImage(buf, 55, 20, '1B3A8C'); // синий фон шапки
    }
    if (stampRes.ok) {
      const buf = await stampRes.arrayBuffer();
      stamp = await scaleImage(buf, 30, 30, 'FFFFFF'); // белый фон под печать
    }
  } catch { /* use null */ }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  setupFonts(pdf);

  const w = new PDFWriter(pdf);

  // Header
  await drawHeader(w, logo, stamp);

  // KP title
  const now = new Date();
  const kpNum = kpNumber();
  drawKPTitle(w, kpNum, now);

  // Section I — CCTV
  if (cctvResult) {
    drawCCTVSection(w, cctvResult);
  }

  // Section II — Intercom
  if (intercomResult) {
    drawIntercomSection(w, intercomResult);
  }

  // Summary
  const cctvTotal = cctvResult?.grandTotal ?? 0;
  const intercomTotal = intercomResult?.grandTotal ?? null;
  const grandTotal = cctvTotal + (intercomTotal ?? 0);
  drawSummary(w, cctvTotal, intercomTotal, grandTotal);

  // Conditions
  drawConditions(w);

  // Signature
  await drawSignatureBlock(w, stamp);

  // Footers on every page
  drawFooters(pdf);

  // Download
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  pdf.save(`КП_Полное_${dateStr}_${grandTotal}тг.pdf`);
}

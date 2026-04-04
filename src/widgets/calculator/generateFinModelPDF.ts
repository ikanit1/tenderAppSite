/**
 * Генерация «Финансовая модель» (рассрочка) в формате PDF через jsPDF.
 * Структура по образцу КП_Фин условия_G&R_Group_.pdf:
 *  — Шапка с логотипом и контактами (белый фон, синяя нижняя граница)
 *  — Обращение к жителям
 *  — Состав и функционал проекта
 *  — Финансовые условия (общая сумма, первоначальный взнос, рассрочка, ежемесячно с квартиры)
 *  — Детализация по системам
 *  — Акцентный блок с выбранным сроком
 *  — Варианты рассрочки
 *  — Преимущества
 *  — Гарантии и сопровождение
 *  — Подпись и печать
 *  — Нижний колонтитул на каждой странице
 */
import jsPDF from 'jspdf';
import robotoBase64 from 'roboto-base64';
import type { CalculatorResult } from '@/widgets/calculator/calculatorLogic';
import type { IntercomResult } from '@/store/calculatorStore';
import type { ProjectInfo } from '@/widgets/calculator/generateKPFullPDF';

// ── Константы ────────────────────────────────────────────────────────────────

const PRIMARY_RGB: [number, number, number] = [26, 59, 110];
const DARK_BG_RGB: [number, number, number] = [26, 59, 110];
const HIGHLIGHT_RGB: [number, number, number] = [214, 228, 240];
const WHITE_RGB: [number, number, number] = [255, 255, 255];
const GRAY_RGB: [number, number, number] = [107, 114, 128];
const LIGHT_GRAY_RGB: [number, number, number] = [200, 200, 200];
const TEXT_RGB: [number, number, number] = [50, 50, 50];


const PAGE_W = 210;
const PAGE_H = 297;
const ML = 25;      // margin left
const MR = 15;      // margin right
const MT = 20;      // margin top
const MB = 20;      // margin bottom
const CW = PAGE_W - ML - MR;

// ── Утилиты ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('ru-KZ', {
    style: 'currency',
    currency: 'KZT',
    maximumFractionDigits: 0,
  }).format(n);
}

type ImgData = { data: string; format: 'JPEG'; mmW: number; mmH: number } | null;

async function scaleImage(
  buffer: ArrayBuffer,
  maxMmW: number,
  maxMmH: number,
  bgColor = 'FFFFFF'
): Promise<{ data: string; format: 'JPEG'; mmW: number; mmH: number }> {
  const DPI = 300;
  const PX_PER_MM = DPI / 25.4;
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer]);
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const aspect = img.naturalWidth / img.naturalHeight;
      let mmW = maxMmW;
      let mmH = maxMmW / aspect;
      if (mmH > maxMmH) { mmH = maxMmH; mmW = maxMmH * aspect; }
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

// ── Инициализация шрифтов ────────────────────────────────────────────────────

function setupFonts(pdf: jsPDF): void {
  pdf.addFileToVFS('Roboto-Regular.ttf', robotoBase64.normal);
  pdf.addFileToVFS('Roboto-Bold.ttf', robotoBase64.bold);
  pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  pdf.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
}

// ── Класс-помощник ───────────────────────────────────────────────────────────

class PDFWriter {
  pdf: jsPDF;
  y: number;

  constructor(pdf: jsPDF) {
    this.pdf = pdf;
    this.y = MT;
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

  line(x1: number, y1: number, x2: number, y2: number, rgb: [number, number, number], lw = 0.3): void {
    this.pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
    this.pdf.setLineWidth(lw);
    this.pdf.line(x1, y1, x2, y2);
  }

  text(str: string, x: number, y: number, align: 'left' | 'center' | 'right' = 'left', maxWidth?: number): void {
    const opts: Parameters<jsPDF['text']>[3] = { align };
    if (maxWidth != null) opts.maxWidth = maxWidth;
    this.pdf.text(str, x, y, opts);
  }

  wrappedText(
    str: string,
    x: number,
    maxWidth: number,
    lineH: number,
    bold: boolean,
    size: number,
    rgb: [number, number, number],
    align: 'left' | 'center' | 'right' = 'left'
  ): void {
    this.setFont(bold, size);
    this.setColor(rgb);
    const lines = this.pdf.splitTextToSize(str, maxWidth) as string[];
    for (const line of lines) {
      this.checkPage(lineH + 2);
      this.text(line, x, this.y, align);
      this.y += lineH;
    }
  }
}

// ── Шапка (белый фон, синяя нижняя граница) ───────────────────────────────────

async function drawHeader(w: PDFWriter, logo: ImgData): Promise<void> {
  const headerH = 26;

  // White background
  w.fillRect(0, 0, PAGE_W, headerH, WHITE_RGB);

  // Logo (left side)
  const logoX = ML;
  if (logo) {
    try {
      w.pdf.addImage(logo.data, logo.format, logoX, 3, logo.mmW, logo.mmH);
    } catch { /* skip */ }
  }

  // Company name under logo
  w.setFont(true, 9);
  w.setColor(PRIMARY_RGB);
  w.text('ТОО «G&R Group»', logoX, (logo?.mmH ?? 18) + 5);

  // Right contacts
  const rx = PAGE_W - MR;
  w.setFont(true, 10);
  w.setColor(PRIMARY_RGB);
  w.text('+7 771 421 55 93', rx, 8, 'right');

  w.setFont(false, 8);
  w.setColor(GRAY_RGB);
  w.text('info@grgroup.kz', rx, 13, 'right');
  w.text('www.grgroup.kz', rx, 17.5, 'right');
  w.text('г. Астана, Казахстан', rx, 22, 'right');

  // Blue bottom border
  w.line(ML, headerH, PAGE_W - MR, headerH, PRIMARY_RGB, 0.5);

  w.y = headerH + 7;
}

// ── Заголовок документа ───────────────────────────────────────────────────────

function drawTitle(w: PDFWriter): void {
  w.checkPage(14);
  w.setFont(true, 14);
  w.setColor(PRIMARY_RGB);
  w.text('Финансовая модель — Условия рассрочки', PAGE_W / 2, w.y, 'center');
  w.y += 9;
}

// ── Данные объекта ────────────────────────────────────────────────────────────

function drawProjectInfo(w: PDFWriter, info: ProjectInfo): void {
  w.checkPage(20);
  w.fillRect(ML, w.y - 2, CW, 18, [232, 240, 254]);
  w.setFont(false, 9);
  w.setColor(TEXT_RGB);
  w.text(`Объект:  ЖК «${info.complexName}»`, ML + 3, w.y + 2);
  w.y += 5.5;
  w.text(`Адрес:   ${info.address}`, ML + 3, w.y);
  w.y += 5.5;
  w.text(`Контакт: ${info.phone}`, ML + 3, w.y);
  w.y += 9;
}

// ── Заголовок секции ─────────────────────────────────────────────────────────

function drawSectionHeading(w: PDFWriter, title: string): void {
  w.checkPage(10);
  w.setFont(true, 11);
  w.setColor(PRIMARY_RGB);
  w.text(title, ML, w.y);
  w.y += 2;
  w.line(ML, w.y, ML + CW, w.y, PRIMARY_RGB, 0.4);
  w.y += 5;
}

// ── Вводный блок с обращением ────────────────────────────────────────────────

function drawIntroduction(w: PDFWriter): void {
  w.checkPage(12);
  w.setFont(true, 11);
  w.setColor(TEXT_RGB);
  w.text('Уважаемые жители!', PAGE_W / 2, w.y, 'center');
  w.y += 7;

  const para1 =
    'ТОО «G&R Group», являясь профессиональным интегратором систем безопасности и ' +
    'официальным дистрибьютором оборудования, предлагает реализацию проекта по ' +
    'комплексной модернизации системы видеонаблюдения и домофонии в вашем жилом доме.';

  w.wrappedText(para1, ML, CW, 5.5, false, 10, TEXT_RGB);
  w.y += 3;

  const para2 =
    'Цель проекта — создание современной, надёжной и масштабируемой системы ' +
    'безопасности, обеспечивающей полный контроль доступа, мониторинг территории и ' +
    'повышение уровня комфорта для всех жителей.';

  w.wrappedText(para2, ML, CW, 5.5, false, 10, TEXT_RGB);
  w.y += 5;
}

// ── Состав и функционал ────────────────────────────────────────────────────────

function drawFeatures(w: PDFWriter): void {
  drawSectionHeading(w, 'Состав и функционал проекта');

  w.checkPage(8);
  w.setFont(false, 10);
  w.setColor(TEXT_RGB);
  w.text('В рамках проекта предусмотрено:', ML, w.y);
  w.y += 5;

  const features = [
    'Модернизация системы видеонаблюдения с установкой высококачественных камер',
    'Полное обновление домофонной системы с расширенным функционалом',
    'Организация удалённого доступа через мобильные устройства (iOS / Android)',
    'Централизованное хранение и архивирование видеозаписей',
    'Обеспечение стабильной и бесперебойной работы оборудования',
    'Возможность дальнейшего масштабирования системы',
  ];

  for (const feat of features) {
    w.checkPage(7);
    w.setFont(false, 9);
    w.setColor(PRIMARY_RGB);
    w.text('—', ML + 2, w.y);
    w.setColor(TEXT_RGB);
    const lines = w.pdf.splitTextToSize(feat, CW - 8) as string[];
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) w.checkPage(5);
      w.text(lines[i], ML + 7, w.y);
      if (i < lines.length - 1) w.y += 4.5;
    }
    w.y += 5.5;
  }
  w.y += 3;
}

// ── Финансовые условия ────────────────────────────────────────────────────────

function drawFinancialConditions(
  w: PDFWriter,
  grandTotal: number,
  downPayment: number,
  installmentAmount: number,
  installmentMonths: number,
  monthlyPerFlat: number,
  cctvTotal: number,
  intercomTotal: number
): void {
  drawSectionHeading(w, 'Финансовые условия');

  // Grand total
  w.checkPage(16);
  w.setFont(false, 10);
  w.setColor(TEXT_RGB);
  w.text('Общая стоимость проекта:', ML, w.y);
  w.y += 6;
  w.setFont(true, 15);
  w.setColor(PRIMARY_RGB);
  w.text(fmt(grandTotal), ML, w.y);
  w.y += 8;

  // Conditions table
  const condRows: Array<[string, string]> = [
    ['Первоначальный взнос:', fmt(downPayment)],
    ['Сумма в рассрочку:', fmt(installmentAmount)],
    ['Срок рассрочки:', `${installmentMonths} месяцев`],
  ];

  const ROW_H = 7;
  for (const [label, value] of condRows) {
    w.checkPage(ROW_H + 2);
    w.setFont(false, 10);
    w.setColor(TEXT_RGB);
    w.text(label, ML + 3, w.y);
    w.setFont(true, 10);
    w.setColor(PRIMARY_RGB);
    w.text(value, ML + CW - 1, w.y, 'right');
    w.line(ML, w.y + 1.5, ML + CW, w.y + 1.5, LIGHT_GRAY_RGB, 0.15);
    w.y += ROW_H;
  }

  w.y += 3;

  // Monthly per flat — highlighted
  w.checkPage(14);
  w.fillRect(ML, w.y - 3, CW, 12, HIGHLIGHT_RGB);
  w.setFont(false, 10);
  w.setColor(TEXT_RGB);
  w.text('Ежемесячно с квартиры:', ML + 3, w.y + 1.5);
  w.setFont(true, 14);
  w.setColor(PRIMARY_RGB);
  w.text(fmt(monthlyPerFlat), ML + CW - 1, w.y + 2, 'right');
  w.y += 14;
  w.y += 4;

  // Detail table (cctv + intercom) if both present
  if (cctvTotal > 0 || intercomTotal > 0) {
    const detailRows: Array<[string, number]> = [];
    if (cctvTotal > 0) detailRows.push(['Видеонаблюдение', cctvTotal]);
    if (intercomTotal > 0) detailRows.push(['Домофония', intercomTotal]);

    if (detailRows.length > 1) {
      const COL1 = CW * 0.55;
      const COL2 = CW - COL1;
      const DETAIL_ROW_H = 7;

      for (const [label, val] of detailRows) {
        w.checkPage(DETAIL_ROW_H + 2);
        w.strokeRect(ML, w.y - 3.5, COL1, DETAIL_ROW_H, LIGHT_GRAY_RGB);
        w.strokeRect(ML + COL1, w.y - 3.5, COL2, DETAIL_ROW_H, LIGHT_GRAY_RGB);
        w.setFont(false, 9);
        w.setColor(TEXT_RGB);
        w.text(label, ML + 2, w.y);
        w.setFont(true, 9);
        w.text(fmt(val), ML + CW - 1, w.y, 'right');
        w.y += DETAIL_ROW_H;
      }

      // ИТОГО row
      w.checkPage(DETAIL_ROW_H + 2);
      w.fillRect(ML, w.y - 3.5, CW, DETAIL_ROW_H, DARK_BG_RGB);
      w.setFont(true, 9);
      w.setColor(WHITE_RGB);
      w.text('ИТОГО', ML + 2, w.y);
      w.text(fmt(cctvTotal + intercomTotal), ML + CW - 1, w.y, 'right');
      w.y += DETAIL_ROW_H;
      w.y += 4;
    }
  }

  // Clarifying paragraph
  w.checkPage(12);
  const clarify =
    'Данный формат финансирования позволяет реализовать современную систему безопасности без ' +
    'значительной единовременной нагрузки на жителей.';
  w.wrappedText(clarify, ML, CW, 5.5, false, 9, GRAY_RGB);
  w.y += 4;
}

// ── Акцентный блок с выбранным сроком ────────────────────────────────────────

function drawAccentBlock(
  w: PDFWriter,
  installmentMonths: number,
  monthlyPerFlat: number,
  flats: number
): void {
  w.checkPage(22);
  const blockH = 20;
  w.fillRect(ML, w.y - 3, CW, blockH, DARK_BG_RGB);
  w.setFont(true, 13);
  w.setColor(WHITE_RGB);
  w.text(
    `ВЫБРАННЫЙ СРОК РАССРОЧКИ: ${installmentMonths} МЕСЯЦЕВ`,
    PAGE_W / 2,
    w.y + 3,
    'center'
  );
  w.setFont(true, 11);
  w.text(
    `${fmt(monthlyPerFlat)} в месяц с квартиры (${flats} кв.)`,
    PAGE_W / 2,
    w.y + 11,
    'center'
  );
  w.y += blockH + 5;
}

// ── Таблица вариантов рассрочки ───────────────────────────────────────────────

function drawInstallmentTable(
  w: PDFWriter,
  installmentAmount: number,
  installmentMonths: number,
  flats: number
): void {
  drawSectionHeading(w, 'Варианты рассрочки');

  const allMonths = [12, 24, 36, 48, 60];
  const variants = allMonths.map((m) => {
    const total = installmentAmount > 0 ? Math.round(installmentAmount / m) : 0;
    const perFlat = flats > 0 ? Math.round(total / flats) : 0;
    return { months: m, total, perFlat, isSelected: m === installmentMonths };
  });

  const COL_WIDTHS = [CW * 0.2, CW * 0.4, CW * 0.4];
  const colX = [ML, ML + COL_WIDTHS[0], ML + COL_WIDTHS[0] + COL_WIDTHS[1]];
  const HEADER_H = 8;
  const ROW_H = 7;

  // Header
  w.checkPage(HEADER_H + 2);
  w.fillRect(ML, w.y - 3.5, CW, HEADER_H, DARK_BG_RGB);
  const headers = ['Срок', 'Ежемесячно (итого)', `С квартиры (${flats} кв.)`];
  w.setFont(true, 8.5);
  w.setColor(WHITE_RGB);
  for (let i = 0; i < headers.length; i++) {
    const cx = colX[i] + COL_WIDTHS[i] / 2;
    w.text(headers[i], cx, w.y, 'center');
  }
  w.y += HEADER_H;

  for (const v of variants) {
    w.checkPage(ROW_H + 2);
    const bg = v.isSelected ? HIGHLIGHT_RGB : WHITE_RGB;
    w.fillRect(ML, w.y - 3.5, CW, ROW_H, bg);
    w.strokeRect(ML, w.y - 3.5, CW, ROW_H, LIGHT_GRAY_RGB);

    const textColor: [number, number, number] = v.isSelected ? PRIMARY_RGB : TEXT_RGB;
    w.setFont(v.isSelected, v.isSelected ? 9 : 8.5);
    w.setColor(textColor);

    // Column borders
    for (let i = 0; i < 3; i++) {
      w.pdf.setDrawColor(LIGHT_GRAY_RGB[0], LIGHT_GRAY_RGB[1], LIGHT_GRAY_RGB[2]);
      w.pdf.setLineWidth(0.15);
      w.pdf.line(colX[i], w.y - 3.5, colX[i], w.y + ROW_H - 3.5);
    }

    const monthLabel = `${v.months} мес.${v.isSelected ? ' ✓' : ''}`;
    w.text(monthLabel, colX[0] + COL_WIDTHS[0] / 2, w.y, 'center');
    w.text(fmt(v.total), colX[1] + COL_WIDTHS[1] - 1, w.y, 'right');
    w.text(fmt(v.perFlat), colX[2] + COL_WIDTHS[2] - 1, w.y, 'right');
    w.y += ROW_H;
  }
  w.y += 5;
}

// ── Преимущества ─────────────────────────────────────────────────────────────

function drawAdvantages(w: PDFWriter): void {
  drawSectionHeading(w, 'Преимущества');

  const advantages = [
    'Существенное повышение уровня безопасности двора и подъездов',
    'Контроль входа и предотвращение несанкционированного доступа',
    'Онлайн-доступ к камерам в режиме реального времени',
    'Повышение инвестиционной привлекательности недвижимости',
    'Надёжная и проверенная инфраструктура',
    'Поддержка и сервисное сопровождение',
  ];

  for (const adv of advantages) {
    w.checkPage(7);
    w.setFont(true, 9);
    w.setColor(PRIMARY_RGB);
    w.text('—', ML + 2, w.y);
    w.setFont(false, 9);
    w.setColor(TEXT_RGB);
    const lines = w.pdf.splitTextToSize(adv, CW - 8) as string[];
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) w.checkPage(5);
      w.text(lines[i], ML + 7, w.y);
      if (i < lines.length - 1) w.y += 4.5;
    }
    w.y += 5.5;
  }
  w.y += 3;
}

// ── Гарантии ─────────────────────────────────────────────────────────────────

function drawGuarantees(w: PDFWriter): void {
  drawSectionHeading(w, 'Гарантии и сопровождение');

  w.checkPage(8);
  w.setFont(false, 10);
  w.setColor(TEXT_RGB);
  w.text('Компания ТОО «G&R Group» обеспечивает:', ML, w.y);
  w.y += 6;

  const guarantees = [
    'Гарантию на оборудование и выполненные работы — 36 месяцев',
    'Профессиональный монтаж и настройку',
    'Техническую поддержку и сервисное обслуживание',
    'Оперативное реагирование на обращения',
  ];

  for (const g of guarantees) {
    w.checkPage(7);
    w.setFont(false, 9);
    w.setColor(PRIMARY_RGB);
    w.text('—', ML + 2, w.y);
    w.setColor(TEXT_RGB);
    const lines = w.pdf.splitTextToSize(g, CW - 8) as string[];
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) w.checkPage(5);
      w.text(lines[i], ML + 7, w.y);
      if (i < lines.length - 1) w.y += 4.5;
    }
    w.y += 5.5;
  }
  w.y += 3;

  w.checkPage(10);
  const closing =
    'Мы готовы подробно презентовать проект, ответить на все вопросы и адаптировать ' +
    'решение с учётом особенностей вашего дома.';
  w.wrappedText(closing, ML, CW, 5.5, false, 9, TEXT_RGB);
  w.y += 4;
}

// ── Подпись ───────────────────────────────────────────────────────────────────

async function drawSignatureBlock(w: PDFWriter, stamp: ImgData): Promise<void> {
  w.checkPage(50);
  w.y += 4;

  w.setFont(false, 10);
  w.setColor(TEXT_RGB);
  w.text('С уважением,', ML, w.y);
  w.y += 5;
  w.setFont(true, 10);
  w.setColor(PRIMARY_RGB);
  w.text('ТОО «G&R Group»', ML, w.y);
  w.y += 8;

  const leftX = ML;
  const rightX = ML + CW / 2 + 10;

  w.setFont(false, 10);
  w.setColor(TEXT_RGB);
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
    pdf.text('G&R Group | grgroup.kz | +7 771 421 55 93', ML, footerY);
    pdf.text(`Стр. ${i} из ${total}`, PAGE_W - MR, footerY, { align: 'right' });
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(ML, footerY - 2, PAGE_W - MR, footerY - 2);
  }
}

// ── Главная функция ───────────────────────────────────────────────────────────

export async function generateFinModelPDF(
  cctvResult: CalculatorResult | null,
  intercomResult: IntercomResult | null,
  opts: { apartments?: number; downPayment?: number; installmentMonths?: number },
  projectInfo: ProjectInfo = { complexName: '', address: '', phone: '' }
): Promise<{ blob: Blob; filename: string }> {
  const { apartments = 0, downPayment = 0, installmentMonths = 60 } = opts;

  const cctvTotal = cctvResult?.grandTotal ?? 0;
  const intercomTotal = intercomResult?.grandTotal ?? 0;
  const grandTotal = cctvTotal + intercomTotal;
  const installmentAmount = Math.max(grandTotal - downPayment, 0);
  const flats = apartments > 0 ? apartments : 200;
  const monthlyTotal = installmentMonths > 0 ? Math.round(installmentAmount / installmentMonths) : 0;
  const monthlyPerFlat = flats > 0 ? Math.round(monthlyTotal / flats) : 0;

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
      logo = await scaleImage(buf, 50, 18, 'FFFFFF'); // белый фон шапки
    }
    if (stampRes.ok) {
      const buf = await stampRes.arrayBuffer();
      stamp = await scaleImage(buf, 30, 30, 'FFFFFF'); // белый фон под печать
    }
  } catch { /* use null */ }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  setupFonts(pdf);

  const w = new PDFWriter(pdf);

  // 1. Header
  await drawHeader(w, logo);

  // 2. Title
  drawTitle(w);

  // 2b. Project info block
  if (projectInfo.complexName || projectInfo.address || projectInfo.phone) {
    drawProjectInfo(w, projectInfo);
  }

  // 3. Introduction
  drawIntroduction(w);

  // 4. Features
  drawFeatures(w);

  // 5. Financial conditions
  drawFinancialConditions(
    w,
    grandTotal,
    downPayment,
    installmentAmount,
    installmentMonths,
    monthlyPerFlat,
    cctvTotal,
    intercomTotal
  );

  // 6. Accent block
  drawAccentBlock(w, installmentMonths, monthlyPerFlat, flats);

  // 7. Installment table
  drawInstallmentTable(w, installmentAmount, installmentMonths, flats);

  // 8. Advantages
  drawAdvantages(w);

  // 9. Guarantees
  drawGuarantees(w);

  // 10. Signature
  await drawSignatureBlock(w, stamp);

  // 11. Footers
  drawFooters(pdf);

  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const filename = `Финансовая_модель_${dateStr}_${grandTotal}тг.pdf`;
  const blob = pdf.output('blob');
  return { blob, filename };
}

/**
 * Генерация «КП Полное» в формате .docx.
 * Включает:
 *  — Все позиции оборудования (видеонаблюдение + домофония)
 *  — Полный блок итогов (оборудование, монтаж, ПНР, НДС)
 *  — Финансовые условия (рассрочка, ежемесячно с квартиры)
 *  — Условия, гарантии, подпись
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  BorderStyle,
  WidthType,
  AlignmentType,
  Footer,
  PageNumber,
  NumberFormat,
  type File,
} from 'docx';
import type { CalculatorResult, LineItem } from '@/widgets/calculator/calculatorLogic';
import type { IntercomResult } from '@/store/calculatorStore';

const FONT = 'Arial';
const SIZE_11 = 22;
const SIZE_12 = 24;
const SIZE_14 = 28;
const SIZE_20 = 40;

const COLORS = {
  primary: '1B3A8C',
  primaryLight: '2B4DA8',
  primaryBg: 'E8F0FE',
  rowAlt: 'F8F9FA',
  rowTotal: 'EEF2FF',
  accent: 'FFFFFF',
  textMuted: '6B7280',
} as const;

const LOGO_MAX_WIDTH = 160;
const LOGO_MAX_HEIGHT = 64;
const STAMP_MAX_SIZE = 160;
const SIGNATURE_MAX_WIDTH = 200;
const SIGNATURE_MAX_HEIGHT = 80;

const SECTION_COL_WIDTHS = [500, 2800, 1300, 600, 500, 1200, 1360];

function fmt(n: number): string {
  return new Intl.NumberFormat('ru-KZ', {
    style: 'currency',
    currency: 'KZT',
    maximumFractionDigits: 0,
  }).format(n);
}

function stripParentheses(name: string): string {
  return name.replace(/\s*\([^)]*\)/g, '').trim().replace(/\s{2,}/g, ' ');
}

function extractModel(name: string): string {
  const m = name.match(/\b([A-Z]{2,4}[-][A-Z0-9-]+(?:\s*\([^)]*\))?|[A-Z]{2,}\s*\d+[A-Z]*)/i);
  return m ? m[1].replace(/\s*\([^)]*\)$/, '').trim() : '—';
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

function validUntil(d: Date): string {
  const next = new Date(d);
  next.setDate(next.getDate() + 3);
  return next.toLocaleDateString('ru-RU');
}

function p(
  text: string,
  opts: {
    bold?: boolean;
    size?: number;
    color?: string;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spacingBefore?: number;
    spacingAfter?: number;
    shadingFill?: string;
    indent?: number;
  } = {}
): Paragraph {
  return new Paragraph({
    alignment: opts.alignment,
    shading: opts.shadingFill ? { fill: opts.shadingFill } : undefined,
    indent: opts.indent != null ? { left: opts.indent } : undefined,
    spacing: {
      ...(opts.spacingBefore != null && { before: opts.spacingBefore }),
      ...(opts.spacingAfter != null && { after: opts.spacingAfter }),
    },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: opts.size ?? SIZE_11,
        bold: opts.bold,
        color: opts.color,
      }),
    ],
  });
}

function sectionHeader(text: string): Paragraph {
  return new Paragraph({
    shading: { fill: COLORS.primaryBg },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: COLORS.primaryLight } },
    spacing: { before: 280, after: 100 },
    indent: { left: 200 },
    children: [
      new TextRun({
        text,
        bold: true,
        color: COLORS.primaryLight,
        size: SIZE_12,
        font: FONT,
      }),
    ],
  });
}

function equipmentTable(rows: LineItem[], sectionIndex: number): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: ['№', 'Наименование', 'Модель', 'Кол-во', 'Ед.', 'Цена ₸', 'Сумма ₸'].map((txt) =>
      new TableCell({
        shading: { fill: COLORS.primary },
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: txt, bold: true, color: COLORS.accent, size: 18, font: FONT })],
          }),
        ],
      })
    ),
  });

  const dataRows = rows.map((row: LineItem, i: number) => {
    const idx = sectionIndex * 100 + i + 1;
    const fill = i % 2 === 0 ? COLORS.accent : COLORS.rowAlt;
    return new TableRow({
      children: [
        new TableCell({ shading: { fill }, children: [new Paragraph({ children: [new TextRun({ text: String(idx), font: FONT, size: SIZE_11 })] })] }),
        new TableCell({ shading: { fill }, children: [new Paragraph({ children: [new TextRun({ text: stripParentheses(row.name), font: FONT, size: SIZE_11 })] })] }),
        new TableCell({ shading: { fill }, children: [new Paragraph({ children: [new TextRun({ text: extractModel(stripParentheses(row.name)), font: FONT, size: SIZE_11 })] })] }),
        new TableCell({ shading: { fill }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: String(row.qty ?? '—'), font: FONT, size: SIZE_11 })] })] }),
        new TableCell({ shading: { fill }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'шт.', font: FONT, size: SIZE_11 })] })] }),
        new TableCell({ shading: { fill }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: row.unitPrice != null ? fmt(row.unitPrice) : '—', font: FONT, size: SIZE_11 })] })] }),
        new TableCell({ shading: { fill }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmt(row.sum), bold: true, font: FONT, size: SIZE_11 })] })] }),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: SECTION_COL_WIDTHS,
    rows: [headerRow, ...dataRows],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    },
  });
}

function subtotalRow(label: string, value: number): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: COLORS.rowTotal },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: `Итого: ${label}`, bold: true, color: COLORS.primaryLight, size: 20, font: FONT })],
              }),
            ],
          }),
          new TableCell({
            shading: { fill: COLORS.rowTotal },
            width: { size: 20, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: fmt(value), bold: true, color: COLORS.primaryLight, size: 20, font: FONT })],
              }),
            ],
          }),
        ],
      }),
    ],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
  });
}

// ── Интерком: синтетические LineItem ────────────────────────────────────────

function intercomLineItems(ir: IntercomResult): LineItem[] {
  const items: LineItem[] = [];
  if (ir.switches4port > 0) {
    items.push({ name: 'PoE-коммутатор 4-порт Wi-Tek WK-PS305', qty: ir.switches4port, unitPrice: Math.round(ir.costSwitches4port / ir.switches4port), sum: ir.costSwitches4port });
  }
  if (ir.managedSwitches > 0) {
    items.push({ name: 'Управляемый коммутатор DH-SG4010-2F', qty: ir.managedSwitches, unitPrice: Math.round(ir.costManagedSwitches / ir.managedSwitches), sum: ir.costManagedSwitches });
  }
  if (ir.callPanels > 0) {
    items.push({ name: 'Вызывная панель домофона', qty: ir.callPanels, unitPrice: Math.round(ir.costPanelEquip / ir.callPanels), sum: ir.costPanelEquip });
  }
  if (ir.utpMeters > 0) {
    items.push({ name: 'Кабель UTP Cat5e (м)', qty: ir.utpMeters, unitPrice: Math.round(ir.costUtp / ir.utpMeters), sum: ir.costUtp });
  }
  if (ir.costConsumables > 0) {
    items.push({ name: 'Расходные материалы', qty: 1, unitPrice: ir.costConsumables, sum: ir.costConsumables });
  }
  return items;
}

function intercomInstallLineItems(ir: IntercomResult): LineItem[] {
  const items: LineItem[] = [];
  if (ir.installUtp > 0) {
    items.push({ name: 'Монтаж кабеля UTP', qty: ir.utpMeters, unitPrice: Math.round(ir.installUtp / Math.max(ir.utpMeters, 1)), sum: ir.installUtp });
  }
  if (ir.installPanels > 0) {
    items.push({ name: 'Монтаж вызывных панелей', qty: ir.callPanels, unitPrice: Math.round(ir.installPanels / Math.max(ir.callPanels, 1)), sum: ir.installPanels });
  }
  if (ir.installSwitches > 0) {
    items.push({ name: 'Монтаж коммутаторов', qty: ir.switches4port + ir.managedSwitches, unitPrice: Math.round(ir.installSwitches / Math.max(ir.switches4port + ir.managedSwitches, 1)), sum: ir.installSwitches });
  }
  return items;
}

function intercomPNRLineItems(ir: IntercomResult): LineItem[] {
  const items: LineItem[] = [];
  if (ir.commFlats > 0) {
    items.push({ name: 'ПНР за квартиры', qty: ir.flatsCount, unitPrice: Math.round(ir.commFlats / Math.max(ir.flatsCount, 1)), sum: ir.commFlats });
  }
  if (ir.commPanels > 0) {
    items.push({ name: 'ПНР вызывных панелей', qty: ir.callPanels, unitPrice: Math.round(ir.commPanels / Math.max(ir.callPanels, 1)), sum: ir.commPanels });
  }
  return items;
}

// ── Интерфейс ────────────────────────────────────────────────────────────────

export interface KPFullOptions {
  apartments?: number;
  downPayment?: number;
  installmentMonths?: number;
}

export interface KPFullImageSizes {
  logo?: { width: number; height: number };
  stamp?: { width: number; height: number };
  signature?: { width: number; height: number };
}

function fitSize(imgW: number, imgH: number, maxW: number, maxH: number) {
  if (imgW <= 0 || imgH <= 0) return { width: maxW, height: maxH };
  const scale = Math.min(maxW / imgW, maxH / imgH, 1);
  return { width: Math.round(imgW * scale), height: Math.round(imgH * scale) };
}
function fitSquare(imgW: number, imgH: number, maxSize: number) {
  return fitSize(imgW, imgH, maxSize, maxSize);
}

// ── Построитель документа ───────────────────────────────────────────────────

export function buildKPFullDocument(
  cctvResult: CalculatorResult | null,
  intercomResult: IntercomResult | null,
  opts: KPFullOptions = {},
  logoData?: ArrayBuffer,
  stampData?: ArrayBuffer,
  _signatureData?: ArrayBuffer,
  imageSizes?: KPFullImageSizes
): File {
  void opts; // параметры рассрочки используются в generateFinModel

  const cctvTotal = cctvResult?.grandTotal ?? 0;
  const intercomTotal = intercomResult?.grandTotal ?? 0;
  const grandTotal = cctvTotal + intercomTotal;


  const now = new Date();
  const kpNum = kpNumber();

  const logoSize = imageSizes?.logo ?? { width: LOGO_MAX_WIDTH, height: LOGO_MAX_HEIGHT };
  const stampSize = imageSizes?.stamp ?? { width: STAMP_MAX_SIZE, height: STAMP_MAX_SIZE };

  const children: (Paragraph | Table)[] = [];

  // ── Синяя шапка: логотип слева, контакты справа ─────────────────────────
  const logoCell = new TableCell({
    shading: { fill: COLORS.primary },
    margins: { top: 320, bottom: 320, left: 400, right: 200 },
    width: { size: 30, type: WidthType.PERCENTAGE },
    children: [
      ...(logoData && logoData.byteLength > 0
        ? (() => {
            try {
              return [new Paragraph({ spacing: { after: 120 }, children: [new ImageRun({ type: 'png', data: logoData, transformation: { width: logoSize.width, height: logoSize.height } })] })];
            } catch { return []; }
          })()
        : []
      ),
      new Paragraph({ children: [new TextRun({ text: 'ТОО\u00A0«G&R\u00A0Group»', bold: true, color: COLORS.accent, size: SIZE_14, font: FONT })] }),
    ],
  });

  const contactsCell = new TableCell({
    shading: { fill: COLORS.primary },
    margins: { top: 320, bottom: 320, left: 200, right: 400 },
    width: { size: 70, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: '+7 771 421 55 93', bold: true, color: COLORS.accent, size: SIZE_12, font: FONT })] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'info@grgroup.kz', color: COLORS.accent, size: 20, font: FONT })] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'grgroup.kz', color: COLORS.accent, size: 20, font: FONT })] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'г. Астана, Казахстан', color: COLORS.accent, size: 20, font: FONT })] }),
    ],
  });

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
      rows: [new TableRow({ children: [logoCell, contactsCell] })],
    })
  );
  children.push(new Paragraph({ spacing: { after: 200 } }));

  // ── Заголовок КП ─────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: `КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ № ${kpNum}`, bold: true, size: SIZE_20, color: '111827', font: FONT })],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({ text: `от ${dateText(now)}`, size: SIZE_11, font: FONT }),
        new TextRun({ text: `\t\tДействительно до: ${validUntil(now)}`, size: SIZE_11, font: FONT }),
      ],
    })
  );
  children.push(new Paragraph({ spacing: { after: 200 } }));

  // Кому / Объект
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight },
        left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight },
        right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: 'F0F4FF' },
              margins: { top: 150, bottom: 150, left: 200, right: 200 },
              children: [
                p('Кому:   _______________________________________', { spacingAfter: 80 }),
                p('Объект: _______________________________________', { spacingAfter: 0 }),
              ],
            }),
          ],
        }),
      ],
    })
  );
  children.push(new Paragraph({ spacing: { after: 300 } }));

  let sectionIndex = 0;

  // ════════════════════════════════════════════════════════════════════════════
  // БЛОК 1: ВИДЕОНАБЛЮДЕНИЕ
  // ════════════════════════════════════════════════════════════════════════════
  if (cctvResult && cctvResult.groups.length > 0) {
    children.push(
      new Paragraph({
        shading: { fill: COLORS.primary },
        spacing: { before: 200, after: 120 },
        indent: { left: 200 },
        children: [new TextRun({ text: 'РАЗДЕЛ I. ВИДЕОНАБЛЮДЕНИЕ', bold: true, color: COLORS.accent, size: SIZE_12, font: FONT })],
      })
    );

    for (const group of cctvResult.groups) {
      if (!group.rows.length) continue;
      sectionIndex += 1;
      children.push(sectionHeader(`${sectionIndex}. ${group.title}`));
      children.push(equipmentTable(group.rows, sectionIndex));
      children.push(subtotalRow(group.title, group.subtotal));
      children.push(new Paragraph({ spacing: { after: 160 } }));
    }

    // Предупреждения
    if (cctvResult.warnings.length > 0) {
      children.push(p('Технические примечания', { bold: true, size: SIZE_12, color: COLORS.primaryLight, spacingAfter: 80 }));
      for (const w of cctvResult.warnings) {
        children.push(p('• ' + w, { spacingAfter: 40 }));
      }
      children.push(new Paragraph({ spacing: { after: 160 } }));
    }

    // Итого CCTV
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({ columnSpan: 2, shading: { fill: COLORS.primary }, margins: { top: 100, bottom: 100, left: 150, right: 150 }, children: [p('ИТОГИ: ВИДЕОНАБЛЮДЕНИЕ', { bold: true, color: COLORS.accent, size: SIZE_12 })] }),
            ],
          }),
          ...[
            ['Оборудование', cctvResult.equipment],
            ['Расходные материалы', cctvResult.consumables ?? 0],
            ['Монтажные работы', cctvResult.installation?.cameraInstall ?? 0],
            ['Монтаж кабеля', cctvResult.installation?.cableInstall ?? 0],
          ].map(([label, val]) =>
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(label), font: FONT, size: SIZE_11 })] })] }),
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmt(Number(val)), font: FONT, size: SIZE_11 })] })] }),
              ],
            })
          ),
          new TableRow({
            children: [
              new TableCell({ shading: { fill: COLORS.primary }, margins: { top: 100, bottom: 100, left: 150, right: 150 }, children: [p('ИТОГО', { bold: true, color: COLORS.accent, size: SIZE_14 })] }),
              new TableCell({ shading: { fill: COLORS.primary }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmt(cctvTotal), bold: true, color: COLORS.accent, size: SIZE_14, font: FONT })] })] }),
            ],
          }),
        ],
        borders: { top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight }, bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight }, left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight }, right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight } },
      })
    );
    children.push(new Paragraph({ spacing: { after: 300 } }));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // БЛОК 2: ДОМОФОНИЯ
  // ════════════════════════════════════════════════════════════════════════════
  if (intercomResult && intercomResult.grandTotal > 0) {
    children.push(
      new Paragraph({
        shading: { fill: COLORS.primary },
        spacing: { before: 200, after: 120 },
        indent: { left: 200 },
        children: [new TextRun({ text: 'РАЗДЕЛ II. ДОМОФОНИЯ', bold: true, color: COLORS.accent, size: SIZE_12, font: FONT })],
      })
    );

    // Оборудование
    sectionIndex += 1;
    const intercomEquip = intercomLineItems(intercomResult);
    if (intercomEquip.length > 0) {
      const equipSubtotal = intercomResult.costSwitches4port + intercomResult.costPanelEquip + intercomResult.costManagedSwitches + intercomResult.costUtp + intercomResult.costConsumables;
      children.push(sectionHeader(`${sectionIndex}. Оборудование домофонии`));
      children.push(equipmentTable(intercomEquip, sectionIndex));
      children.push(subtotalRow('Оборудование домофонии', equipSubtotal));
      children.push(new Paragraph({ spacing: { after: 160 } }));
    }

    // Монтаж
    sectionIndex += 1;
    const intercomInstall = intercomInstallLineItems(intercomResult);
    if (intercomInstall.length > 0) {
      children.push(sectionHeader(`${sectionIndex}. Монтажные работы (домофония)`));
      children.push(equipmentTable(intercomInstall, sectionIndex));
      children.push(subtotalRow('Монтажные работы', intercomResult.totalInstall));
      children.push(new Paragraph({ spacing: { after: 160 } }));
    }

    // ПНР
    sectionIndex += 1;
    const intercomPNR = intercomPNRLineItems(intercomResult);
    if (intercomPNR.length > 0) {
      children.push(sectionHeader(`${sectionIndex}. Пусконаладочные работы (домофония)`));
      children.push(equipmentTable(intercomPNR, sectionIndex));
      children.push(subtotalRow('Пусконаладочные работы', intercomResult.totalComm));
      children.push(new Paragraph({ spacing: { after: 160 } }));
    }

    // Итого домофония
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({ columnSpan: 2, shading: { fill: COLORS.primary }, margins: { top: 100, bottom: 100, left: 150, right: 150 }, children: [p('ИТОГИ: ДОМОФОНИЯ', { bold: true, color: COLORS.accent, size: SIZE_12 })] }),
            ],
          }),
          ...[
            ['Оборудование', intercomResult.costSwitches4port + intercomResult.costPanelEquip + intercomResult.costManagedSwitches + intercomResult.costUtp],
            ['Расходные материалы', intercomResult.costConsumables],
            ['Монтажные работы', intercomResult.totalInstall],
            ['Пусконаладочные работы', intercomResult.totalComm],
          ].map(([label, val]) =>
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(label), font: FONT, size: SIZE_11 })] })] }),
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmt(Number(val)), font: FONT, size: SIZE_11 })] })] }),
              ],
            })
          ),
          new TableRow({
            children: [
              new TableCell({ shading: { fill: COLORS.primary }, margins: { top: 100, bottom: 100, left: 150, right: 150 }, children: [p('ИТОГО', { bold: true, color: COLORS.accent, size: SIZE_14 })] }),
              new TableCell({ shading: { fill: COLORS.primary }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmt(intercomTotal), bold: true, color: COLORS.accent, size: SIZE_14, font: FONT })] })] }),
            ],
          }),
        ],
        borders: { top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight }, bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight }, left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight }, right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight } },
      })
    );
    children.push(new Paragraph({ spacing: { after: 300 } }));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // СВОДНЫЙ ИТОГ
  // ════════════════════════════════════════════════════════════════════════════
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ columnSpan: 2, shading: { fill: COLORS.primary }, margins: { top: 120, bottom: 120, left: 150, right: 150 }, children: [new Paragraph({ children: [new TextRun({ text: 'СВОДНЫЙ ИТОГ ПО ПРОЕКТУ', bold: true, color: COLORS.accent, size: SIZE_14, font: FONT })] })] }),
          ],
        }),
        ...[
          ...(cctvResult ? [['Видеонаблюдение', cctvTotal]] : []),
          ...(intercomResult && intercomTotal > 0 ? [['Домофония', intercomTotal]] : []),
        ].map(([label, val]) =>
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(label), font: FONT, size: SIZE_11 })] })] }),
              new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmt(Number(val)), font: FONT, size: SIZE_11 })] })] }),
            ],
          })
        ),
        new TableRow({
          children: [
            new TableCell({ shading: { fill: COLORS.primary }, margins: { top: 120, bottom: 120, left: 150, right: 150 }, children: [new Paragraph({ children: [new TextRun({ text: 'ИТОГО', bold: true, color: COLORS.accent, size: SIZE_20, font: FONT })] })] }),
            new TableCell({ shading: { fill: COLORS.primary }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmt(grandTotal), bold: true, color: COLORS.accent, size: SIZE_20, font: FONT })] })] }),
          ],
        }),
      ],
      borders: { top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight }, bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight }, left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight }, right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight } },
    })
  );
  children.push(new Paragraph({ spacing: { after: 300 } }));

  // ── Условия ───────────────────────────────────────────────────────────────
  children.push(p('Условия', { bold: true, size: SIZE_12, color: COLORS.primaryLight, spacingAfter: 100 }));
  [
    'Гарантия: 36 месяцев на оборудование и монтаж',
    'Срок поставки: 5–14 рабочих дней',
    'Срок действия КП: 3 календарных дня',
  ].forEach((t) => children.push(p('• ' + t, { spacingAfter: 60 })));
  children.push(new Paragraph({ spacing: { after: 200 } }));

  // ── Подпись ───────────────────────────────────────────────────────────────
  // Левая ячейка: текст. Правая ячейка: печать рядом с М.П.
  const stampChildren: Paragraph[] = [];
  if (stampData?.byteLength) {
    try {
      stampChildren.push(new Paragraph({
        spacing: { after: 40 },
        children: [new ImageRun({ type: 'png', data: stampData, transformation: { width: stampSize.width, height: stampSize.height } })],
      }));
    } catch { /* skip */ }
  }
  stampChildren.push(p('М.П.', { spacingAfter: 0 }));

  children.push(
    new Table({
      width: { size: 80, type: WidthType.PERCENTAGE },
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 55, type: WidthType.PERCENTAGE },
              children: [
                p('Директор ТОО «G&R Group»', { spacingAfter: 60 }),
                p('________________________', { spacingAfter: 40 }),
                p('А.А. Абоимов', { spacingAfter: 0 }),
              ],
            }),
            new TableCell({
              width: { size: 45, type: WidthType.PERCENTAGE },
              children: stampChildren,
            }),
          ],
        }),
      ],
    })
  );

  const doc: File = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: '25mm', right: '20mm', bottom: '20mm', left: '25mm' },
            pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
                spacing: { before: 100 },
                children: [
                  new TextRun({ text: 'G&R Group | grgroup.kz | +7 771 421 55 93   Стр. ', font: FONT, size: 16, color: '888888' }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: '888888' }),
                  new TextRun({ text: ' из ', font: FONT, size: 16, color: '888888' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: '888888' }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return doc as File;
}

// ── Утилиты ─────────────────────────────────────────────────────────────────

function getImageDimensions(data: ArrayBuffer): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

export async function downloadKPFull(
  cctvResult: CalculatorResult | null,
  intercomResult: IntercomResult | null,
  opts: KPFullOptions = {}
): Promise<void> {
  let logoData: ArrayBuffer | undefined;
  let stampData: ArrayBuffer | undefined;
  let signatureData: ArrayBuffer | undefined;
  try {
    const [logoRes, stampRes, signatureRes] = await Promise.all([
      fetch('/GR.png'),
      fetch('/pechat.png'),
      fetch('/podpish.png'),
    ]);
    if (logoRes.ok) logoData = await logoRes.arrayBuffer();
    if (stampRes.ok) stampData = await stampRes.arrayBuffer();
    if (signatureRes.ok) signatureData = await signatureRes.arrayBuffer();
  } catch { /* use defaults */ }

  const imageSizes: KPFullImageSizes = {};
  try {
    if (logoData?.byteLength) {
      const { width, height } = await getImageDimensions(logoData);
      imageSizes.logo = fitSize(width, height, LOGO_MAX_WIDTH, LOGO_MAX_HEIGHT);
    }
    if (stampData?.byteLength) {
      const { width, height } = await getImageDimensions(stampData);
      imageSizes.stamp = fitSquare(width, height, STAMP_MAX_SIZE);
    }
    if (signatureData?.byteLength) {
      const { width, height } = await getImageDimensions(signatureData);
      imageSizes.signature = fitSize(width, height, SIGNATURE_MAX_WIDTH, SIGNATURE_MAX_HEIGHT);
    }
  } catch { /* use defaults */ }

  const doc = buildKPFullDocument(cctvResult, intercomResult, opts, logoData, stampData, signatureData, imageSizes);
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const total = (cctvResult?.grandTotal ?? 0) + (intercomResult?.grandTotal ?? 0);
  a.download = `КП_Полное_${dateStr}_${total}тг.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

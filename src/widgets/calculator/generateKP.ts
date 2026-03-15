/**
 * Генерация Коммерческого Предложения (КП) в формате .docx по результату калькулятора.
 * Библиотека docx — создание документа, Packer.toBlob — скачивание в браузере.
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
  type File,
} from 'docx';
import type { CalculatorResult, LineItem } from '@/widgets/calculator/calculatorLogic';

const FONT = 'Times New Roman';
const SIZE_11 = 22; // half-points
const SIZE_12 = 24;
const SIZE_14 = 28;
const HEADER_COLOR = '#1A3B6E';
const TABLE_HEADER_BG = '#1A3B6E';
const TOTAL_ROW_BG = '#2C5282';
const ROW_ALT_BG = '#F7FAFC';
const ACCENT_BG = '#EDF2F7';

function formatKzt(n: number): string {
  return n.toLocaleString('ru-RU') + ' ₸';
}

/** Убрать все подписи в круглых скобках из названия */
function stripParentheses(name: string): string {
  return name.replace(/\s*\([^)]*\)/g, '').trim().replace(/\s{2,}/g, ' ');
}

/** Извлечь артикул/модель из названия позиции (примеры: IPC-2122, NVR308-64E, WK-PS227GF) */
function extractModel(name: string): string {
  const m = name.match(/\b([A-Z]{2,4}[-][A-Z0-9-]+(?:\s*\([^)]*\))?|[A-Z]{2,}\s*\d+[A-Z]*)/i);
  return m ? m[1].replace(/\s*\([^)]*\)$/, '').trim() : '—';
}

/** Номер КП: КП-YYYYMMDD-XXX */
function kpNumber(): string {
  const d = new Date();
  const ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const rnd = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `КП-${ymd}-${rnd}`;
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

/** Создать параграф с текстом (size в половинках пункта: 11pt = 22) */
function p(
  text: string,
  opts: {
    bold?: boolean;
    size?: number;
    color?: string;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spacingAfter?: number;
  } = {}
): Paragraph {
  return new Paragraph({
    alignment: opts.alignment,
    spacing: opts.spacingAfter != null ? { after: opts.spacingAfter } : undefined,
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

/** Ячейка таблицы */
function cell(content: string, opts: { bold?: boolean; shading?: string } = {}): TableCell {
  return new TableCell({
    shading: opts.shading ? { fill: opts.shading } : undefined,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: content,
            font: FONT,
            size: SIZE_11,
            bold: opts.bold,
            color: opts.shading === TABLE_HEADER_BG || opts.shading === TOTAL_ROW_BG ? 'FFFFFF' : undefined,
          }),
        ],
      }),
    ],
  });
}

/** Максимальные размеры в документе (пиксели для transformation). Пропорции сохраняются. */
const LOGO_MAX_WIDTH = 140;
const LOGO_MAX_HEIGHT = 56;
const SIGNATURE_MAX_WIDTH = 140;
const SIGNATURE_MAX_HEIGHT = 56;
const STAMP_MAX_SIZE = 90;

/** Вписать размеры в прямоугольник, сохраняя пропорции (без растягивания) */
function fitSize(imgW: number, imgH: number, maxW: number, maxH: number): { width: number; height: number } {
  if (imgW <= 0 || imgH <= 0) return { width: maxW, height: maxH };
  const scale = Math.min(maxW / imgW, maxH / imgH, 1);
  return { width: Math.round(imgW * scale), height: Math.round(imgH * scale) };
}

/** Вписать в квадрат */
function fitSquare(imgW: number, imgH: number, maxSize: number): { width: number; height: number } {
  return fitSize(imgW, imgH, maxSize, maxSize);
}

export interface KPImageSizes {
  logo?: { width: number; height: number };
  stamp?: { width: number; height: number };
  signature?: { width: number; height: number };
}

export function buildKPDocument(
  result: CalculatorResult,
  logoData?: ArrayBuffer,
  stampData?: ArrayBuffer,
  signatureData?: ArrayBuffer,
  imageSizes?: KPImageSizes
): File {
  const now = new Date();
  const kpNum = kpNumber();
  const children: (Paragraph | Table)[] = [];

  const logoSize = imageSizes?.logo ?? { width: LOGO_MAX_WIDTH, height: LOGO_MAX_HEIGHT };
  const stampSize = imageSizes?.stamp ?? { width: STAMP_MAX_SIZE, height: STAMP_MAX_SIZE };
  const signatureSize = imageSizes?.signature ?? { width: SIGNATURE_MAX_WIDTH, height: SIGNATURE_MAX_HEIGHT };

  // Шапка: логотип и контакты (без растягивания, пропорции как в образце)
  if (logoData && logoData.byteLength > 0) {
    try {
      children.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new ImageRun({
              type: 'png',
              data: logoData,
              transformation: { width: logoSize.width, height: logoSize.height },
            }),
          ],
        })
      );
    } catch {
      // ignore invalid image
    }
  }
  children.push(p('ТОО «G&R Group»', { bold: true, size: SIZE_12, spacingAfter: 60 }));
  children.push(p('+7 771 421 55 93', { spacingAfter: 40 }));
  children.push(p('info@grgroup.kz'));
  children.push(p('grgroup.kz'));
  children.push(p('г. Алматы, Казахстан', { spacingAfter: 200 }));

  // Блок КП: номер, дата, срок действия
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 2, color: HEADER_COLOR },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: HEADER_COLOR },
        left: { style: BorderStyle.SINGLE, size: 2, color: HEADER_COLOR },
        right: { style: BorderStyle.SINGLE, size: 2, color: HEADER_COLOR },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: ACCENT_BG },
              margins: { top: 180, bottom: 180, left: 200, right: 200 },
              children: [
                p('КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ № ' + kpNum, {
                  bold: true,
                  size: SIZE_14,
                  alignment: AlignmentType.CENTER,
                  color: HEADER_COLOR,
                }),
                new Paragraph({ spacing: { after: 80 } }),
                p('от ' + dateText(now), { alignment: AlignmentType.CENTER }),
                p('Действительно до: ' + validUntil(now), { alignment: AlignmentType.CENTER, spacingAfter: 0 }),
              ],
            }),
          ],
        }),
      ],
    })
  );
  children.push(new Paragraph({ spacing: { after: 200 } }));
  children.push(p('Кому: _______________________', { spacingAfter: 60 }));
  children.push(p('Объект: ______________________', { spacingAfter: 200 }));

  let globalIndex = 0;
  for (const group of result.groups) {
    if (!group.rows.length) continue;
    globalIndex += 1;
    children.push(p(`${globalIndex}. ${group.title}`, { bold: true, size: SIZE_12, color: HEADER_COLOR, spacingAfter: 120 }));
    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        cell('№', { bold: true, shading: TABLE_HEADER_BG }),
        cell('Наименование', { bold: true, shading: TABLE_HEADER_BG }),
        cell('Арт./Модель', { bold: true, shading: TABLE_HEADER_BG }),
        cell('Кол-во', { bold: true, shading: TABLE_HEADER_BG }),
        cell('Ед.', { bold: true, shading: TABLE_HEADER_BG }),
        cell('Цена за ед. ₸', { bold: true, shading: TABLE_HEADER_BG }),
        cell('Сумма ₸', { bold: true, shading: TABLE_HEADER_BG }),
      ],
    });
    const dataRows: TableRow[] = group.rows.map((row: LineItem, i: number) => {
      const idx = globalIndex * 100 + i + 1;
      const shading = i % 2 === 1 ? ROW_ALT_BG : undefined;
      return new TableRow({
        children: [
          cell(String(idx), { shading }),
          cell(stripParentheses(row.name), { shading }),
          cell(extractModel(stripParentheses(row.name)), { shading }),
          cell(String(row.qty ?? '—'), { shading }),
          cell('шт.', { shading }),
          cell(row.unitPrice != null ? formatKzt(row.unitPrice) : '—', { shading }),
          cell(formatKzt(row.sum), { shading }),
        ],
      });
    });
    const totalRow = new TableRow({
      children: [
        new TableCell({
          columnSpan: 6,
          shading: { fill: TOTAL_ROW_BG },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `Итого по разделу: ${formatKzt(group.subtotal)}`,
                  font: FONT,
                  size: SIZE_11,
                  bold: true,
                  color: 'FFFFFF',
                }),
              ],
            }),
          ],
        }),
        cell(formatKzt(group.subtotal), { bold: true, shading: TOTAL_ROW_BG }),
      ],
    });
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [headerRow, ...dataRows, totalRow],
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
          left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
          right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        },
      })
    );
    children.push(new Paragraph({ spacing: { after: 160 } }));
  }

  // Технические примечания (warnings)
  if (result.warnings.length > 0) {
    children.push(p('Технические примечания', { bold: true, size: SIZE_12, color: HEADER_COLOR, spacingAfter: 100 }));
    for (const w of result.warnings) {
      children.push(p('• ' + w));
    }
    children.push(new Paragraph({ children: [] }));
  }

  // Итоги
  const totalWithoutVat = result.grandTotal / 1.12;
  const vatAmount = result.grandTotal - totalWithoutVat;
  const inst = result.grandTotal > 0 ? [36, 48, 60].map((m) => ({ months: m, payment: Math.round(result.grandTotal / m) })) : [];

  children.push(p('Итоги по смете', { bold: true, size: SIZE_12, color: HEADER_COLOR, spacingAfter: 120 }));
  children.push(p('Оборудование: ' + formatKzt(result.equipment), { spacingAfter: 50 }));
  children.push(p('Расходные материалы: ' + formatKzt(result.consumables ?? 0), { spacingAfter: 50 }));
  children.push(p('Монтажные работы: ' + formatKzt(result.installation.work ?? result.installation.total), { spacingAfter: 50 }));
  children.push(p('Пусконаладочные работы: ' + formatKzt(result.installation.commissioning ?? 0), { spacingAfter: 50 }));
  children.push(p('Монтаж кабеля: ' + formatKzt(result.installation.cableInstall ?? 0), { spacingAfter: 80 }));
  children.push(p('ИТОГО БЕЗ НДС: ' + formatKzt(Math.round(totalWithoutVat)), { bold: true, spacingAfter: 50 }));
  children.push(p('НДС 12%: ' + formatKzt(Math.round(vatAmount)), { bold: true, spacingAfter: 50 }));
  children.push(p('ИТОГО С НДС: ' + formatKzt(result.grandTotal), { bold: true, size: SIZE_12, spacingAfter: 200 }));

  if (inst.length > 0) {
    children.push(p('Рассрочка (беспроцентная):', { bold: true, spacingAfter: 80 }));
    inst.forEach(({ months, payment }) => {
      children.push(p(`  ${months} мес. → ${formatKzt(payment)}/мес`, { spacingAfter: 40 }));
    });
    const perFlatMonthly = Math.round(result.grandTotal / 200);
    children.push(p(`Ежемесячная оплата с квартиры: ${formatKzt(perFlatMonthly)} (Итого/200)`, { spacingAfter: 40 }));
    children.push(new Paragraph({ spacing: { after: 160 } }));
  }

  children.push(p('Условия', { bold: true, size: SIZE_12, color: HEADER_COLOR, spacingAfter: 100 }));
  children.push(p('Гарантия: 36 месяцев на оборудование, 36 месяцев на монтаж.', { spacingAfter: 50 }));
  children.push(p('Срок поставки: 5–14 рабочих дней.', { spacingAfter: 50 }));
  children.push(p('Срок действия КП: 3 календарных дня.', { spacingAfter: 50 }));
  children.push(p('Оплата: 50% предоплата, 50% по факту готовности.', { spacingAfter: 200 }));
  children.push(p('Директор ТОО «G&R Group» _____________ А.А. Абоимов', { spacingAfter: 120 }));

  // Подпись и печать (если переданы изображения)
  if (signatureData?.byteLength || stampData?.byteLength) {
    const stampAndSignatureRows: TableRow[] = [];
    const cells: TableCell[] = [];
    if (signatureData?.byteLength) {
      try {
        cells.push(
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    type: 'png',
                    data: signatureData,
                    transformation: { width: signatureSize.width, height: signatureSize.height },
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [new TextRun({ text: 'Подпись', font: FONT, size: 20 })],
              }),
            ],
          })
        );
      } catch {
        // skip invalid image
      }
    }
    if (stampData?.byteLength) {
      try {
        cells.push(
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    type: 'png',
                    data: stampData,
                    transformation: { width: stampSize.width, height: stampSize.height },
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [new TextRun({ text: 'М.П.', font: FONT, size: SIZE_11 })],
              }),
            ],
          })
        );
      } catch {
        // skip invalid image
      }
    }
    if (cells.length > 0) {
      stampAndSignatureRows.push(new TableRow({ children: cells }));
      children.push(
        new Table({
          width: { size: 60, type: WidthType.PERCENTAGE },
          rows: stampAndSignatureRows,
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
        })
      );
    }
  } else {
    children.push(p('М.П.', { spacingAfter: 0 }));
  }

  const doc: File = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: '20mm',
              right: '15mm',
              bottom: '20mm',
              left: '30mm',
            },
          },
        },
        children,
      },
    ],
  });

  return doc as File;
}

/** Получить размеры изображения по данным (в браузере) для сохранения пропорций */
function getImageDimensions(data: ArrayBuffer): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
}

/** Скачать КП в браузере (изображения без растягивания, с сохранением пропорций) */
export async function downloadKP(result: CalculatorResult): Promise<void> {
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
  } catch {
    // use defaults
  }

  const imageSizes: KPImageSizes = {};
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
  } catch {
    // оставляем дефолтные размеры
  }

  const doc = buildKPDocument(result, logoData, stampData, signatureData, imageSizes);
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const d = new Date();
  const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  a.download = `КП_${dateStr}_${result.grandTotal}тг.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

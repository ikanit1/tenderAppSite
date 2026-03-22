/**
 * Экспорт сметы калькулятора в DOCX — коммерческое предложение с брендингом G&R Group.
 * Дизайн: синяя шапка, оформленные разделы, таблицы с чередованием строк, блок финансовых условий.
 */
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  AlignmentType,
  WidthType,
  BorderStyle,
  Footer,
  PageNumber,
  NumberFormat,
} from 'docx';
import type { CalculatorResult, LineItem } from '@/widgets/calculator/calculatorLogic';
import type { ExportMeta } from './exportPDF';

const FONT = 'Arial';

const COLORS = {
  primary: '1B3A8C',
  primaryLight: '2B4DA8',
  primaryBg: 'E8F0FE',
  rowAlt: 'F8F9FA',
  rowTotal: 'EEF2FF',
  accent: 'FFFFFF',
  textMain: '111827',
  textMuted: '6B7280',
  boxBg: 'F0F4FF',
} as const;

/** Колонки таблицы разделов (DXA). Сумма ~8260. */
const SECTION_TABLE_COLUMNS = [500, 2800, 1300, 600, 500, 1200, 1360];

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
  const rnd = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `КП-${ymd}-${rnd}`;
}

function dateText(d: Date): string {
  const months =
    'января февраля марта апреля мая июня июля августа сентября октября ноября декабря'.split(' ');
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
    font?: string;
  } = {}
): Paragraph {
  return new Paragraph({
    alignment: opts.alignment,
    spacing: {
      ...(opts.spacingBefore != null && { before: opts.spacingBefore }),
      ...(opts.spacingAfter != null && { after: opts.spacingAfter }),
    },
    children: [
      new TextRun({
        text,
        font: opts.font ?? FONT,
        size: opts.size ?? 22,
        bold: opts.bold,
        color: opts.color,
      }),
    ],
  });
}

export async function exportResultToDocx(
  result: CalculatorResult,
  meta: ExportMeta = {},
  filename = 'smeta-cctv.docx'
): Promise<void> {
  const now = new Date();
  const kpNum = kpNumber();
  const children: (Paragraph | Table)[] = [];

  // ─── СТРАНИЦА 1: СИНЯЯ ШАПКА ───
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: COLORS.primary },
              margins: { top: 400, bottom: 400, left: 400, right: 400 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'ТОО «G&R Group»', bold: true, color: COLORS.accent, size: 28, font: FONT }),
                    new TextRun({ text: '\t\t+7 771 421 55 93', color: COLORS.accent, size: 20, font: FONT }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: 'grgroup.kz', color: COLORS.accent, size: 18, font: FONT }),
                    new TextRun({ text: '\t\tinfo@grgroup.kz', color: COLORS.accent, size: 18, font: FONT }),
                  ],
                }),
                new Paragraph({
                  children: [new TextRun({ text: 'г. Алматы, Казахстан', color: COLORS.accent, size: 18, font: FONT })],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );
  children.push(new Paragraph({ spacing: { after: 200 } }));

  // КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ № КП-XXX
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ № ${kpNum}`,
          bold: true,
          size: 44,
          color: COLORS.textMain,
          font: FONT,
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({ text: `от «» ${dateText(now)}`, size: 22, font: FONT }),
        new TextRun({ text: '\t\tДействительно до: ', size: 22, font: FONT }),
        new TextRun({ text: validUntil(now), size: 22, font: FONT }),
      ],
    })
  );
  children.push(new Paragraph({ spacing: { after: 200 } }));

  // Кому / Объект (рамка с заливкой F0F4FF)
  const komuText = meta.clientName?.trim() ? `Кому:   ${meta.clientName}` : 'Кому:   _______________________________________';
  const objectText = meta.projectName?.trim() ? `Объект: ${meta.projectName}` : 'Объект: _______________________________________';
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
              shading: { fill: COLORS.boxBg },
              margins: { top: 150, bottom: 150, left: 200, right: 200 },
              children: [
                p(komuText, { spacingAfter: 80 }),
                p(objectText, { spacingAfter: 0 }),
              ],
            }),
          ],
        }),
      ],
    })
  );
  children.push(new Paragraph({ spacing: { after: 300 } }));

  // ─── РАЗДЕЛЫ С ТАБЛИЦАМИ ───
  let sectionIndex = 0;
  for (const group of result.groups) {
    if (!group.rows.length) continue;
    sectionIndex += 1;

    // Заголовок раздела (заливка E8F0FE, левый border синий)
    children.push(
      new Paragraph({
        shading: { fill: COLORS.primaryBg },
        border: { left: { style: BorderStyle.SINGLE, size: 24, color: COLORS.primaryLight } },
        spacing: { before: 300, after: 120 },
        indent: { left: 200 },
        children: [
          new TextRun({
            text: `${sectionIndex}. ${group.title}`,
            bold: true,
            color: COLORS.primaryLight,
            size: 24,
            font: FONT,
          }),
        ],
      })
    );

    // Шапка таблицы — тёмно-синяя, белый текст
    const headerRow = new TableRow({
      tableHeader: true,
      children: ['№', 'Наименование', 'Модель', 'Кол-во', 'Ед.', 'Цена ₸', 'Сумма ₸'].map((txt) =>
        new TableCell({
          shading: { fill: COLORS.primary },
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: txt, bold: true, color: COLORS.accent, size: 18, font: FONT }),
              ],
            }),
          ],
        })
      ),
    });

    const dataRows = group.rows.map((row: LineItem, i: number) => {
      const idx = sectionIndex * 100 + i + 1;
      const fill = i % 2 === 0 ? COLORS.accent : COLORS.rowAlt;
      return new TableRow({
        children: [
          new TableCell({
            shading: { fill },
            children: [new Paragraph({ children: [new TextRun({ text: String(idx), font: FONT, size: 22 })] })],
          }),
          new TableCell({
            shading: { fill },
            children: [new Paragraph({ children: [new TextRun({ text: stripParentheses(row.name), font: FONT, size: 22 })] })],
          }),
          new TableCell({
            shading: { fill },
            children: [new Paragraph({ children: [new TextRun({ text: extractModel(stripParentheses(row.name)), font: FONT, size: 22 })] })],
          }),
          new TableCell({
            shading: { fill },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: String(row.qty ?? '—'), font: FONT, size: 22 })] })],
          }),
          new TableCell({
            shading: { fill },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'шт.', font: FONT, size: 22 })] })],
          }),
          new TableCell({
            shading: { fill },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: row.unitPrice != null ? fmt(row.unitPrice) : '—', font: FONT, size: 22 })] })],
          }),
          new TableCell({
            shading: { fill },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmt(row.sum), bold: true, font: FONT, size: 22 })] })],
          }),
        ],
      });
    });

    // Строка итога раздела
    const subtotalRow = new TableRow({
      children: [
        new TableCell({
          columnSpan: 6,
          shading: { fill: COLORS.rowTotal },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: `Итого: ${group.title}`,
                  bold: true,
                  color: COLORS.primaryLight,
                  size: 20,
                  font: FONT,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          shading: { fill: COLORS.rowTotal },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: fmt(group.subtotal),
                  bold: true,
                  color: COLORS.primaryLight,
                  size: 20,
                  font: FONT,
                }),
              ],
            }),
          ],
        }),
      ],
    });

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: SECTION_TABLE_COLUMNS,
        rows: [headerRow, ...dataRows, subtotalRow],
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
    children.push(new Paragraph({ spacing: { after: 200 } }));
  }

  // ─── БЛОК ИТОГОВ ───
  const inst = result.installation;
  const work = inst?.cameraInstall ?? 0;
  const cableInstall = inst?.cableInstall ?? 0;
  const totalWithoutVat = result.grandTotal / 1.12;
  const vatAmount = result.grandTotal - totalWithoutVat;

  const totalsData: [string, number][] = [
    ['Оборудование', result.equipment],
    ['Расходные материалы', result.consumables ?? 0],
    ['Монтажные работы', work],
    ['Монтаж кабеля', cableInstall],
    ['ИТОГО БЕЗ НДС', Math.round(totalWithoutVat)],
    ['НДС 12%', Math.round(vatAmount)],
  ];

  const totalHeaderRow = new TableRow({
    children: [
      new TableCell({
        columnSpan: 2,
        shading: { fill: COLORS.primary },
        margins: { top: 120, bottom: 120, left: 150, right: 150 },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: 'ИТОГИ ПО СМЕТЕ', bold: true, color: COLORS.accent, size: 24, font: FONT }),
            ],
          }),
        ],
      }),
    ],
  });

  const totalDataRows = totalsData.map(([label, val]) =>
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: label, font: FONT, size: 22 })] })],
        }),
        new TableCell({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: fmt(val), font: FONT, size: 22 })],
            }),
          ],
        }),
      ],
    })
  );

  const totalFinalRow = new TableRow({
    children: [
      new TableCell({
        shading: { fill: COLORS.primary },
        margins: { top: 120, bottom: 120, left: 150, right: 150 },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: 'ИТОГО С НДС', bold: true, color: COLORS.accent, size: 32, font: FONT }),
            ],
          }),
        ],
      }),
      new TableCell({
        shading: { fill: COLORS.primary },
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: fmt(result.grandTotal), bold: true, color: COLORS.accent, size: 32, font: FONT }),
            ],
          }),
        ],
      }),
    ],
  });

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [totalHeaderRow, ...totalDataRows, totalFinalRow],
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight },
        left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight },
        right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryLight },
      },
    })
  );
  children.push(new Paragraph({ spacing: { after: 300 } }));

  // ─── ФИНАНСОВЫЕ УСЛОВИЯ ───
  children.push(
    new Paragraph({
      shading: { fill: COLORS.primaryBg },
      spacing: { before: 200, after: 120 },
      indent: { left: 200 },
      children: [
        new TextRun({ text: 'ФИНАНСОВЫЕ УСЛОВИЯ', bold: true, color: COLORS.primaryLight, size: 24, font: FONT }),
      ],
    })
  );
  children.push(
    p('Все расходы на поставку оборудования, монтаж, пусконаладку и мобильное приложение осуществляются полностью за счёт ТОО G&R Group.', {
      spacingAfter: 120,
    })
  );
  children.push(
    p(`Домофония: от ${result.monthlyIntercomPerFlat} ₸ с квартиры / мес.`, { spacingAfter: 60 }),
    p(`Видеонаблюдение: от ${result.monthlyCctvPerFlat} ₸ с квартиры / мес.`, { spacingAfter: 120 })
  );
  children.push(p('Оплата производится ежемесячно.', { spacingAfter: 200 }));

  // Рассрочка
  children.push(p('Рассрочка (беспроцентная):', { bold: true, spacingAfter: 80 }));
  for (const months of [36, 48, 60]) {
    const perMonth = Math.round(result.grandTotal / months);
    children.push(p(`${months} мес. → ${fmt(perMonth)}/мес`, { spacingAfter: 60 }));
  }
  const totalFlats = result.totalFlats ?? 0;
  const perFlatMonthly =
    totalFlats > 0 ? Math.round(result.grandTotal / totalFlats) : Math.round(result.grandTotal / 200);
  const flatsLabel = totalFlats > 0 ? totalFlats : 200;
  children.push(
    p(`Ежемесячно с квартиры: ${fmt(perFlatMonthly)} (Итого / ${flatsLabel} кв.)`, { spacingAfter: 200 })
  );

  // ─── УСЛОВИЯ (маркированный список) ───
  children.push(p('Условия', { bold: true, size: 24, color: COLORS.primaryLight, spacingAfter: 120 }));
  const terms = [
    'Гарантия: 36 месяцев на оборудование и монтаж',
    'Срок поставки: 5–14 рабочих дней',
    'Срок действия КП: 3 календарных дня',
  ];
  terms.forEach((t) => children.push(p('• ' + t, { spacingAfter: 60 })));
  children.push(new Paragraph({ spacing: { after: 200 } }));

  // ─── ПОДПИСЬ ───
  children.push(
    new Table({
      width: { size: 80, type: WidthType.PERCENTAGE },
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                p('Директор ТОО «G&R Group»', { spacingAfter: 80 }),
                p('________________________', { spacingAfter: 40 }),
                p('(подпись)', { size: 18, color: COLORS.textMuted, spacingAfter: 40 }),
                p('М.П.', { spacingAfter: 0 }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                p('А.А. Абоимов', { spacingAfter: 0 }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: '25mm', right: '25mm', bottom: '20mm', left: '25mm' },
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
                  new TextRun({
                    text: 'Цена указана на дату выставления КП.   Стр. ',
                    font: FONT,
                    size: 16,
                    color: '888888',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: FONT,
                    size: 16,
                    color: '888888',
                  }),
                  new TextRun({
                    text: ' из ',
                    font: FONT,
                    size: 16,
                    color: '888888',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: FONT,
                    size: 16,
                    color: '888888',
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

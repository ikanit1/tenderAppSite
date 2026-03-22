/**
 * Генерация документа «Финансовая модель» (рассрочка) в формате .docx.
 * Структура по образцу КП_Фин условия_G&R_Group_.pdf:
 *  — Шапка с логотипом и контактами
 *  — Обращение к жителям
 *  — Состав и функционал проекта
 *  — Финансовые условия (общая сумма, первоначальный взнос, рассрочка, ежемесячно с квартиры)
 *  — Преимущества
 *  — Гарантии и сопровождение
 *  — Подпись и печать
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
import type { CalculatorResult } from '@/widgets/calculator/calculatorLogic';
import type { IntercomResult } from '@/store/calculatorStore';

const FONT = 'Times New Roman';
const SIZE_11 = 22;
const SIZE_12 = 24;
const SIZE_14 = 28;
const HEADER_COLOR = '1A3B6E';
const TOTAL_BG = '1A3B6E';

const LOGO_MAX_WIDTH = 160;
const LOGO_MAX_HEIGHT = 64;
const STAMP_MAX_SIZE = 160;
const SIGNATURE_MAX_WIDTH = 200;
const SIGNATURE_MAX_HEIGHT = 80;

function formatKzt(n: number): string {
  return n.toLocaleString('ru-RU') + ' ₸';
}

function fitSize(imgW: number, imgH: number, maxW: number, maxH: number): { width: number; height: number } {
  if (imgW <= 0 || imgH <= 0) return { width: maxW, height: maxH };
  const scale = Math.min(maxW / imgW, maxH / imgH, 1);
  return { width: Math.round(imgW * scale), height: Math.round(imgH * scale) };
}

function fitSquare(imgW: number, imgH: number, maxSize: number): { width: number; height: number } {
  return fitSize(imgW, imgH, maxSize, maxSize);
}

function p(
  text: string,
  opts: {
    bold?: boolean;
    size?: number;
    color?: string;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spacingAfter?: number;
    spacingBefore?: number;
    indent?: number;
  } = {}
): Paragraph {
  return new Paragraph({
    alignment: opts.alignment,
    spacing: {
      ...(opts.spacingAfter != null && { after: opts.spacingAfter }),
      ...(opts.spacingBefore != null && { before: opts.spacingBefore }),
    },
    indent: opts.indent != null ? { left: opts.indent } : undefined,
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

function bulletP(text: string, color?: string): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({
        text: '— ',
        font: FONT,
        size: SIZE_11,
        color: color ?? HEADER_COLOR,
        bold: color != null,
      }),
      new TextRun({
        text,
        font: FONT,
        size: SIZE_11,
        color: color,
        bold: color != null,
      }),
    ],
  });
}

export interface FinModelOptions {
  /** Кол-во квартир (для расчёта нагрузки на квартиру). Если 0 — делим на 200 */
  apartments?: number;
  /** Первоначальный взнос (₸). Если не задан — 0 */
  downPayment?: number;
  /** Срок рассрочки в месяцах (36 | 48 | 60). По умолчанию 60 */
  installmentMonths?: number;
}

export interface FinModelImageSizes {
  logo?: { width: number; height: number };
  stamp?: { width: number; height: number };
  signature?: { width: number; height: number };
}

/**
 * Строит документ «Финансовая модель» в формате .docx.
 * @param cctvResult   результат калькулятора видеонаблюдения (может быть null)
 * @param intercomResult результат калькулятора домофонии (может быть null)
 * @param opts         опции (кол-во квартир, аванс, срок)
 */
export function buildFinModelDocument(
  cctvResult: CalculatorResult | null,
  intercomResult: IntercomResult | null,
  opts: FinModelOptions = {},
  logoData?: ArrayBuffer,
  stampData?: ArrayBuffer,
  _signatureData?: ArrayBuffer,
  imageSizes?: FinModelImageSizes
): File {
  const {
    apartments = 0,
    downPayment = 0,
    installmentMonths = 60,
  } = opts;

  const cctvTotal = cctvResult?.grandTotal ?? 0;
  const intercomTotal = intercomResult?.grandTotal ?? 0;
  const grandTotal = cctvTotal + intercomTotal;

  const installmentAmount = Math.max(grandTotal - downPayment, 0);
  const flats = apartments > 0 ? apartments : 200;
  const monthlyTotal = installmentMonths > 0 ? Math.round(installmentAmount / installmentMonths) : 0;
  const monthlyPerFlat = flats > 0 ? Math.round(monthlyTotal / flats) : 0;

  const logoSize = imageSizes?.logo ?? { width: LOGO_MAX_WIDTH, height: LOGO_MAX_HEIGHT };
  const stampSize = imageSizes?.stamp ?? { width: STAMP_MAX_SIZE, height: STAMP_MAX_SIZE };

  const children: (Paragraph | Table)[] = [];

  // ── Логотип ──────────────────────────────────────────────────────────────
  // ── Шапка: логотип слева, контакты справа ────────────────────────────────
  {
    const logoChildren: Paragraph[] = [];
    if (logoData && logoData.byteLength > 0) {
      try {
        logoChildren.push(new Paragraph({ spacing: { after: 80 }, children: [new ImageRun({ type: 'png', data: logoData, transformation: { width: logoSize.width, height: logoSize.height } })] }));
      } catch { /* ignore */ }
    }
    logoChildren.push(new Paragraph({ children: [new TextRun({ text: 'ТОО\u00A0«G&R\u00A0Group»', bold: true, font: FONT, size: SIZE_12, color: HEADER_COLOR })] }));

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: HEADER_COLOR },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                margins: { top: 200, bottom: 200, left: 0, right: 200 },
                children: logoChildren,
              }),
              new TableCell({
                width: { size: 60, type: WidthType.PERCENTAGE },
                margins: { top: 200, bottom: 200, left: 200, right: 0 },
                children: [
                  new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: '+7 771 421 55 93', bold: true, font: FONT, size: SIZE_12, color: HEADER_COLOR })] }),
                  new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'info@grgroup.kz', font: FONT, size: SIZE_11, color: '444444' })] }),
                  new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'www.grgroup.kz', font: FONT, size: SIZE_11, color: '444444' })] }),
                  new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'г. Астана, Казахстан', font: FONT, size: SIZE_11, color: '444444' })] }),
                ],
              }),
            ],
          }),
        ],
      })
    );
    children.push(new Paragraph({ spacing: { after: 200 } }));
  }

  // ── Обращение ────────────────────────────────────────────────────────────
  children.push(
    p('Уважаемые жители!', {
      bold: true,
      size: SIZE_12,
      alignment: AlignmentType.CENTER,
      spacingAfter: 160,
    })
  );

  children.push(
    p(
      'ТОО «G&R Group», являясь профессиональным интегратором систем безопасности и ' +
      'официальным дистрибьютором оборудования, предлагает реализацию проекта по ' +
      'комплексной модернизации системы видеонаблюдения и домофонии в вашем жилом доме.',
      { spacingAfter: 120 }
    )
  );

  children.push(
    p(
      'Цель проекта — создание современной, надёжной и масштабируемой системы ' +
      'безопасности, обеспечивающей полный контроль доступа, мониторинг территории и ' +
      'повышение уровня комфорта для всех жителей.',
      { spacingAfter: 240 }
    )
  );

  // ── Состав и функционал ──────────────────────────────────────────────────
  children.push(
    p('Состав и функционал проекта', {
      bold: true,
      size: SIZE_12,
      color: HEADER_COLOR,
      spacingAfter: 120,
    })
  );
  children.push(p('В рамках проекта предусмотрено:', { spacingAfter: 80 }));

  const features = [
    'Модернизация системы видеонаблюдения с установкой высококачественных камер',
    'Полное обновление домофонной системы с расширенным функционалом',
    'Организация удалённого доступа через мобильные устройства (iOS / Android)',
    'Централизованное хранение и архивирование видеозаписей',
    'Обеспечение стабильной и бесперебойной работы оборудования',
    'Возможность дальнейшего масштабирования системы',
  ];
  for (const f of features) {
    children.push(bulletP(f));
  }
  children.push(new Paragraph({ spacing: { after: 240 } }));

  // ── Финансовые условия ───────────────────────────────────────────────────
  children.push(
    p('Финансовые условия', {
      size: SIZE_12,
      spacingAfter: 120,
    })
  );
  children.push(p('Общая стоимость проекта составляет:', { spacingAfter: 40 }));
  children.push(p(formatKzt(grandTotal), { bold: true, size: SIZE_14, spacingAfter: 160 }));

  children.push(p('Условия реализации:', { spacingAfter: 80 }));

  const conditionRows: [string, string][] = [
    ['Первоначальный взнос:', formatKzt(downPayment)],
    ['Сумма, предоставляемая в рассрочку:', formatKzt(installmentAmount)],
    ['Выбранный срок рассрочки:', `${installmentMonths} месяцев`],
  ];
  for (const [label, value] of conditionRows) {
    children.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({ text: '— ' + label + ' ', font: FONT, size: SIZE_11 }),
          new TextRun({ text: value, font: FONT, size: SIZE_11, bold: true }),
        ],
      })
    );
  }

  children.push(new Paragraph({ spacing: { after: 120 } }));
  children.push(p('Ежемесячная нагрузка на одну квартиру составляет:', { spacingAfter: 40 }));
  children.push(
    p(formatKzt(monthlyPerFlat), {
      bold: true,
      size: SIZE_14,
      spacingAfter: 80,
    })
  );

  // Детализация по системам (если обе системы присутствуют)
  if (cctvTotal > 0 || intercomTotal > 0) {
    const detailRows: [string, number][] = [];
    if (cctvTotal > 0) detailRows.push(['Видеонаблюдение', cctvTotal]);
    if (intercomTotal > 0) detailRows.push(['Домофония', intercomTotal]);

    if (detailRows.length > 1) {
      children.push(
        new Table({
          width: { size: 60, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
          },
          rows: [
            ...detailRows.map(([label, val]) =>
              new TableRow({
                children: [
                  new TableCell({
                    margins: { top: 80, bottom: 80, left: 160, right: 80 },
                    children: [new Paragraph({ children: [new TextRun({ text: label, font: FONT, size: SIZE_11 })] })],
                  }),
                  new TableCell({
                    margins: { top: 80, bottom: 80, left: 80, right: 160 },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [new TextRun({ text: formatKzt(val), font: FONT, size: SIZE_11, bold: true })],
                      }),
                    ],
                  }),
                ],
              })
            ),
            new TableRow({
              children: [
                new TableCell({
                  shading: { fill: TOTAL_BG },
                  margins: { top: 80, bottom: 80, left: 160, right: 80 },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: 'ИТОГО', font: FONT, size: SIZE_11, bold: true, color: 'FFFFFF' })],
                    }),
                  ],
                }),
                new TableCell({
                  shading: { fill: TOTAL_BG },
                  margins: { top: 80, bottom: 80, left: 80, right: 160 },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.RIGHT,
                      children: [new TextRun({ text: formatKzt(grandTotal), font: FONT, size: SIZE_11, bold: true, color: 'FFFFFF' })],
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      );
      children.push(new Paragraph({ spacing: { after: 120 } }));
    }
  }

  children.push(
    p(
      'Данный формат финансирования позволяет реализовать современную систему безопасности без ' +
      'значительной единовременной нагрузки на жителей.',
      { spacingAfter: 240 }
    )
  );

  // ── Выбранный срок — главный акцент ──────────────────────────────────────
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: TOTAL_BG },
              margins: { top: 140, bottom: 140, left: 200, right: 200 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: `ВЫБРАННЫЙ СРОК РАССРОЧКИ: ${installmentMonths} МЕСЯЦЕВ`, bold: true, color: 'FFFFFF', font: FONT, size: SIZE_14 })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 80 },
                  children: [new TextRun({ text: `${formatKzt(monthlyPerFlat)} в месяц с квартиры  (${flats} кв.)`, bold: true, color: 'FFFFFF', font: FONT, size: SIZE_12 })],
                }),
              ],
            }),
          ],
        }),
      ],
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
    })
  );
  children.push(new Paragraph({ spacing: { after: 160 } }));

  // ── Справочная таблица рассрочки ─────────────────────────────────────────
  children.push(
    p('Варианты рассрочки', { bold: true, size: SIZE_12, color: HEADER_COLOR, spacingAfter: 100 })
  );

  const allMonths = [12, 24, 36, 48, 60];
  const installmentVariants = allMonths.map((m) => {
    const total = Math.round(installmentAmount / m);
    const perFlat = flats > 0 ? Math.round(total / flats) : 0;
    const isSelected = m === installmentMonths;
    return { months: m, perFlat, total, isSelected };
  });

  children.push(
    new Table({
      width: { size: 90, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      },
      rows: [
        // Header
        new TableRow({
          tableHeader: true,
          children: ['Срок', 'Ежемесячно (итого)', `С квартиры (${flats} кв.)`].map((txt) =>
            new TableCell({
              shading: { fill: TOTAL_BG },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: txt, font: FONT, size: SIZE_11, bold: true, color: 'FFFFFF' })],
                }),
              ],
            })
          ),
        }),
        ...installmentVariants.map((v) => {
          const fill = v.isSelected ? 'D6E4F0' : 'FFFFFF';
          const color = v.isSelected ? HEADER_COLOR : undefined;
          return new TableRow({
            children: [
              new TableCell({
                shading: { fill },
                margins: { top: v.isSelected ? 100 : 80, bottom: v.isSelected ? 100 : 80, left: 120, right: 120 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: `${v.months} мес.${v.isSelected ? ' ✓' : ''}`, font: FONT, size: v.isSelected ? SIZE_12 : SIZE_11, bold: v.isSelected, color })],
                  }),
                ],
              }),
              new TableCell({
                shading: { fill },
                margins: { top: v.isSelected ? 100 : 80, bottom: v.isSelected ? 100 : 80, left: 120, right: 120 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [new TextRun({ text: formatKzt(v.total), font: FONT, size: v.isSelected ? SIZE_12 : SIZE_11, bold: v.isSelected, color })],
                  }),
                ],
              }),
              new TableCell({
                shading: { fill },
                margins: { top: v.isSelected ? 100 : 80, bottom: v.isSelected ? 100 : 80, left: 120, right: 120 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [new TextRun({ text: formatKzt(v.perFlat), font: FONT, size: v.isSelected ? SIZE_12 : SIZE_11, bold: v.isSelected, color })],
                  }),
                ],
              }),
            ],
          });
        }),
      ],
    })
  );
  children.push(new Paragraph({ spacing: { after: 240 } }));

  // ── Преимущества ─────────────────────────────────────────────────────────
  children.push(
    p('Преимущества:', { size: SIZE_12, spacingAfter: 100 })
  );
  const advantages = [
    'Существенное повышение уровня безопасности двора и подъездов',
    'Контроль входа и предотвращение несанкционированного доступа',
    'Онлайн-доступ к камерам в режиме реального времени',
    'Повышение инвестиционной привлекательности недвижимости',
    'Надёжная и проверенная инфраструктура',
    'Поддержка и сервисное сопровождение',
  ];
  for (const a of advantages) {
    children.push(bulletP(a, HEADER_COLOR));
  }
  children.push(new Paragraph({ spacing: { after: 160 } }));

  // ── Гарантии ─────────────────────────────────────────────────────────────
  children.push(
    p('Гарантии и сопровождение', { size: SIZE_12, spacingAfter: 100 })
  );
  children.push(p('Компания ТОО «G&R Group» обеспечивает:', { spacingAfter: 80 }));
  const guarantees = [
    'Гарантию на оборудование и выполненные работы',
    'Профессиональный монтаж и настройку',
    'Техническую поддержку и сервисное обслуживание',
    'Оперативное реагирование на обращения',
  ];
  for (const g of guarantees) {
    children.push(bulletP(g));
  }
  children.push(new Paragraph({ spacing: { after: 200 } }));

  children.push(
    p(
      'Мы готовы подробно презентовать проект, ответить на все вопросы и адаптировать решение с учётом особенностей вашего дома',
      { spacingAfter: 240 }
    )
  );

  // ── Подпись ───────────────────────────────────────────────────────────────
  children.push(p('С уважением,', { spacingAfter: 60 }));
  children.push(p('ТОО\u00A0«G&R\u00A0Group»', { spacingAfter: 200 }));

  {
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
                  p('Генеральный директор', { spacingAfter: 60 }),
                  p('________________________', { spacingAfter: 40 }),
                  p('/ Абоимов А. А. /', { spacingAfter: 0 }),
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
  }

  const doc: File = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '30mm' },
          },
        },
        children,
      },
    ],
  });

  return doc as File;
}

// ── Утилиты ────────────────────────────────────────────────────────────────

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

/**
 * Скачать «Финансовую модель» в браузере.
 */
export async function downloadFinModel(
  cctvResult: CalculatorResult | null,
  intercomResult: IntercomResult | null,
  opts: FinModelOptions = {}
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

  const imageSizes: FinModelImageSizes = {};
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

  const doc = buildFinModelDocument(cctvResult, intercomResult, opts, logoData, stampData, signatureData, imageSizes);
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const total = (cctvResult?.grandTotal ?? 0) + (intercomResult?.grandTotal ?? 0);
  a.download = `Финансовая_модель_${dateStr}_${total}тг.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

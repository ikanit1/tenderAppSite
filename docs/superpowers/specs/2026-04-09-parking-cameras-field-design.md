---
name: Камеры в паркинге — ручное поле в калькуляторе
description: Добавление поля «Камер в паркинге» (уличные купольные) в калькулятор видеонаблюдения
type: project
---

# Камеры в паркинге — ручное поле в калькуляторе

## Контекст

Калькулятор видеонаблюдения уже поддерживает паркинг: чекбокс «Есть паркинг» + поле «Въездов/шлагбаумов» → ANPR-камеры распознавания номеров (274 300 ₸/шт.).

Задача: добавить отдельное поле для ввода количества обычных камер **внутри** паркинга (уличные купольные, 14 400 ₸/шт., IPC-2122-APF28).

## Дизайн

### 1. Данные — `BuildingParams` + store

**Файл:** `src/widgets/calculator/calculatorLogic.ts`
Добавить поле в интерфейс:
```ts
/** Количество камер внутри паркинга (уличные купольные) */
parkingCameras: number;
```

**Файл:** `src/store/calculatorStore.ts`
Добавить в `defaultParams`:
```ts
parkingCameras: 0,
```

### 2. Логика расчёта — `calculateCameras()`

**Файл:** `src/widgets/calculator/calculatorLogic.ts`
Добавить блок после секции ANPR-камер (паркинговые ворота):

```ts
// ── Паркинг: уличные камеры внутри паркинга ──
if (hasParking && parkingCameras > 0) {
  const qty = parkingCameras;
  const rowSum = qty * OUTDOOR_CAMERA_PRICE_KZT;
  rows.push({
    name: `Камера уличная (паркинг) — ${OUTDOOR_CAMERA_MODEL}`,
    qty,
    unitPrice: OUTDOOR_CAMERA_PRICE_KZT,
    sum: rowSum,
    note: `${qty} камер в паркинге`,
  });
  sum += rowSum;
  totalCameras += qty;
}
```

Эти камеры участвуют в расчёте кабеля, NVR, коммутаторов, монтажа автоматически — как все остальные уличные камеры. Лифтовыми не считаются.

### 3. UI — `CctvCalculatorSection.tsx`

Внутри блока `{params.hasParking && (...)}`, после поля «Въездов/шлагбаумов паркинга», добавить поле:

```tsx
<div className={styles.inputGroup} style={{ marginTop: 8 }}>
  <label htmlFor="calc-parking-cameras" className={styles.inputLabel}>
    Камер в паркинге
  </label>
  <input
    id="calc-parking-cameras"
    className={styles.input}
    {...numericInputProps(
      params.parkingCameras,
      (val) => setParams((p) => ({ ...p, parkingCameras: Math.max(0, val) })),
      { max: 100 }
    )}
  />
</div>
```

Также обновить строку отображения паркинга в блоке результатов:
```tsx
// было:
`да, ${params.parkingGates} въезд(ов)`
// стать:
`да, ${params.parkingGates} въезд(ов)${params.parkingCameras > 0 ? `, ${params.parkingCameras} камер` : ''}`
```

### 4. КП (PDF)

Дополнительных изменений не требуется. Новая строка автоматически попадает в группу «Камеры видеонаблюдения» через `result.groups` — все генераторы КП (`generateKP`, `generateKPFull`) итерируют по этим группам.

### 5. Текст заявки (`buildSummaryText`)

Обновить строку паркинга:
```ts
// добавить parkingCameras в строку параметров
`Паркинг: да, ${params.parkingGates} въезд(ов)${params.parkingCameras > 0 ? `, ${params.parkingCameras} камер` : ''}`
```

## Затронутые файлы

1. `src/widgets/calculator/calculatorLogic.ts` — интерфейс + логика
2. `src/store/calculatorStore.ts` — defaultParams
3. `src/widgets/calculator/CctvCalculatorSection.tsx` — UI поле + отображение результата + buildSummaryText

## Тест

- Включить паркинг, ввести 2 въезда + 10 камер в паркинге
- Проверить: в группе «Камеры видеонаблюдения» должна появиться строка «Камера уличная (паркинг) — IPC-2122-APF28, 10 шт., 14 400 ₸»
- Проверить: итоговое число камер увеличилось на 10, кабель и монтаж пересчитались
- Проверить: КП (скачать PDF) содержит новую строку

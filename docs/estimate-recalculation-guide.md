# Пересчёт сметы по результатам технического аудита

Данные по объекту и цены берутся из проекта: `calculatorConfig.ts`, результат калькулятора `calculateResult(input)`.

---

## Исходные данные объекта (подставить из расчёта)

- **Количество квартир:** `input.intercom.entrances × input.intercom.floorsPerEntrance × input.intercom.flatsPerFloor`
- **Количество подъездов:** `input.intercom.entrances`
- **Количество этажей:** `input.intercom.floorsPerEntrance` (в подъезде) или `input.cableSettings.buildingFloors`
- **Камеры:** 2MP уличные — `cameraTypes.outdoor2mp`, 2MP внутр. — `indoor2mp`, 4MP — `indoor4mp`, ANPR — `anpr3mp`, лифтовые 2MP — `elevatorCount` при `elevatorCameraType === '2mp'`
- **Устройства домофонии:** считаются в `estimateRecalculation.ts` → `intercomDevicesCount(input)`
- **Архив:** 30 дней (пересчёт хранения по битрейту)
- **Исходная смета:** результат `calculateResult(input)` (группы, итоги)

---

## Исправление 1 — Хранение по битрейту

Формула (из конфига `storageBitrateMbpsFor30d`):

- Объём (ТБ) = Σ (кол-во_камер_типа × битрейт_типа) × 30 × 3600 × 24 / 8 / 1_000_000  
- Битрейты: 2MP = 2, 4MP = 4, ANPR = 6, лифт 2MP = 2 Мбит/с  

Число HDD = ceil(требуемый_ТБ / 10). Цена диска: **220 000 ₸** (SEAGATE SkyHawk AI 10TB).

В коде: `recalculateEstimate(input, result)` возвращает `storageFix`: `wasHdd`, `requiredHdd`, `diffHdd`, `diffKzt`.

---

## Исправление 2 — Кабель по метражу

- Метраж CCTV: `result.totalMetersCctv`, домофония: `result.totalMetersIntercom`
- Запас 15%: `CABLE_RESERVE_RECALC = 1.15`
- Бухт CCTV = ceil(метраж_CCTV × 1.15 / 305), домофония — аналогично
- Цена бухты: **41 300 ₸** (CAB-LC2100B-E2-IN 305м)
- Расходники: 25% от стоимости кабеля (`consumablesCablePercent`)

В коде: `cableFix`: `reelCctvWas/Need`, `reelIntercomWas/Need`, `diffKzt`.

---

## Исправление 3 — L3 и VLAN

Если `intercomDevicesCount(input) > 250`:

| Позиция | Кол-во | Цена за ед. (из конфига) | Сумма |
|---------|--------|---------------------------|-------|
| Коммутатор L3 управляемый 24п | 1 | 85 000 ₸ | 85 000 ₸ |
| Настройка VLAN и маршрутизации | 1 | 45 000 ₸ | 45 000 ₸ |

Константа: `INTERCOM_DEVICES_L3_THRESHOLD = 250`. Цены: `auditRecalcConfig.l3Switch24`, `auditRecalcConfig.vlanSetup`.

---

## Исправление 4 — Абонентские устройства

Варианты (задаются в `recalculateEstimate(..., { subscriberVariant, flatCount })`):

- **`flats`** — видеодомофон в квартиру: кол-во = число квартир, цена **35 000 ₸** (ориентир)
- **`concierge`** — 2 монитора 55" 4K на пост: **363 700 ₸** × 2
- **`customer`** — поставка заказчика: в смету 0 ₸, в список уточнений добавляется запись
- **`none`** — не добавлять

---

## Исправление 5 — Лицензии ПО

Включение: `recalculateEstimate(..., { addLicenses: true, nvrChannelsExtra })`.

- Лицензия NVR (доп. канал): **2 500 ₸** × кол-во каналов сверх базовых
- Лицензия ANPR на камеру: **15 000 ₸** × кол-во камер АНПР
- СКУД при необходимости: **8 000 ₸** (в коде не автоматизировано, можно добавить)

---

## Исправление 6 — PoE-бюджет

Проверка в отчёте: таблица `poeBudgetTable` (коммутатор, бюджет Вт, нагрузка Вт, статус). Бюджеты из конфига `switchPoEBudgetWatts`. При нагрузке > 80% бюджета — в отчёт выводится «Проверить нагрузку».

---

## Использование в коде

```ts
import { calculateResult } from '@/widgets/calculator/calculatorLogic';
import { recalculateEstimate, formatRecalcReport } from '@/widgets/calculator/estimateRecalculation';

const input: CalculatorInputs = { ... }; // из формы калькулятора
const result = calculateResult(input);
if (!result) return;

const recalc = recalculateEstimate(input, result, {
  subscriberVariant: 'concierge',  // или 'flats', 'customer', 'none'
  flatCount: 120,
  addLicenses: true,
  nvrChannelsExtra: 16,
});

console.log(formatRecalcReport(recalc, result));
// recalc.tableChanges — таблица изменений
// recalc.newGrandTotal — новый итого
// recalc.clarificationList — список на уточнение
```

---

## Формат новой сметы (после пересчёта)

1. **Таблица изменений:** `recalc.tableChanges` → | Раздел | Было ₸ | Стало ₸ | Разница ₸ |
2. **Полная обновлённая смета:** `recalc.newGroups` (группы с новыми/добавленными разделами; замены по кабелю и HDD в строках групп нужно при необходимости доработать вручную по `cableFix` и `storageFix`).
3. **Итого по проекту (новое):**
   - Оборудование: `recalc.newEquipment`
   - Расходные материалы: `recalc.newConsumables`
   - Монтажные работы: `recalc.newInstallationWork`
   - Пусконаладка: `recalc.newInstallationCommissioning`
   - Монтаж кабеля: `recalc.newInstallationCable`
   - **ИТОГО:** `recalc.newGrandTotal`
4. **Позиции на уточнение:** `recalc.clarificationList`

---

## Данные из проекта (справочно)

| Параметр | Значение | Файл |
|----------|----------|------|
| HDD 10TB | 220 000 ₸ | calculatorConfig.ts → hddConfig |
| Кабель 305 м | 41 300 ₸ | cableConfig.indoor |
| Расходники кабеля | 25% | consumablesCablePercent |
| Запас кабеля при пересчёте | 15% | CABLE_RESERVE_RECALC |
| Порог L3/VLAN | 250 уст. домофонии | INTERCOM_DEVICES_L3_THRESHOLD |
| L3 24п | 85 000 ₸ | auditRecalcConfig.l3Switch24 |
| Настройка VLAN | 45 000 ₸ | auditRecalcConfig.vlanSetup |
| Видеодомофон в квартиру | 35 000 ₸ | auditRecalcConfig.subscriberPanel |
| Монитор 55" пост | 363 700 ₸ | auditRecalcConfig.conciergeMonitor |
| Монтаж | 30% от оборудования | installationConfig.installationRate |
| Пусконаладка | 25% от монтажа | installationConfig.commissioningRate |
| Монтаж кабеля | 300 ₸/м | installationConfig.cableInstallPerMeter |

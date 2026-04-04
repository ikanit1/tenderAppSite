# Дизайн: Контактная форма + отправка КП на почту

**Дата:** 2026-04-04
**Статус:** Утверждён

---

## Контекст

В калькуляторе систем безопасности (страница `/calculator`) есть кнопки:
- «КП полное .pdf» — генерирует и скачивает коммерческое предложение
- «Финансовая модель .pdf» — генерирует и скачивает финансовую модель
- «Отправить на почту» — открывает модал с полями имя/телефон/email, шлёт текст заявки на `ADMIN_EMAIL`

**Проблемы:**
1. PDF не отправляется клиенту и нам на почту — только скачивается локально.
2. В PDF нет данных об объекте (название ЖК, адрес, контакт клиента).
3. Три отдельных действия вместо одного бесшовного флоу.

---

## Цель

При клике на «КП полное» или «Финансовую модель»:
1. Показать модальную форму с данными объекта (Название ЖК, Адрес, Телефон, Email).
2. Вставить эти данные в PDF.
3. После заполнения — сгенерировать PDF, отправить на email клиента и копию на `ADMIN_EMAIL`, скачать локально.
4. Убрать отдельную кнопку «Отправить на почту» — она поглощается этим флоу.

---

## UX-флоу

```
Клик "КП полное .pdf" / "Финансовая модель .pdf"
    ↓
Модал открывается с заголовком:
  "Получить Коммерческое предложение" / "Получить Финансовую модель"
    ↓
Поля (все обязательные):
  — Название ЖК
  — Адрес объекта
  — Телефон (контактный)
  — Email
  Подсказка под email: "Укажите почту — продублируем расчёт, чтобы не потерять"
    ↓
Кнопка: "Получить расчёт на почту и скачать"  →  лоадер (pending)
    ↓
[1] PDF генерируется с данными ЖК внутри документа
[2] PDF → base64 → POST /api/calculator/send-kp
[3] Бэкенд: письмо с PDF клиенту + копия на ADMIN_EMAIL
[4] Модал закрывается
[5] PDF скачивается локально (URL.createObjectURL)
```

---

## Внешний вид блока объекта в PDF

После заголовка КП / Финансовой модели добавляется блок:

```
┌─────────────────────────────────────────────────────────┐
│  КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ № КП-20260404-001             │
│  от «4» апреля 2026 г.  Действительно до: 07.04.2026   │
│                                                         │
│  Объект:  ЖК «Солнечный»                               │
│  Адрес:   г. Астана, ул. Примерная, 1                  │
│  Контакт: +7 700 000 00 00                              │
└─────────────────────────────────────────────────────────┘
```

Аналогичный блок добавляется в Финансовую модель.

---

## Архитектура изменений

### Frontend

#### `src/components/calculator/steps/Step5Result.tsx`

- Убрать кнопку «Отправить на почту» и старый связанный модал.
- Добавить состояние:
  ```ts
  interface ProjectInfo {
    complexName: string;
    address: string;
    phone: string;
    email: string;
  }
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>(() =>
    JSON.parse(sessionStorage.getItem('kp_project_info') || 'null') ?? {
      complexName: '', address: '', phone: '', email: ''
    }
  );
  const [downloadType, setDownloadType] = useState<'kpfull' | 'finmodel' | null>(null);
  ```
- При изменении любого поля сохранять в `sessionStorage('kp_project_info')`.
- Клик на «КП полное» → `setDownloadType('kpfull')` → открыть модал.
- Клик на «Финансовая модель» → `setDownloadType('finmodel')` → открыть модал.
- В обработчике submit модала:
  1. Валидация всех 4 полей.
  2. Вызов `generateKPFullPDF` / `generateFinModelPDF` (возвращает `{ blob, filename }`).
  3. Конвертация `blob → base64`.
  4. POST `/api/calculator/send-kp` с данными + PDF.
  5. Закрыть модал.
  6. Скачать PDF через `URL.createObjectURL(blob)`.

#### `src/widgets/calculator/generateKPFullPDF.ts`

- Добавить параметр `projectInfo: { complexName: string; address: string; phone: string }`.
- После `drawKPTitle` вызывать новую функцию `drawProjectInfo(w, projectInfo)`.
- Изменить сигнатуру: возвращать `Promise<{ blob: Blob; filename: string }>` вместо `void`.
- Убрать `pdf.save(...)` из функции — вызывающий код скачивает сам.

#### `src/widgets/calculator/generateFinModelPDF.ts`

- Те же изменения: добавить `projectInfo`, блок в PDF, вернуть `{ blob, filename }`.

#### `src/shared/api/leadApi.ts`

Добавить новую функцию:

```ts
export interface SendKPPayload {
  complexName: string;
  address: string;
  phone: string;
  email: string;          // email клиента
  documentType: 'kpfull' | 'finmodel';
  pdfBase64: string;
  fileName: string;
}

export async function sendKPByEmail(payload: SendKPPayload): Promise<{ success: boolean }>;
// POST /api/calculator/send-kp
```

### Backend (`tenderbot/apisite/main.py`)

#### Расширение `_send_order_email_sync`

Добавить параметр `attachment: Optional[tuple[str, bytes]] = None` — кортеж `(filename, bytes)`.
При наличии вложения оборачивать в `MIMEMultipart`, добавлять `MIMEApplication` с Content-Disposition.

#### Новый endpoint `POST /api/calculator/send-kp`

```python
class SendKPRequest(BaseModel):
    complexName: str
    address: str
    phone: str
    email: str           # email клиента
    documentType: str    # 'kpfull' | 'finmodel'
    pdfBase64: str
    fileName: str
```

Логика:
1. Декодировать `pdfBase64` → bytes.
2. Сформировать тему: «КП для ЖК {complexName}» / «Финансовая модель для ЖК {complexName}».
3. Отправить письмо с PDF-вложением на `payload.email` (клиент).
4. Отправить копию с PDF-вложением на `ADMIN_EMAIL`.
5. Вернуть `{ success: true }`.

---

## Валидация формы

| Поле | Правило |
|------|---------|
| Название ЖК | непустое, min 2 символа |
| Адрес | непустое, min 5 символов |
| Телефон | непустой, regex `^\+?[0-9\s\-()]{7,}$` |
| Email | непустой, стандартный email regex |

Кнопка «Получить расчёт на почту и скачать» неактивна, пока хотя бы одно поле не прошло валидацию.

---

## UX-детали модала

- **Заголовок** меняется динамически: «Получить Коммерческое предложение» / «Получить Финансовую модель».
- **Подсказка под email:** «Укажите почту — продублируем расчёт, чтобы не потерять».
- **Кнопка submit:** текст «Получить расчёт на почту и скачать» → при нажатии меняется на лоадер «Отправка…».
- **Поля** предзаполняются из `sessionStorage` если данные уже вводились.
- **После успеха:** модал закрывается, PDF скачивается, тост «Расчёт отправлен на {email}».
- **При ошибке:** тост с текстом ошибки, модал остаётся открытым.

---

## Что НЕ меняется

- Логика расчёта калькулятора — без изменений.
- Ссылка «КП мониторы (интерком панели)» — остаётся как есть.
- Кнопка «Начать заново» — остаётся как есть.
- Existing `/api/contacts/submit` endpoint — не трогаем.

---

## Файлы, которые затрагиваются

| Файл | Тип изменения |
|------|--------------|
| `src/components/calculator/steps/Step5Result.tsx` | Рефакторинг модала, новое состояние, новый флоу |
| `src/widgets/calculator/generateKPFullPDF.ts` | Добавить projectInfo, изменить возврат |
| `src/widgets/calculator/generateFinModelPDF.ts` | Добавить projectInfo, изменить возврат |
| `src/shared/api/leadApi.ts` | Добавить `sendKPByEmail` |
| `tenderbot/apisite/main.py` | Новый endpoint, расширить email-функцию |

# Calculator KP Email Delivery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** При клике «КП полное» / «Финансовая модель» открывать модал с данными ЖК, вставлять их в PDF, отправлять PDF клиенту и на ADMIN_EMAIL, скачивать локально.

**Architecture:** Backend получает base64-PDF через новый endpoint `/api/calculator/send-kp` и шлёт два письма с вложением. Frontend генерирует PDF через обновлённые функции (теперь возвращают `{ blob, filename }`), конвертирует в base64, отправляет на бэкенд, скачивает локально. Модал с 4 полями (Название ЖК, Адрес, Телефон*, Email*) заменяет старую кнопку «Отправить на почту».

**Tech Stack:** FastAPI + smtplib (MIMEApplication для PDF), React 18 + TypeScript, jsPDF, sessionStorage.

---

## Карта файлов

| Файл | Тип | Что меняется |
|------|-----|-------------|
| `tenderbot/apisite/main.py` | Modify | Расширить `_send_order_email_sync` + новый endpoint |
| `src/shared/api/leadApi.ts` | Modify | Добавить `sendKPByEmail` + `SendKPPayload` |
| `src/widgets/calculator/generateKPFullPDF.ts` | Modify | Добавить `projectInfo`, `drawProjectInfo`, вернуть blob |
| `src/widgets/calculator/generateFinModelPDF.ts` | Modify | Добавить `projectInfo`, `drawProjectInfo`, вернуть blob |
| `src/components/calculator/steps/Step5Result.tsx` | Modify | Новый модал, удалить старый, sessionStorage, новый флоу |

---

## Task 1: Backend — расширить `_send_order_email_sync` + новый endpoint

**Files:**
- Modify: `tenderbot/apisite/main.py:1438-1474` (функция `_send_order_email_sync`)
- Modify: `tenderbot/apisite/main.py` (добавить endpoint после `contacts_submit`)

- [ ] **Step 1.1: Расширить `_send_order_email_sync` поддержкой PDF-вложения**

Заменить функцию `_send_order_email_sync` (строки 1438–1474) на:

```python
def _send_order_email_sync(
    to_email: str,
    subject: str,
    body_plain: str,
    body_html: Optional[str] = None,
    attachment: Optional[tuple] = None,  # (filename: str, data: bytes)
) -> None:
    """Синхронная отправка письма через SMTP. Вызывать из run_in_executor."""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    from email.mime.application import MIMEApplication
    from email.utils import formatdate

    if attachment:
        # mixed: text/html + PDF attachment
        msg = MIMEMultipart("mixed")
        alt = MIMEMultipart("alternative")
        alt.attach(MIMEText(body_plain, "plain", "utf-8"))
        if body_html:
            alt.attach(MIMEText(body_html, "html", "utf-8"))
        msg.attach(alt)
        fname, fbytes = attachment
        pdf_part = MIMEApplication(fbytes, _subtype="pdf")
        pdf_part.add_header("Content-Disposition", "attachment", filename=fname)
        msg.attach(pdf_part)
    elif body_html:
        msg = MIMEMultipart("alternative")
        msg.attach(MIMEText(body_plain, "plain", "utf-8"))
        msg.attach(MIMEText(body_html, "html", "utf-8"))
    else:
        msg = MIMEText(body_plain, "plain", "utf-8")

    msg["Subject"] = subject
    msg["From"] = SMTP_USER or to_email
    msg["To"] = to_email
    msg["Date"] = formatdate(localtime=True)

    if SMTP_USE_SSL:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            if SMTP_USER and SMTP_PASSWORD:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(msg["From"], [to_email], msg.as_string())
    elif SMTP_USE_TLS:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            if SMTP_USER and SMTP_PASSWORD:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(msg["From"], [to_email], msg.as_string())
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            if SMTP_USER and SMTP_PASSWORD:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(msg["From"], [to_email], msg.as_string())
```

Обратная совместимость: существующие вызовы `contacts_submit` и `checkout_submit` передают 4 аргумента — `attachment` остаётся `None`, поведение не изменится.

- [ ] **Step 1.2: Добавить Pydantic-модель и endpoint**

Добавить сразу после определения `contacts_submit` (после строки ~1780):

```python
class SendKPRequest(BaseModel):
    complexName: str
    address: str
    phone: str
    email: str
    documentType: str  # 'kpfull' | 'finmodel'
    pdfBase64: str
    fileName: str


@app.post("/api/calculator/send-kp")
async def send_kp(payload: SendKPRequest):
    """Принимает PDF base64 и рассылает его клиенту + копию администратору."""
    import base64 as b64mod

    if not ADMIN_EMAIL:
        logger.warning("send_kp: ADMIN_EMAIL не задан")
        raise HTTPException(status_code=500, detail="Сервис отправки писем не настроен.")

    try:
        pdf_bytes = b64mod.b64decode(payload.pdfBase64)
    except Exception:
        raise HTTPException(status_code=400, detail="Некорректные данные PDF.")

    doc_name = (
        "Коммерческое предложение"
        if payload.documentType == "kpfull"
        else "Финансовая модель"
    )

    subject_client = f"{doc_name} для ЖК «{payload.complexName}» — G&R Group"
    subject_admin = (
        f"[НОВЫЙ ЛИД] {doc_name} — ЖК «{payload.complexName}» | {payload.phone}"
    )

    body_client = (
        f"Здравствуйте!\n\n"
        f"Высылаем {doc_name.lower()} для вашего объекта.\n\n"
        f"Объект: ЖК «{payload.complexName}»\n"
        f"Адрес:  {payload.address}\n\n"
        f"{doc_name} прикреплён к этому письму.\n\n"
        f"С уважением,\n"
        f"ТОО «G&R Group»\n"
        f"+7 771 421 55 93 | info@grgroup.kz"
    )

    body_admin = (
        f"Новый лид с калькулятора\n\n"
        f"Документ: {doc_name}\n"
        f"ЖК:       {payload.complexName}\n"
        f"Адрес:    {payload.address}\n"
        f"Телефон:  {payload.phone}\n"
        f"Email:    {payload.email}\n\n"
        f"{doc_name} прикреплён к письму."
    )

    attachment = (payload.fileName, pdf_bytes)
    loop = asyncio.get_event_loop()
    errors: list[str] = []

    # Письмо клиенту
    try:
        await loop.run_in_executor(
            None,
            _send_order_email_sync,
            payload.email,
            subject_client,
            body_client,
            None,
            attachment,
        )
    except Exception:
        logger.exception("send_kp: ошибка отправки клиенту")
        errors.append("client")

    # Копия администратору
    try:
        await loop.run_in_executor(
            None,
            _send_order_email_sync,
            ADMIN_EMAIL,
            subject_admin,
            body_admin,
            None,
            attachment,
        )
    except Exception:
        logger.exception("send_kp: ошибка отправки администратору")
        errors.append("admin")

    if len(errors) == 2:
        raise HTTPException(
            status_code=500,
            detail="Не удалось отправить письма. Попробуйте позже.",
        )

    return {"success": True}
```

- [ ] **Step 1.3: Проверить вручную — запустить бэкенд и убедиться что он стартует без ошибок**

```bash
cd tenderbot
python -m uvicorn apisite.main:app --port 8001 --reload
```

Ожидаемый вывод: `Application startup complete.` без синтаксических ошибок.

- [ ] **Step 1.4: Commit**

```bash
git add tenderbot/apisite/main.py
git commit -m "feat(backend): add /api/calculator/send-kp endpoint with PDF attachment support"
```

---

## Task 2: Frontend — добавить `sendKPByEmail` в leadApi.ts

**Files:**
- Modify: `src/shared/api/leadApi.ts`

- [ ] **Step 2.1: Добавить интерфейс `SendKPPayload` и функцию `sendKPByEmail`**

В файл `src/shared/api/leadApi.ts` после существующего `submitLead` добавить:

```typescript
export interface SendKPPayload {
  complexName: string;
  address: string;
  phone: string;
  email: string;
  documentType: 'kpfull' | 'finmodel';
  pdfBase64: string;
  fileName: string;
}

export async function sendKPByEmail(payload: SendKPPayload): Promise<{ success: boolean }> {
  const base = getCatalogUrl();
  const url = `${base}/api/calculator/send-kp`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail =
      typeof data.detail === 'string' ? data.detail : 'Ошибка отправки. Попробуйте позже.';
    throw new Error(detail);
  }

  return { success: true };
}
```

- [ ] **Step 2.2: Убедиться что TypeScript компилирует без ошибок**

```bash
npx tsc --noEmit
```

Ожидаемый вывод: нет ошибок (или ошибки только в других файлах — они пока не обновлены).

- [ ] **Step 2.3: Commit**

```bash
git add src/shared/api/leadApi.ts
git commit -m "feat(api): add sendKPByEmail for PDF delivery endpoint"
```

---

## Task 3: Frontend — обновить `generateKPFullPDF.ts`

**Files:**
- Modify: `src/widgets/calculator/generateKPFullPDF.ts`

Цель: добавить `ProjectInfo` параметр, нарисовать блок объекта в PDF, изменить возврат на `Promise<{ blob: Blob; filename: string }>`.

- [ ] **Step 3.1: Добавить интерфейс `ProjectInfo` и функцию `drawProjectInfo`**

После блока `// ── Заголовок КП ─────` (после функции `drawKPTitle`, примерно строка 240) добавить:

```typescript
// ── Данные объекта ────────────────────────────────────────────────────────────

export interface ProjectInfo {
  complexName: string;
  address: string;
  phone: string;
}

function drawProjectInfo(w: PDFWriter, info: ProjectInfo): void {
  w.checkPage(20);
  w.fillRect(ML, w.y - 2, CW, 18, PRIMARY_BG_RGB);
  w.setFont(false, 9);
  w.setColor([50, 50, 50]);
  w.text(`Объект:  ЖК «${info.complexName}»`, ML + 3, w.y + 2);
  w.y += 5.5;
  w.text(`Адрес:   ${info.address}`, ML + 3, w.y);
  w.y += 5.5;
  w.text(`Контакт: ${info.phone}`, ML + 3, w.y);
  w.y += 9;
}
```

- [ ] **Step 3.2: Обновить сигнатуру главной функции**

Найти строку:
```typescript
export async function downloadKPFullPDF(
  cctvResult: CalculatorResult | null,
  intercomResult: IntercomResult | null,
  opts: { apartments?: number; installmentMonths?: number; downPayment?: number }
): Promise<void> {
```

Заменить на:
```typescript
export async function generateKPFullPDF(
  cctvResult: CalculatorResult | null,
  intercomResult: IntercomResult | null,
  opts: { apartments?: number; installmentMonths?: number; downPayment?: number },
  projectInfo: ProjectInfo = { complexName: '', address: '', phone: '' }
): Promise<{ blob: Blob; filename: string }> {
```

- [ ] **Step 3.3: Вставить вызов `drawProjectInfo` после `drawKPTitle`**

Найти блок:
```typescript
  // KP title
  const now = new Date();
  const kpNum = kpNumber();
  drawKPTitle(w, kpNum, now);

  // Section I — CCTV
```

Заменить на:
```typescript
  // KP title
  const now = new Date();
  const kpNum = kpNumber();
  drawKPTitle(w, kpNum, now);

  // Project info block
  if (projectInfo.complexName || projectInfo.address || projectInfo.phone) {
    drawProjectInfo(w, projectInfo);
  }

  // Section I — CCTV
```

- [ ] **Step 3.4: Изменить конец функции — убрать `pdf.save`, вернуть blob**

Найти конец функции:
```typescript
  // Download
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  pdf.save(`КП_Полное_${dateStr}_${grandTotal}тг.pdf`);
}
```

Заменить на:
```typescript
  // Return blob + filename (caller handles saving and email sending)
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const filename = `КП_Полное_${dateStr}_${grandTotal}тг.pdf`;
  const blob = pdf.output('blob');
  return { blob, filename };
}
```

- [ ] **Step 3.5: Убедиться что TypeScript компилирует без ошибок**

```bash
npx tsc --noEmit
```

Ожидаемый вывод: ошибки только в `Step5Result.tsx` (старый вызов `downloadKPFullPDF` — исправим в Task 5).

- [ ] **Step 3.6: Commit**

```bash
git add src/widgets/calculator/generateKPFullPDF.ts
git commit -m "feat(pdf): generateKPFullPDF accepts projectInfo, returns blob instead of saving"
```

---

## Task 4: Frontend — обновить `generateFinModelPDF.ts`

**Files:**
- Modify: `src/widgets/calculator/generateFinModelPDF.ts`

- [ ] **Step 4.1: Добавить импорт `ProjectInfo` и функцию `drawProjectInfo`**

В начало файла, после строки с импортами (`import type { IntercomResult }...`), добавить:

```typescript
import type { ProjectInfo } from '@/widgets/calculator/generateKPFullPDF';
```

После функции `drawTitle` (строка ~215) добавить:

```typescript
// ── Данные объекта ────────────────────────────────────────────────────────────

function drawProjectInfo(w: PDFWriter, info: ProjectInfo): void {
  w.checkPage(20);
  const bgRgb: [number, number, number] = [232, 240, 254];
  w.pdf.setFillColor(bgRgb[0], bgRgb[1], bgRgb[2]);
  w.pdf.rect(ML, w.y - 2, CW, 18, 'F');
  w.setFont(false, 9);
  w.setColor(TEXT_RGB);
  w.text(`Объект:  ЖК «${info.complexName}»`, ML + 3, w.y + 2);
  w.y += 5.5;
  w.text(`Адрес:   ${info.address}`, ML + 3, w.y);
  w.y += 5.5;
  w.text(`Контакт: ${info.phone}`, ML + 3, w.y);
  w.y += 9;
}
```

> Примечание: `PDFWriter` в `generateFinModelPDF.ts` имеет методы `setFont`, `setColor`, `text`, `checkPage` — они уже определены в этом файле. Метод `w.pdf.setFillColor` + `w.pdf.rect` используется напрямую (fillRect может отсутствовать в этой версии PDFWriter).

- [ ] **Step 4.2: Обновить сигнатуру главной функции**

Найти:
```typescript
export async function downloadFinModelPDF(
  cctvResult: CalculatorResult | null,
  intercomResult: IntercomResult | null,
  opts: { apartments?: number; downPayment?: number; installmentMonths?: number }
): Promise<void> {
```

Заменить на:
```typescript
export async function generateFinModelPDF(
  cctvResult: CalculatorResult | null,
  intercomResult: IntercomResult | null,
  opts: { apartments?: number; downPayment?: number; installmentMonths?: number },
  projectInfo: ProjectInfo = { complexName: '', address: '', phone: '' }
): Promise<{ blob: Blob; filename: string }> {
```

- [ ] **Step 4.3: Вставить вызов `drawProjectInfo` после `drawTitle`**

Найти:
```typescript
  // 2. Title
  drawTitle(w);

  // 3. Introduction
  drawIntroduction(w);
```

Заменить на:
```typescript
  // 2. Title
  drawTitle(w);

  // 2b. Project info block
  if (projectInfo.complexName || projectInfo.address || projectInfo.phone) {
    drawProjectInfo(w, projectInfo);
  }

  // 3. Introduction
  drawIntroduction(w);
```

- [ ] **Step 4.4: Изменить конец функции — убрать `pdf.save`, вернуть blob**

Найти в конце функции строку вида:
```typescript
  pdf.save(`Фин_Модель_${dateStr}.pdf`);
}
```

(Точное имя файла может отличаться — найти последний вызов `pdf.save` в функции `downloadFinModelPDF`.)

Заменить на:
```typescript
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const filename = `Финансовая_Модель_${dateStr}.pdf`;
  const blob = pdf.output('blob');
  return { blob, filename };
}
```

> Если `pdf.save(...)` уже использует `dateStr` — просто убрать `pdf.save(...)` и добавить `return { blob: pdf.output('blob'), filename }` с тем же именем файла, что было.

- [ ] **Step 4.5: Проверить TypeScript**

```bash
npx tsc --noEmit
```

Ожидаемый вывод: ошибки только в `Step5Result.tsx`.

- [ ] **Step 4.6: Commit**

```bash
git add src/widgets/calculator/generateFinModelPDF.ts
git commit -m "feat(pdf): generateFinModelPDF accepts projectInfo, returns blob instead of saving"
```

---

## Task 5: Frontend — обновить `Step5Result.tsx`

**Files:**
- Modify: `src/components/calculator/steps/Step5Result.tsx`

Цель: убрать кнопку «Отправить на почту» и старый модал, добавить `projectInfo` состояние с sessionStorage, новый объединённый модал.

- [ ] **Step 5.1: Обновить импорты**

Найти строку:
```typescript
import { submitLead } from '@/shared/api/leadApi';
```

Заменить на:
```typescript
import { sendKPByEmail } from '@/shared/api/leadApi';
```

- [ ] **Step 5.2: Добавить интерфейс и функцию-помощник для sessionStorage**

Сразу после всех импортов (перед `function buildSummaryText`) добавить:

```typescript
interface ProjectInfo {
  complexName: string;
  address: string;
  phone: string;
  email: string;
}

const SESSION_KEY = 'kp_project_info';

function loadProjectInfo(): ProjectInfo {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) return JSON.parse(saved) as ProjectInfo;
  } catch { /* ignore */ }
  return { complexName: '', address: '', phone: '', email: '' };
}

function saveProjectInfo(info: ProjectInfo): void {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(info)); } catch { /* ignore */ }
}
```

- [ ] **Step 5.3: Заменить состояния старого модала на новые**

Найти блок состояний:
```typescript
  const [modalOpen, setModalOpen] = useState(false);
  const [submitName, setSubmitName] = useState('');
  const [submitPhone, setSubmitPhone] = useState('');
  const [submitEmail, setSubmitEmail] = useState('');
  const [submitSending, setSubmitSending] = useState(false);
```

Заменить на:
```typescript
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>(loadProjectInfo);
  const [downloadType, setDownloadType] = useState<'kpfull' | 'finmodel' | null>(null);
  const [projectInfoSending, setProjectInfoSending] = useState(false);

  const updateProjectInfo = (patch: Partial<ProjectInfo>) => {
    setProjectInfo(prev => {
      const next = { ...prev, ...patch };
      saveProjectInfo(next);
      return next;
    });
  };

  const isProjectInfoValid =
    projectInfo.complexName.trim().length >= 2 &&
    projectInfo.address.trim().length >= 5 &&
    /^\+?[0-9\s\-()+]{7,}$/.test(projectInfo.phone.trim()) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(projectInfo.email.trim());
```

- [ ] **Step 5.4: Заменить `handleEmail`, `handleSubmitRequest`, `handleDocx`, `handleFinModel`**

Найти весь блок:
```typescript
  const handleReset = () => { ... };

  const handleEmail = () => setModalOpen(true);

  const handleSubmitRequest = async () => { ... };

  const handleDocx = async () => { ... };

  const handleFinModel = async () => { ... };
```

Заменить на:
```typescript
  const handleReset = () => {
    if (window.confirm('Сбросить все данные и начать заново?')) {
      reset();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleProjectInfoSubmit = async () => {
    if (!isProjectInfoValid || !downloadType) return;
    setProjectInfoSending(true);
    try {
      let blob: Blob;
      let filename: string;

      if (downloadType === 'kpfull') {
        const { generateKPFullPDF } = await import('@/widgets/calculator/generateKPFullPDF');
        const out = await generateKPFullPDF(
          result,
          intercomDirty ? intercomResult : null,
          { apartments: effectiveFlats, installmentMonths, downPayment },
          { complexName: projectInfo.complexName, address: projectInfo.address, phone: projectInfo.phone }
        );
        blob = out.blob;
        filename = out.filename;
      } else {
        const { generateFinModelPDF } = await import('@/widgets/calculator/generateFinModelPDF');
        const out = await generateFinModelPDF(
          result,
          intercomDirty ? intercomResult : null,
          { apartments: effectiveFlats, downPayment, installmentMonths },
          { complexName: projectInfo.complexName, address: projectInfo.address, phone: projectInfo.phone }
        );
        blob = out.blob;
        filename = out.filename;
      }

      // base64
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Send to backend
      await sendKPByEmail({
        complexName: projectInfo.complexName,
        address: projectInfo.address,
        phone: projectInfo.phone,
        email: projectInfo.email,
        documentType: downloadType,
        pdfBase64,
        fileName: filename,
      });

      // Download locally
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      show(`Расчёт отправлен на ${projectInfo.email}`);
      setDownloadType(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка отправки. Попробуйте позже.';
      show(msg, 'error');
    } finally {
      setProjectInfoSending(false);
    }
  };
```

- [ ] **Step 5.5: Обновить кнопки в JSX**

Найти блок:
```tsx
        <div className={styles.actionsRight}>
          <GlowButton variant="secondary" onClick={handleEmail}>
            Отправить на почту
          </GlowButton>
          <GlowButton variant="primary" onClick={handleDocx} disabled={(!result && !intercomDirty) || exporting === 'kpfull'}>
            {exporting === 'kpfull' ? 'Генерация…' : 'КП полное .pdf'}
          </GlowButton>
          <GlowButton variant="secondary" onClick={handleFinModel} disabled={(!result && !intercomDirty) || exporting === 'finmodel'}>
            {exporting === 'finmodel' ? 'Генерация…' : 'Финансовая модель .pdf'}
          </GlowButton>
```

Заменить на:
```tsx
        <div className={styles.actionsRight}>
          <GlowButton
            variant="primary"
            onClick={() => setDownloadType('kpfull')}
            disabled={!result && !intercomDirty}
          >
            КП полное .pdf
          </GlowButton>
          <GlowButton
            variant="secondary"
            onClick={() => setDownloadType('finmodel')}
            disabled={!result && !intercomDirty}
          >
            Финансовая модель .pdf
          </GlowButton>
```

Также удалить переменную `exporting` и `setExporting` (больше не нужна).

- [ ] **Step 5.6: Заменить старый модал на новый**

Найти весь блок старого модала:
```tsx
      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => !submitSending && setModalOpen(false)}>
          <motion.div
            ...
          </motion.div>
        </div>
      )}
```

Заменить на:
```tsx
      {downloadType !== null && (
        <div
          className={styles.modalOverlay}
          onClick={() => !projectInfoSending && setDownloadType(null)}
        >
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={styles.modalTitle}>
              {downloadType === 'kpfull'
                ? 'Получить Коммерческое предложение'
                : 'Получить Финансовую модель'}
            </h3>
            <p className={styles.modalDesc}>
              Заполните данные объекта — подготовим документ и пришлём на почту.
            </p>
            <div className={styles.modalForm}>
              <div className={styles.inputGroup}>
                <label htmlFor="pi-complex" className={styles.inputLabel}>Название ЖК *</label>
                <input
                  id="pi-complex"
                  type="text"
                  className={styles.modalInput}
                  value={projectInfo.complexName}
                  onChange={(e) => updateProjectInfo({ complexName: e.target.value })}
                  placeholder="ЖК «Солнечный»"
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="pi-address" className={styles.inputLabel}>Адрес объекта *</label>
                <input
                  id="pi-address"
                  type="text"
                  className={styles.modalInput}
                  value={projectInfo.address}
                  onChange={(e) => updateProjectInfo({ address: e.target.value })}
                  placeholder="г. Астана, ул. Примерная, 1"
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="pi-phone" className={styles.inputLabel}>Телефон *</label>
                <input
                  id="pi-phone"
                  type="tel"
                  className={styles.modalInput}
                  value={projectInfo.phone}
                  onChange={(e) => updateProjectInfo({ phone: e.target.value })}
                  placeholder="+7 700 000 00 00"
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="pi-email" className={styles.inputLabel}>Email *</label>
                <input
                  id="pi-email"
                  type="email"
                  className={styles.modalInput}
                  value={projectInfo.email}
                  onChange={(e) => updateProjectInfo({ email: e.target.value })}
                  placeholder="manager@example.com"
                />
                <span className={styles.inputHint}>
                  Укажите почту — продублируем расчёт, чтобы не потерять
                </span>
              </div>
              <div className={styles.modalButtons}>
                <GlowButton
                  variant="ghost"
                  onClick={() => setDownloadType(null)}
                  disabled={projectInfoSending}
                >
                  Отмена
                </GlowButton>
                <GlowButton
                  onClick={handleProjectInfoSubmit}
                  disabled={!isProjectInfoValid || projectInfoSending}
                >
                  {projectInfoSending ? 'Отправка…' : 'Получить расчёт на почту и скачать'}
                </GlowButton>
              </div>
            </div>
          </motion.div>
        </div>
      )}
```

- [ ] **Step 5.7: Добавить стиль `inputHint` в `Step5Result.module.css`**

Добавить в конец файла `src/components/calculator/steps/Step5Result.module.css`:

```css
.inputHint {
  display: block;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 4px;
}
```

- [ ] **Step 5.8: Убрать неиспользуемые импорты и переменные**

- Убрать импорт `submitLead` (заменили на `sendKPByEmail`)
- Убрать импорт `calculatorContact` (больше не используется в модале)
- Убрать переменную `exporting` и `setExporting` (если осталась)
- Убрать функцию `buildSummaryText` (больше не используется)

Проверить командой:
```bash
npx tsc --noEmit
```

Ожидаемый вывод: **0 ошибок**.

- [ ] **Step 5.9: Проверить локально в браузере**

```bash
npm run dev
```

1. Открыть `http://localhost:5173/calculator`
2. Заполнить параметры объекта (любые данные)
3. Нажать «КП полное .pdf»
4. Убедиться что открылся модал с заголовком «Получить Коммерческое предложение»
5. Заполнить все поля → кнопка «Получить расчёт на почту и скачать» становится активной
6. Кнопка неактивна при невалидном email (проверить)
7. Перезагрузить страницу → поля в модале предзаполнены из sessionStorage

Отправку по email проверять только при работающем бэкенде (`npm run dev:apisite`).

- [ ] **Step 5.10: Commit**

```bash
git add src/components/calculator/steps/Step5Result.tsx src/components/calculator/steps/Step5Result.module.css
git commit -m "feat(calculator): unified KP download modal with project info, email delivery, sessionStorage"
```

---

## Task 6: Финальная проверка и интеграционный тест

- [ ] **Step 6.1: Запустить полный стек**

```bash
npm run dev:all
```

Убедиться что стартуют: `localhost:5173` (React), `localhost:8001` (FastAPI).

- [ ] **Step 6.2: Сквозной тест флоу**

1. Открыть `http://localhost:5173/calculator`
2. Заполнить параметры CCTV (подъезды, этажи, лифты)
3. Нажать «КП полное .pdf»
4. В модале: `complexName = "Тест ЖК"`, `address = "г. Астана, ул. Тестовая, 1"`, `phone = "+7 700 111 22 33"`, `email = <реальный email для теста>`
5. Нажать «Получить расчёт на почту и скачать»
6. Проверить:
   - Кнопка превращается в «Отправка…»
   - Модал закрывается
   - PDF скачивается
   - Тост «Расчёт отправлен на <email>»
   - PDF открыть — убедиться что блок «ЖК Тест ЖК / Адрес / Контакт» присутствует под заголовком КП
   - На email клиента пришло письмо с PDF вложением
   - На ADMIN_EMAIL пришла копия

- [ ] **Step 6.3: Финальный build-check**

```bash
npm run build
```

Ожидаемый вывод: успешный build без TypeScript-ошибок.

- [ ] **Step 6.4: Финальный commit**

```bash
git add -A
git commit -m "feat: complete KP email delivery — project info modal, PDF injection, SMTP dispatch"
```

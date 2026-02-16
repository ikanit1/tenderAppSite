import { getCatalogUrl } from '@/shared/utils/catalogUrl';

export interface LeadPayload {
  name: string;
  phone: string;
  email?: string;
  projectType?: string;
  message?: string;
  [key: string]: unknown;
}

export async function submitLead(payload: LeadPayload): Promise<{ success: boolean }> {
  const base = getCatalogUrl();
  const url = `${base}/api/contacts/submit`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = typeof data.detail === 'string' ? data.detail : 'Ошибка отправки. Попробуйте позже.';
    throw new Error(detail);
  }

  return { success: true };
}

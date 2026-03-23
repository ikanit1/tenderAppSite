import { getInitData } from './telegram';
import type { User, Tender, Application, Applicant, SupportTicket, SupportTicketDetail } from './types';

const API_BASE = '/miniapp';

const ERROR_MAP: Record<string, string> = {
  init_data_missing: 'Откройте приложение из меню бота (☰).',
  init_data_invalid: 'Сессия устарела. Закройте и откройте снова.',
  user_not_found: 'Пройдите регистрацию в боте.',
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const initData = getInitData();
  const base = path.startsWith('http') ? path : API_BASE + path;
  const url = initData
    ? base + (base.includes('?') ? '&' : '?') + 'init_data=' + encodeURIComponent(initData)
    : base;

  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData,
      'ngrok-skip-browser-warning': '1',
      ...(init.headers as Record<string, string> | undefined),
    },
  });

  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    const detail = data.detail;
    let msg = 'Ошибка запроса';
    if (typeof detail === 'string') msg = ERROR_MAP[detail] ?? detail;
    else if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') msg = detail[0].msg;
    throw new Error(msg);
  }
  return data as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined });
const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

// ——— User ———
export const apiMe = () => get<User>('/api/me');
export const apiProfile = () => get<User>('/api/profile');
export const apiUpdateProfile = (data: { full_name?: string; city?: string; phone?: string; skills?: string[] }) =>
  patch<{ ok: boolean }>('/api/profile', data);

// ——— Config ———
export const apiSkills = () => get<{ skills: string[] }>('/api/skills');
export const apiCities = () => get<{ cities: string[] }>('/api/cities');

// ——— Tenders (executor) ———
export const apiTenders = () => get<{ tenders: Tender[] }>('/api/tenders');
export const apiTenderDetail = (id: number) => get<Tender>(`/api/tenders/${id}`);
export const apiApply = (tenderId: number) =>
  post<{ ok: boolean; application_id: number }>(`/api/tenders/${tenderId}/apply`);

// ——— Applications (executor) ———
export const apiApplications = () => get<{ applications: Application[] }>('/api/applications');
export const apiApplicationDetail = (id: number) => get<Application>(`/api/applications/${id}`);

// ——— Support ———
export const apiSupportTickets = () => get<{ tickets: SupportTicket[] }>('/api/support/tickets');
export const apiSupportTicketDetail = (id: number) =>
  get<SupportTicketDetail>(`/api/support/tickets/${id}`);
export const apiCreateTicket = () => post<{ id: number; created: boolean }>('/api/support/tickets', {});
export const apiSendMessage = (ticketId: number, payload: { text?: string; image_base64?: string }) =>
  post('/api/support/tickets/' + ticketId + '/messages', payload);
export const apiCloseTicket = (ticketId: number) =>
  post<{ ok: boolean }>(`/api/support/tickets/${ticketId}/close`);

// ——— Customer endpoints ———
export const apiMyTenders = () => get<{ tenders: Tender[] }>('/api/customer/tenders');
export const apiCreateTender = (data: {
  title: string;
  categories: string[];
  city: string;
  budget?: string;
  description: string;
  deadline?: string;
}) => post<Tender>('/api/customer/tenders', data);
export const apiTenderApplicants = (tenderId: number) =>
  get<{ applications: Applicant[] }>(`/api/customer/tenders/${tenderId}/applications`);
export const apiSelectApplicant = (applicationId: number) =>
  post<{ ok: boolean }>(`/api/customer/applications/${applicationId}/select`);
export const apiRejectApplicant = (applicationId: number) =>
  post<{ ok: boolean }>(`/api/customer/applications/${applicationId}/reject`);

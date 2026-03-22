export interface LeadPayload {
  name: string;
  phone: string;
  email?: string;
  projectType?: string;
  message?: string;
  /** Доп. поля для калькулятора и т.д. */
  [key: string]: unknown;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const randomDelay = () => delay(600 + Math.floor(Math.random() * 600));

export async function submitLead(payload: LeadPayload): Promise<{ success: boolean }> {
  await randomDelay();
  if (import.meta.env.DEV) {
    console.log('[mock] submitLead', payload);
  }
  return { success: true };
}

export interface LeadFormData {
  name: string;
  phone: string;
  email?: string;
  projectType?: string;
  message?: string;
  [key: string]: unknown;
}

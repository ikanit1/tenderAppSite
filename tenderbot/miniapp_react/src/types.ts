export interface User {
  id: number;
  tg_id: number;
  full_name: string;
  city: string;
  phone: string;
  role: 'executor' | 'customer' | 'both';
  status: 'pending_moderation' | 'active' | 'banned';
  skills: string[];
  birth_date: string | null;
  created_at: string | null;
}

export interface Tender {
  id: number;
  title: string;
  category: string;
  city: string;
  budget: string | null;
  description: string;
  status: 'draft' | 'open' | 'in_progress' | 'closed' | 'cancelled';
  deadline: string | null;
  has_applied: boolean;
  application_id?: number | null;
  application_status?: string | null;
  applications_count?: number;
}

export interface Application {
  id: number;
  tender_id: number;
  tender_title: string;
  tender_city: string;
  tender_category: string;
  tender_budget: string | null;
  tender_description: string;
  status: 'applied' | 'selected' | 'rejected';
  created_at: string | null;
}

export interface Applicant {
  id: number;
  user_id: number;
  full_name: string;
  city: string;
  phone: string;
  skills: string[];
  status: 'applied' | 'selected' | 'rejected';
  created_at: string | null;
}

export interface SupportTicket {
  id: number;
  status: 'new' | 'in_progress' | 'closed';
  created_at: string | null;
  updated_at?: string | null;
  last_preview?: string | null;
}

export interface SupportMessage {
  id: number;
  author: 'user' | 'admin';
  text: string;
  image_url: string | null;
  created_at: string | null;
}

export interface SupportTicketDetail extends SupportTicket {
  messages: SupportMessage[];
}

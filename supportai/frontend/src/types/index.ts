// Global type definitions for SupportAI

export interface User {
  id: number;
  email: string;
  name: string;
  phone?: string;
  role: 'CUSTOMER' | 'AGENT' | 'SUPERVISOR' | 'ADMIN';
  is_active: boolean;
  is_online: boolean;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export type TicketStatus =
  | 'CREATED'
  | 'AI_ASSISTING'
  | 'WAITING_FOR_CUSTOMER'
  | 'CUSTOMER_NOT_SATISFIED'
  | 'ESCALATION_REQUESTED'
  | 'WAITING_FOR_AGENT'
  | 'AGENT_ASSIGNED'
  | 'HUMAN_AGENT_ACTIVE'
  | 'AI_RESOLVED'
  | 'RESOLVED'
  | 'REOPENED'
  | 'CLOSED';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type TicketCategory =
  | 'Technical Issue'
  | 'Internet Problem'
  | 'Billing Problem'
  | 'Payment Problem'
  | 'Refund'
  | 'Account Problem'
  | 'Password'
  | 'Order'
  | 'Delivery'
  | 'Subscription'
  | 'Cancellation'
  | 'Product Information'
  | 'Complaint'
  | 'Feedback'
  | 'Other';

export interface AIAnalysis {
  id: number;
  sentiment_label: string;
  sentiment_score: number;
  intent_label: string;
  intent_score: number;
  urgency_label: string;
  urgency_score: number;
  escalation_risk_level: string;
  escalation_risk_score: number;
  key_issue?: string;
  recommended_action?: string;
  created_at: string;
}

export interface SolutionAttempt {
  id: number;
  attempt_number: number;
  solution_summary: string;
  result: 'PENDING' | 'SUCCESS' | 'FAILED';
  created_at: string;
}

export interface TicketEvent {
  id: number;
  event_type: string;
  description?: string;
  created_at: string;
}

export interface Message {
  id: number;
  ticket_id: number;
  sender_type: 'CUSTOMER' | 'AI' | 'AGENT' | 'SYSTEM';
  sender_id?: number;
  content: string;
  is_internal: boolean;
  created_at: string;
  sender?: User;
}

export interface Ticket {
  id: number;
  public_token: string;
  customer_id: number;
  assigned_agent_id?: number;
  title: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  ai_attempt_count: number;
  escalation_reason?: string;
  order_id?: string;
  satisfaction_rating?: number;
  satisfaction_comment?: string;
  was_resolved?: boolean;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  closed_at?: string;
  customer?: User;
  assigned_agent?: User;
  analyses: AIAnalysis[];
  solution_attempts: SolutionAttempt[];
  events: TicketEvent[];
}

export interface AgentNote {
  id: number;
  content: string;
  agent?: User;
  created_at: string;
}

export interface KnowledgeArticle {
  id: number;
  title: string;
  category: string;
  problem_description: string;
  solution: string;
  steps?: string;
  keywords?: string;
  is_active: boolean;
}

export interface AnalyticsOverview {
  total_tickets: number;
  active_tickets: number;
  waiting_for_agent: number;
  resolved: number;
  closed: number;
  ai_resolved: number;
  reopened: number;
  escalated: number;
  ai_resolution_rate: number;
  human_escalation_rate: number;
  avg_satisfaction: number;
  sentiment_distribution: Record<string, number>;
  category_distribution: Record<string, number>;
  daily_tickets: Array<{ date: string; count: number }>;
}

// WebSocket message types
export interface WSMessage {
  type: string;
  [key: string]: any;
}

export interface ChatMessage {
  id: string | number;
  sender_type: 'CUSTOMER' | 'AI' | 'AGENT' | 'SYSTEM';
  sender_name?: string;
  content: string;
  created_at: string;
  is_internal?: boolean;
}

export interface AgentCopilot {
  mood_comment: string;
  urgency_note: string;
  suggested_response: string;
  next_action: string;
  knowledge_article: string;
}

// Voice Support Types
export type VoiceCallState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'processing'
  | 'ai_speaking'
  | 'customer_speaking'
  | 'escalating'
  | 'human_connected'
  | 'ended'
  | 'error';

export interface VoiceSession {
  id: number;
  ticket_id: number;
  started_at: string;
  ended_at?: string;
  duration: number;
  language: string;
  status: 'ACTIVE' | 'ESCALATED' | 'ENDED' | 'FAILED';
  recording_enabled: boolean;
  metrics?: string;
}

export interface VoiceTranscriptItem {
  id: string | number;
  voice_session_id?: number;
  ticket_id: number;
  speaker: 'customer' | 'ai' | 'agent' | 'system';
  text: string;
  confidence?: number;
  timestamp: string;
  is_final: boolean;
}

export interface VoiceLanguageOption {
  code: string;
  label: string;
  flag?: string;
}


import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { isTokenValid } from '../utils/token';

const getApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    const cleanUrl = envUrl.replace(/\/$/, '');
    return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
  }
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return `http://${window.location.hostname}:8000/api`;
  }
  return '/api';
};


const api = axios.create({
  baseURL: getApiBase(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests (only if still valid)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('support_token') || useAuthStore.getState().token;
  if (token) {
    if (isTokenValid(token)) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      // Token expired, clear auth immediately to prevent 401 cycle
      try {
        useAuthStore.getState().logout();
      } catch {}
      localStorage.removeItem('support_token');
      localStorage.removeItem('support_user');
      localStorage.removeItem('supportai-auth');
    }
  }
  return config;
});

// Prevent rapid multi-redirect loops
let isRedirecting = false;

// Handle 401 unauthorized safely without reload loops
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/logout');

    if (error.response?.status === 401 && !isAuthRoute) {
      try {
        useAuthStore.getState().logout();
      } catch {
        localStorage.removeItem('support_token');
        localStorage.removeItem('support_user');
        localStorage.removeItem('supportai-auth');
      }

      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        if (currentPath !== '/login' && currentPath !== '/' && currentPath !== '/register' && !isRedirecting) {
          isRedirecting = true;
          setTimeout(() => { isRedirecting = false; }, 5000);
          window.location.replace('/login');
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const authAPI = {
  register: (data: { name: string; email: string; phone?: string; password: string; role?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  listUsers: () => api.get('/auth/users'),
  logout: () => api.post('/auth/logout'),
};

// Tickets
export const ticketsAPI = {
  create: (data: { title: string; description: string; category?: string; order_id?: string }) =>
    api.post('/tickets', data),
  list: (status?: string) =>
    api.get('/tickets', { params: status ? { status_filter: status } : {} }),
  getById: (id: number) => api.get(`/tickets/${id}`),
  getByToken: (token: string) => api.get(`/tickets/token/${token}`),
  getAnalysis: (id: number) => api.get(`/tickets/${id}/analysis`),
  escalate: (id: number, reason?: string) =>
    api.post(`/tickets/${id}/escalate`, { reason }),
  assign: (id: number) => api.post(`/tickets/${id}/assign`),
  resolve: (id: number) => api.post(`/tickets/${id}/resolve`),
  reopen: (id: number) => api.post(`/tickets/${id}/reopen`),
  satisfaction: (id: number, data: { rating?: number; comment?: string; was_resolved: boolean }) =>
    api.post(`/tickets/${id}/satisfaction`, data),
  addNote: (id: number, content: string) =>
    api.post(`/tickets/${id}/notes`, { content }),
  getNotes: (id: number) => api.get(`/tickets/${id}/notes`),
};

// Messages
export const messagesAPI = {
  getForTicket: (ticketId: number, includeInternal = false) =>
    api.get(`/messages/ticket/${ticketId}`, { params: { include_internal: includeInternal } }),
};

// Agents
export const agentsAPI = {
  getQueue: () => api.get('/agents/queue'),
  getMyTickets: () => api.get('/agents/my-tickets'),
  listAgents: () => api.get('/agents/list'),
};

// Analytics
export const analyticsAPI = {
  getOverview: () => api.get('/analytics/overview'),
  getAgentPerformance: () => api.get('/analytics/agent-performance'),
};

// Knowledge Base
export const knowledgeAPI = {
  list: () => api.get('/knowledge-base'),
  create: (data: any) => api.post('/knowledge-base', data),
  update: (id: number, data: any) => api.put(`/knowledge-base/${id}`, data),
  delete: (id: number) => api.delete(`/knowledge-base/${id}`),
};

// Voice API
export const voiceAPI = {
  startSession: (ticketId: number, language = 'en-US') =>
    api.post('/voice/session', { ticket_id: ticketId, language }),
  getSession: (sessionId: number) => api.get(`/voice/session/${sessionId}`),
  endSession: (sessionId: number, metrics?: any) =>
    api.post(`/voice/session/${sessionId}/end`, { status: 'ENDED', metrics }),
  getTranscripts: (ticketId: number) => api.get(`/voice/transcript/${ticketId}`),
};


import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { ticketsAPI, messagesAPI } from '../../services/api';
import wsService from '../../services/websocket';
import {
  Ticket,
  ChatMessage,
  AgentCopilot,
  AgentNote,
  AIAnalysis,
} from '../../types';
import MessageBubble, { TypingIndicator } from '../../components/MessageBubble';
import AgentSidebar from '../../components/agent/AgentSidebar';
import {
  Send,
  CheckCircle,
  AlertTriangle,
  Bot,
  User,
  Copy,
  Check,
  FileText,
  Sparkles,
  Wifi,
  WifiOff,
  ArrowLeft,
  Lock,
  Plus,
  Flame,
  Lightbulb,
  BookOpen,
} from 'lucide-react';

export default function AgentTicketPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notes, setNotes] = useState<AgentNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [inputText, setInputText] = useState('');
  const [copilot, setCopilot] = useState<AgentCopilot | null>(null);
  const [handoffSummary, setHandoffSummary] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'disconnected' | 'reconnecting'
  >('disconnected');
  const [copiedCopilot, setCopiedCopilot] = useState(false);
  const [submittingNote, setSubmittingNote] = useState(false);
  const [activeTab, setActiveTab] = useState<'copilot' | 'handoff' | 'notes'>('copilot');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Load ticket, messages, and notes
  const loadTicketData = async () => {
    if (!id) return;
    try {
      const [tRes, mRes, nRes] = await Promise.all([
        ticketsAPI.getById(Number(id)),
        messagesAPI.getForTicket(Number(id), true),
        ticketsAPI.getNotes(Number(id)),
      ]);

      const tData: Ticket = tRes.data;
      setTicket(tData);
      setNotes(nRes.data);

      const mapped: ChatMessage[] = mRes.data.map((m: any) => ({
        id: m.id,
        sender_type: m.sender_type,
        sender_name:
          m.sender_type === 'AI'
            ? 'AI Assistant'
            : m.sender?.name || (m.sender_type === 'AGENT' ? 'Support Agent' : 'Customer'),
        content: m.content,
        created_at: m.created_at,
        is_internal: m.is_internal,
      }));
      setMessages(mapped);

      // Default handoff summary from ticket if available
      const latest = tData.analyses?.[tData.analyses.length - 1];
      const solutionsText = tData.solution_attempts
        .map((s) => `${s.attempt_number}. ${s.solution_summary} — ${s.result}`)
        .join('\n');

      setHandoffSummary(
        `## AI Handoff Summary\n\n**Issue:** ${tData.title}\n**Customer:** ${
          tData.customer?.name ?? 'Customer'
        }\n\n### Analysis\n- Sentiment: ${latest?.sentiment_label ?? 'N/A'}\n- Intent: ${
          latest?.intent_label ?? 'N/A'
        }\n- Urgency: ${latest?.urgency_label ?? 'N/A'}\n- Escalation Risk: ${
          latest?.escalation_risk_score ?? 'N/A'
        }%\n\n### Attempted Solutions\n${solutionsText || 'No prior attempts'}\n\n**Recommended Action:** ${
          latest?.recommended_action || 'Review account and assist customer directly.'
        }`
      );

      // Initialize copilot suggestion
      setCopilot({
        mood_comment:
          latest?.sentiment_label === 'NEGATIVE'
            ? `${tData.customer?.name ?? 'Customer'} appears frustrated. Empathize and confirm you are here to help.`
            : 'Customer is waiting for assistance. Be clear and helpful.',
        urgency_note: `${tData.priority} urgency ticket. Please address promptly.`,
        suggested_response: `Hi ${
          tData.customer?.name ?? 'there'
        }, I've reviewed the troubleshooting steps you've already tried. I'll personally help you get this resolved right now.`,
        next_action: latest?.recommended_action || 'Diagnose the issue with the customer.',
        knowledge_article: tData.category || 'General Support Guidelines',
      });
    } catch (err) {
      console.error('Failed to load ticket for agent:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicketData();
  }, [id]);

  // WebSocket Connection
  useEffect(() => {
    if (!id) return;

    const handleMessage = (data: any) => {
      switch (data.type) {
        case 'customer_message':
          setMessages((prev) => [
            ...prev,
            {
              id: data.id || `cm_${Date.now()}`,
              sender_type: 'CUSTOMER',
              sender_name: data.sender_name || 'Customer',
              content: data.content,
              created_at: data.created_at || new Date().toISOString(),
            },
          ]);
          break;
        case 'agent_message':
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.id)) return prev;
            return [
              ...prev,
              {
                id: data.id || `am_${Date.now()}`,
                sender_type: 'AGENT',
                sender_name: data.sender_name || 'Support Agent',
                content: data.content,
                created_at: data.created_at || new Date().toISOString(),
              },
            ];
          });
          break;
        case 'ai_message':
          setMessages((prev) => [
            ...prev,
            {
              id: data.id || `ai_${Date.now()}`,
              sender_type: 'AI',
              sender_name: 'AI Assistant',
              content: data.content,
              created_at: data.created_at || new Date().toISOString(),
            },
          ]);
          break;
        case 'typing':
          setIsTyping(data.sender === 'customer');
          break;
        case 'copilot_update':
          if (data.copilot) setCopilot(data.copilot);
          break;
        case 'handoff_summary':
          if (data.summary) setHandoffSummary(data.summary);
          if (data.copilot) setCopilot(data.copilot);
          break;
        case 'system':
          setMessages((prev) => [
            ...prev,
            {
              id: `sys_${Date.now()}`,
              sender_type: 'SYSTEM',
              content: data.message || '',
              created_at: new Date().toISOString(),
            },
          ]);
          break;
        case 'escalation':
          setMessages((prev) => [
            ...prev,
            {
              id: `sys_${Date.now()}`,
              sender_type: 'SYSTEM',
              content: data.message || 'Customer requested human agent escalation.',
              created_at: new Date().toISOString(),
            },
          ]);
          setTicket((prev) => (prev ? { ...prev, status: 'WAITING_FOR_AGENT' } : null));
          break;
        case 'ticket_status':
          setTicket((prev) => (prev ? { ...prev, status: data.status } : null));
          break;
        case 'ticket_resolved':
          setTicket((prev) => (prev ? { ...prev, status: 'RESOLVED' } : null));
          break;
      }
    };

    wsService.addHandler(handleMessage);
    wsService.connect(Number(id), setConnectionStatus);

    return () => {
      wsService.removeHandler(handleMessage);
      wsService.disconnect();
    };
  }, [id]);

  // Accept ticket
  const handleAcceptTicket = async () => {
    try {
      await ticketsAPI.assign(Number(id));
      wsService.send({ type: 'accept_ticket' });
      setTicket((prev) => (prev ? { ...prev, status: 'HUMAN_AGENT_ACTIVE' } : null));
    } catch (err) {
      console.error('Failed to assign ticket:', err);
    }
  };

  // Resolve ticket
  const handleResolveTicket = async () => {
    try {
      await ticketsAPI.resolve(Number(id));
      wsService.send({ type: 'resolve_ticket' });
      setTicket((prev) => (prev ? { ...prev, status: 'RESOLVED' } : null));
    } catch (err) {
      console.error('Failed to resolve ticket:', err);
    }
  };

  // Send message
  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    const content = inputText.trim();
    setInputText('');

    wsService.send({
      type: 'agent_message',
      content,
    });
  };

  // Add internal note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || submittingNote) return;

    setSubmittingNote(true);
    try {
      const res = await ticketsAPI.addNote(Number(id), newNote.trim());
      setNotes((prev) => [...prev, res.data]);
      setNewNote('');
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setSubmittingNote(false);
    }
  };

  // Use Copilot response
  const handleUseCopilotResponse = () => {
    if (copilot?.suggested_response) {
      setInputText(copilot.suggested_response);
      inputRef.current?.focus();
    }
  };

  const handleCopyCopilot = () => {
    if (copilot?.suggested_response) {
      navigator.clipboard.writeText(copilot.suggested_response);
      setCopiedCopilot(true);
      setTimeout(() => setCopiedCopilot(false), 2000);
    }
  };

  const isAssignedToMe = ticket?.assigned_agent_id === user?.id;
  const isTicketClosed = ticket?.status === 'CLOSED' || ticket?.status === 'RESOLVED';
  const latestAnalysis = ticket?.analyses?.[ticket.analyses.length - 1];

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#F8F8F8]">
        <AgentSidebar />
        <div className="flex-1 flex items-center justify-center text-gray-400">
          Loading agent console...
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex min-h-screen bg-[#F8F8F8]">
        <AgentSidebar />
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <AlertTriangle size={36} className="text-orange-500 mb-2" />
          <h2 className="text-lg font-bold text-[#111111]">Ticket Not Found</h2>
          <Link to="/agent/queue" className="mt-4 btn-primary text-sm py-2 px-4">
            Back to Queue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8F8F8] overflow-hidden">
      <AgentSidebar />

      {/* Main 2-Column Console */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top Action Header */}
        <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => navigate('/agent/queue')}
              className="p-1.5 rounded-lg text-gray-400 hover:text-black hover:bg-gray-100 transition-all"
              title="Back to queue"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                  {ticket.public_token}
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    ticket.status === 'HUMAN_AGENT_ACTIVE'
                      ? 'bg-green-100 text-green-800'
                      : ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
                      ? 'bg-gray-100 text-gray-700'
                      : 'bg-orange-100 text-orange-800'
                  }`}
                >
                  {ticket.status.replace(/_/g, ' ')}
                </span>
              </div>
              <h2 className="text-sm font-bold text-[#111111] truncate mt-0.5">
                {ticket.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Indicator */}
            {connectionStatus === 'connected' ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                <Wifi size={12} className="text-green-600" />
                Live Chat
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                <WifiOff size={12} />
                Connecting...
              </span>
            )}

            {/* Accept / Resolve Actions */}
            {ticket.status === 'WAITING_FOR_AGENT' ||
            ticket.status === 'ESCALATION_REQUESTED' ? (
              <button
                onClick={handleAcceptTicket}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5"
              >
                <Check size={14} />
                Accept & Join Chat
              </button>
            ) : !isTicketClosed ? (
              <button
                onClick={handleResolveTicket}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5"
              >
                <CheckCircle size={14} />
                Resolve Ticket
              </button>
            ) : (
              <span className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg flex items-center gap-1">
                <CheckCircle size={13} className="text-green-600" />
                Resolved
              </span>
            )}
          </div>
        </header>

        {/* Center Workspace: Chat (Left) + AI Copilot / Handoff / Notes (Right) */}
        <div className="flex-1 flex min-h-0">
          {/* Chat Window Column */}
          <section className="flex-1 flex flex-col bg-white border-r border-gray-200 min-w-0">
            {/* Customer Details Ribbon */}
            <div className="px-6 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-xs text-gray-600 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-[10px]">
                  {ticket.customer?.name?.charAt(0) ?? 'C'}
                </div>
                <span>
                  Customer: <strong>{ticket.customer?.name ?? 'Unknown'}</strong> (
                  {ticket.customer?.email})
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span>
                  Category: <strong>{ticket.category}</strong>
                </span>
                <span>
                  Priority: <strong>{ticket.priority}</strong>
                </span>
              </div>
            </div>

            {/* Chat Stream */}
            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isOwnMessage={m.sender_type === 'AGENT'}
                />
              ))}

              {isTyping && <TypingIndicator who="Customer" />}
              <div ref={messagesEndRef} />
            </div>

            {/* Agent Input Bar */}
            <div className="p-4 border-t border-gray-200 bg-white flex-shrink-0">
              {!isTicketClosed ? (
                <div>
                  <div className="flex gap-2">
                    <textarea
                      ref={inputRef}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Type your message to the customer... (Enter to send, Shift+Enter for newline)"
                      rows={2}
                      className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-[#111111] focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none transition-all"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!inputText.trim()}
                      className="px-5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-lg flex items-center justify-center transition-all shadow-sm active:scale-95"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
                    <span>
                      {ticket.status === 'HUMAN_AGENT_ACTIVE'
                        ? '🟢 Real-time connection active. Messages are delivered instantly.'
                        : '⚠️ Click "Accept & Join Chat" above to activate live conversation.'}
                    </span>
                    <span className="font-mono">Shift + Enter for new line</span>
                  </div>
                </div>
              ) : (
                <div className="py-3 text-center text-sm font-semibold text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                  This ticket has been marked as {ticket.status.toLowerCase()}.
                </div>
              )}
            </div>
          </section>

          {/* Right Panel: AI Copilot & Internal Notes & Handoff Summary */}
          <aside className="w-96 bg-[#F8F8F8] flex flex-col flex-shrink-0 border-l border-gray-200">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-white">
              <button
                onClick={() => setActiveTab('copilot')}
                className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'copilot'
                    ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50/30'
                    : 'text-gray-500 hover:text-[#111111]'
                }`}
              >
                <Sparkles size={14} className="text-orange-500" />
                AI Copilot
              </button>
              <button
                onClick={() => setActiveTab('handoff')}
                className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'handoff'
                    ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50/30'
                    : 'text-gray-500 hover:text-[#111111]'
                }`}
              >
                <FileText size={14} />
                Handoff
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'notes'
                    ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50/30'
                    : 'text-gray-500 hover:text-[#111111]'
                }`}
              >
                <Lock size={13} />
                Notes ({notes.length})
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* TAB 1: AI COPILOT */}
              {activeTab === 'copilot' && (
                <div className="space-y-4">
                  {/* Private Badge */}
                  <div className="bg-black text-white px-3 py-2 rounded-lg flex items-center gap-2 text-xs">
                    <Lock size={12} className="text-orange-400" />
                    <span className="font-semibold text-orange-400">Agent Copilot Mode</span>
                    <span className="text-[10px] text-gray-400 ml-auto">Private to you</span>
                  </div>

                  {copilot ? (
                    <>
                      {/* Customer Mood Insight */}
                      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                          <Flame size={14} className="text-orange-500" />
                          Customer Mood & Sentiment
                        </div>
                        <p className="text-xs text-[#111111] leading-relaxed">
                          {copilot.mood_comment}
                        </p>
                      </div>

                      {/* Recommended Agent Response */}
                      <div className="bg-white p-4 rounded-xl border border-orange-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-orange-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles size={14} className="text-orange-500" />
                            Suggested Response
                          </span>
                        </div>
                        <div className="bg-orange-50/60 p-3 rounded-lg border border-orange-100 text-xs text-[#111111] leading-relaxed mb-3 italic">
                          "{copilot.suggested_response}"
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleUseCopilotResponse}
                            className="flex-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm"
                          >
                            <Send size={12} />
                            Use Response
                          </button>
                          <button
                            onClick={handleCopyCopilot}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-[#111111] font-semibold text-xs rounded-lg transition-colors flex items-center gap-1"
                          >
                            {copiedCopilot ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                            {copiedCopilot ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      {/* Suggested Next Action */}
                      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                          <Lightbulb size={14} className="text-orange-500" />
                          Recommended Human Action
                        </div>
                        <p className="text-xs text-gray-800 leading-relaxed font-medium">
                          {copilot.next_action}
                        </p>
                      </div>

                      {/* Related Knowledge Base */}
                      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                          <BookOpen size={14} className="text-green-600" />
                          Relevant Knowledge Article
                        </div>
                        <p className="text-xs text-green-800 font-semibold">
                          {copilot.knowledge_article}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center text-gray-400 text-xs">
                      Copilot recommendations will generate as customer sends messages.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: HANDOFF SUMMARY */}
              {activeTab === 'handoff' && (
                <div className="space-y-4">
                  <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm">
                    <h3 className="text-sm font-extrabold text-[#111111] mb-3 flex items-center gap-2">
                      <FileText size={16} className="text-orange-500" />
                      AI Handoff Briefing
                    </h3>

                    {/* Metric Quick Stats */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">
                          Sentiment
                        </span>
                        <span
                          className={`text-xs font-bold ${
                            latestAnalysis?.sentiment_label === 'NEGATIVE'
                              ? 'text-orange-600'
                              : 'text-green-600'
                          }`}
                        >
                          {latestAnalysis?.sentiment_label ?? 'Neutral'}
                        </span>
                      </div>
                      <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">
                          Escalation Risk
                        </span>
                        <span className="text-xs font-bold text-orange-600">
                          {latestAnalysis?.escalation_risk_score ?? 0}%
                        </span>
                      </div>
                    </div>

                    {/* Attempted Solutions List */}
                    <div className="mb-4">
                      <h4 className="text-xs font-bold text-[#111111] mb-2 uppercase tracking-wide">
                        AI Attempts ({ticket.solution_attempts.length})
                      </h4>
                      {ticket.solution_attempts.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No AI solutions were attempted.</p>
                      ) : (
                        <div className="space-y-2">
                          {ticket.solution_attempts.map((attempt) => (
                            <div
                              key={attempt.id}
                              className="p-2.5 bg-gray-50 rounded-lg border border-gray-100 text-xs"
                            >
                              <div className="flex items-center justify-between font-semibold mb-0.5">
                                <span>Attempt #{attempt.attempt_number}</span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                    attempt.result === 'FAILED'
                                      ? 'bg-orange-100 text-orange-800'
                                      : 'bg-green-100 text-green-800'
                                  }`}
                                >
                                  {attempt.result}
                                </span>
                              </div>
                              <p className="text-gray-600 text-[11px] leading-tight">
                                {attempt.solution_summary}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Escalation Reason */}
                    {ticket.escalation_reason && (
                      <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 mb-3">
                        <span className="text-[11px] font-bold text-orange-800 uppercase tracking-wider block mb-1">
                          Escalation Trigger
                        </span>
                        <p className="text-xs text-orange-950 font-medium">
                          {ticket.escalation_reason}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: INTERNAL NOTES */}
              {activeTab === 'notes' && (
                <div className="space-y-4">
                  <div className="bg-black text-white px-3 py-2 rounded-lg flex items-center gap-2 text-xs">
                    <Lock size={12} className="text-orange-400" />
                    <span>Confidential Internal Notes</span>
                  </div>

                  {/* Add Note Form */}
                  <form onSubmit={handleAddNote} className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
                    <label className="block text-xs font-bold text-[#111111] mb-2 uppercase tracking-wider">
                      Add Agent Note
                    </label>
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="E.g., Customer checked router. Escalating to field dispatch..."
                      rows={3}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-[#111111] focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none mb-2"
                    />
                    <button
                      type="submit"
                      disabled={!newNote.trim() || submittingNote}
                      className="w-full py-2 bg-[#111111] hover:bg-black disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus size={13} />
                      Save Internal Note
                    </button>
                  </form>

                  {/* Notes List */}
                  <div className="space-y-2.5">
                    {notes.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-6">
                        No internal notes on this ticket yet.
                      </p>
                    ) : (
                      notes.map((note) => (
                        <div
                          key={note.id}
                          className="bg-white p-3 rounded-lg border border-gray-200/80 shadow-sm text-xs"
                        >
                          <div className="flex items-center justify-between text-gray-400 text-[10px] mb-1">
                            <span className="font-semibold text-gray-700">
                              {note.agent?.name ?? 'Agent'}
                            </span>
                            <span>{new Date(note.created_at).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                            {note.content}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { ticketsAPI, messagesAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import wsService from '../../services/websocket';
import { Ticket, AIAnalysis, ChatMessage, AgentCopilot } from '../../types';
import MessageBubble, { TypingIndicator } from '../../components/MessageBubble';
import AIAnalysisPanel from '../../components/AIAnalysisPanel';
import {
  Send, Bot, User, AlertTriangle, CheckCircle, Phone, ChevronDown,
  ArrowLeft, Wifi, WifiOff, Loader, X, Star, Mic, MicOff, Volume2, PhoneCall
} from 'lucide-react';
import VoiceCall from '../../components/voice/VoiceCall';
import VoiceCallModal from '../../components/voice/VoiceCallModal';
import speechService from '../../services/speech';

type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

function EscalationBanner({ onEscalate, onDismiss }: { onEscalate: () => void; onDismiss: () => void }) {
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mx-4 mb-2">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-orange-800">Would you like to speak with a human agent?</p>
          <p className="text-xs text-orange-600 mt-0.5">Our support agents are available to help you.</p>
          <div className="flex gap-2 mt-3">
            <button onClick={onEscalate} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
              <Phone size={12} />
              Connect to Human Agent
            </button>
            <button onClick={onDismiss} className="btn-secondary text-xs py-1.5 px-3">
              Continue with AI
            </button>
          </div>
        </div>
        <button onClick={onDismiss} className="text-orange-400 hover:text-orange-600">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

function SatisfactionPrompt({ onSubmit }: { onSubmit: (resolved: boolean, rating?: number) => void }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 mx-4 mb-2 shadow-sm">
      <h3 className="font-bold text-black mb-1">Was your issue resolved?</h3>
      <p className="text-sm text-gray-500 mb-4">Please rate your support experience</p>

      {/* Star rating */}
      <div className="flex gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-1"
          >
            <Star
              size={24}
              className={`transition-colors ${
                star <= (hoverRating || rating)
                  ? 'text-orange-400 fill-orange-400'
                  : 'text-gray-200'
              }`}
            />
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => onSubmit(true, rating)}
          className="btn-success flex-1 flex items-center justify-center gap-2 text-sm py-2.5"
        >
          <CheckCircle size={16} />
          Yes, It's Fixed!
        </button>
        <button
          onClick={() => onSubmit(false, rating)}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-black font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
        >
          <X size={16} />
          No, Still Need Help
        </button>
      </div>
    </div>
  );
}

function TicketTimeline({ events }: { events: Array<{ event_type: string; description?: string; created_at: string }> }) {
  const eventLabels: Record<string, string> = {
    TICKET_CREATED: 'Ticket Created',
    AI_ANALYSIS_COMPLETED: 'AI Analysis Complete',
    AI_SOLUTION_SENT: 'AI Solution Provided',
    CUSTOMER_REJECTED_SOLUTION: 'Solution Not Working',
    ESCALATION_REQUESTED: 'Human Agent Requested',
    AGENT_ASSIGNED: 'Agent Assigned',
    AGENT_JOINED: 'Agent Joined Chat',
    TICKET_RESOLVED: 'Issue Resolved',
    TICKET_REOPENED: 'Issue Reopened',
    TICKET_CLOSED: 'Ticket Closed',
  };

  return (
    <div className="space-y-3">
      {events.map((event, i) => (
        <div key={i} className="flex gap-3 items-start">
          <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
            <CheckCircle size={10} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-black">{eventLabels[event.event_type] || event.event_type}</p>
            {event.description && <p className="text-xs text-gray-400 mt-0.5">{event.description}</p>}
            <p className="text-xs text-gray-400">{new Date(event.created_at).toLocaleTimeString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CustomerTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [showEscalation, setShowEscalation] = useState(false);
  const [showSatisfaction, setShowSatisfaction] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'analysis' | 'timeline'>('analysis');
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false);
  const [isMicListening, setIsMicListening] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();

  const toggleInlineMic = async () => {
    if (isMicListening) {
      speechService.stopListening();
      setIsMicListening(false);
    } else {
      const started = await speechService.startListening(
        (transcript, isFinal) => {
          setInputText(transcript);
          if (isFinal) {
            setIsMicListening(false);
          }
        },
        (status) => {
          setIsMicListening(status === 'listening');
        }
      );
      if (started) setIsMicListening(true);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Load ticket and messages
  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [ticketRes, messagesRes] = await Promise.all([
        ticketsAPI.getById(Number(id)),
        messagesAPI.getForTicket(Number(id)),
      ]);

      const t = ticketRes.data;
      setTicket(t);

      const latestAnalysis = t.analyses?.[t.analyses.length - 1] || null;
      setAnalysis(latestAnalysis);

      // Map messages
      const mapped: ChatMessage[] = messagesRes.data.map((m: any) => ({
        id: m.id,
        sender_type: m.sender_type,
        sender_name: m.sender?.name || (m.sender_type === 'AI' ? 'AI Assistant' : undefined),
        content: m.content,
        created_at: m.created_at,
        is_internal: m.is_internal,
      }));
      setMessages(mapped);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // WebSocket connection
  useEffect(() => {
    if (!id) return;

    const handleMessage = (data: any) => {
      switch (data.type) {
        case 'customer_message':
          if (data.sender_type === 'CUSTOMER') {
            // Check if already in list (optimistic update)
            setMessages(prev => {
              if (prev.find(m => m.id === data.id)) return prev;
              return [...prev, { id: data.id, sender_type: 'CUSTOMER', sender_name: user?.name, content: data.content, created_at: data.created_at || new Date().toISOString() }];
            });
          }
          break;
        case 'ai_message':
          setIsTyping(false);
          setMessages(prev => [...prev, {
            id: data.id,
            sender_type: 'AI',
            sender_name: 'AI Assistant',
            content: data.content,
            created_at: data.created_at || new Date().toISOString(),
          }]);
          // Check if max attempts or escalation offer
          if (data.content?.includes('Would you like me to connect you with a human agent?') ||
              data.content?.includes('human support agent')) {
            setShowEscalation(true);
          }
          break;
        case 'agent_message':
          setMessages(prev => [...prev, {
            id: data.id,
            sender_type: 'AGENT',
            sender_name: data.sender_name,
            content: data.content,
            created_at: data.created_at || new Date().toISOString(),
          }]);
          break;
        case 'system':
          setMessages(prev => [...prev, {
            id: `sys_${Date.now()}`,
            sender_type: 'SYSTEM',
            content: data.message || data.content || '',
            created_at: new Date().toISOString(),
          }]);
          break;
        case 'ai_typing':
          setIsTyping(data.is_typing);
          break;
        case 'analysis_update':
          setAnalysis(data.analysis ? {
            id: Date.now(),
            sentiment_label: data.analysis.sentiment?.label,
            sentiment_score: data.analysis.sentiment?.score,
            intent_label: data.analysis.intent?.label,
            intent_score: data.analysis.intent?.score,
            urgency_label: data.analysis.urgency?.label,
            urgency_score: data.analysis.urgency?.score,
            escalation_risk_level: data.analysis.escalation_risk?.level,
            escalation_risk_score: data.analysis.escalation_risk?.score,
            created_at: new Date().toISOString(),
          } : null);
          break;
        case 'escalation':
          setShowEscalation(false);
          setMessages(prev => [...prev, {
            id: `sys_${Date.now()}`,
            sender_type: 'SYSTEM',
            content: data.message || 'Connecting you to a human agent...',
            created_at: new Date().toISOString(),
          }]);
          setTicket(prev => prev ? { ...prev, status: 'WAITING_FOR_AGENT' } : null);
          break;
        case 'agent_joined':
          setMessages(prev => [...prev, {
            id: `sys_${Date.now()}`,
            sender_type: 'SYSTEM',
            content: data.message || `${data.agent_name} has joined the conversation.`,
            created_at: new Date().toISOString(),
          }]);
          setTicket(prev => prev ? { ...prev, status: 'HUMAN_AGENT_ACTIVE' } : null);
          break;
        case 'ticket_resolved':
          setShowSatisfaction(true);
          setTicket(prev => prev ? { ...prev, status: 'RESOLVED' } : null);
          break;
        case 'ticket_status':
          setTicket(prev => prev ? { ...prev, status: data.status } : null);
          if (data.message) {
            setMessages(prev => [...prev, {
              id: `sys_${Date.now()}`,
              sender_type: 'SYSTEM',
              content: data.message,
              created_at: new Date().toISOString(),
            }]);
          }
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

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;
    const content = inputText.trim();
    setInputText('');
    setSending(false);

    // Optimistic add customer message
    const tempId = `temp_${Date.now()}`;
    setMessages(prev => [...prev, {
      id: tempId,
      sender_type: 'CUSTOMER',
      sender_name: user?.name,
      content,
      created_at: new Date().toISOString(),
    }]);

    wsService.send({ type: 'customer_message', content });
  };

  const handleEscalate = () => {
    wsService.send({ type: 'request_human', reason: 'Customer requested human agent' });
    setShowEscalation(false);
  };

  const handleSatisfaction = async (resolved: boolean, rating?: number) => {
    wsService.send({ type: 'feedback', resolved, rating });
    setShowSatisfaction(false);
    try {
      await ticketsAPI.satisfaction(Number(id), { was_resolved: resolved, rating });
    } catch {}
    setTicket(prev => prev ? { ...prev, status: resolved ? 'CLOSED' : 'REOPENED' } : null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    // Send typing indicator
    if (typingTimer.current) clearTimeout(typingTimer.current);
    wsService.send({ type: 'typing', sender: 'customer' });
    typingTimer.current = setTimeout(() => {}, 2000);
  };

  const getStatusLabel = () => {
    if (!ticket) return '';
    const labels: Record<string, { text: string; color: string }> = {
      AI_ASSISTING: { text: 'AI ASSISTING', color: 'text-orange-500' },
      WAITING_FOR_CUSTOMER: { text: 'AI ASSISTING', color: 'text-orange-500' },
      WAITING_FOR_AGENT: { text: 'WAITING FOR AGENT', color: 'text-orange-500' },
      HUMAN_AGENT_ACTIVE: { text: 'AGENT ACTIVE', color: 'text-green-600' },
      RESOLVED: { text: 'RESOLVED', color: 'text-green-600' },
      CLOSED: { text: 'CLOSED', color: 'text-green-600' },
      ESCALATION_REQUESTED: { text: 'ESCALATING', color: 'text-orange-500' },
    };
    return labels[ticket.status] || { text: ticket.status, color: 'text-gray-500' };
  };

  const statusInfo = getStatusLabel();
  const canSendMessage = ticket && !['CLOSED', 'RESOLVED'].includes(ticket.status);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader size={32} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Ticket not found</p>
          <button onClick={() => navigate('/customer')} className="btn-primary mt-4">Go to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={() => navigate('/customer')} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
            {ticket.status === 'HUMAN_AGENT_ACTIVE' ? (
              <User size={16} className="text-green-600" />
            ) : (
              <Bot size={16} className="text-orange-600" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-black text-sm">{ticket.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-gray-400">{ticket.public_token}</span>
              <span className="text-xs text-gray-300">•</span>
              <div className={`flex items-center gap-1 text-xs font-semibold ${(statusInfo as any).color}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${ticket.status === 'HUMAN_AGENT_ACTIVE' || ticket.status === 'CLOSED' ? 'bg-green-500' : 'bg-orange-500 animate-pulse'}`} />
                {(statusInfo as any).text}
              </div>
            </div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          {/* Live Voice Call Button */}
          {!['CLOSED'].includes(ticket.status) && (
            <button
              onClick={() => setIsVoiceCallOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold shadow-md shadow-orange-500/20 transition-all transform active:scale-95 group"
            >
              <Mic size={14} className="group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">AI Live Voice Call</span>
              <span className="sm:hidden">Voice Call</span>
            </button>
          )}

          {/* Connection status */}
          {connectionStatus === 'connected' ? (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <Wifi size={12} />
              <span className="hidden sm:inline">Live</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <WifiOff size={12} />
              <span className="hidden sm:inline">{connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Offline'}</span>
            </div>
          )}

          {/* Mobile: show analysis toggle */}
          <button
            className="lg:hidden p-2 text-gray-400 hover:text-orange-500"
            onClick={() => setShowAnalysis(!showAnalysis)}
          >
            <ChevronDown size={16} className={showAnalysis ? 'rotate-180' : ''} />
          </button>
        </div>
      </div>

      {/* Mobile analysis drawer */}
      {showAnalysis && (
        <div className="lg:hidden border-b border-gray-100 p-4 bg-surface">
          <AIAnalysisPanel analysis={analysis} attemptCount={ticket.ai_attempt_count} />
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
            {/* Greeting if no messages */}
            {messages.length === 0 && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <Bot size={15} className="text-orange-600" />
                </div>
                <div className="bg-white border border-orange-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-md">
                  <p className="text-sm text-black">
                    Hello! I'm SupportAI. I've received your ticket about "<strong>{ticket.title}</strong>".
                    <br /><br />
                    Tell me more about what's happening and I'll help you resolve it as quickly as possible.
                  </p>
                </div>
              </div>
            )}

            {messages.filter(m => !m.is_internal).map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwnMessage={message.sender_type === 'CUSTOMER'}
              />
            ))}

            {isTyping && <TypingIndicator who={ticket.status === 'HUMAN_AGENT_ACTIVE' ? 'Agent' : 'AI'} />}
            <div ref={messagesEndRef} />
          </div>

          {/* Escalation banner */}
          {showEscalation && ticket.status === 'WAITING_FOR_CUSTOMER' && (
            <EscalationBanner onEscalate={handleEscalate} onDismiss={() => setShowEscalation(false)} />
          )}

          {/* Satisfaction prompt */}
          {showSatisfaction && (
            <SatisfactionPrompt onSubmit={handleSatisfaction} />
          )}

          {/* Waiting for agent banner */}
          {ticket.status === 'WAITING_FOR_AGENT' && (
            <div className="mx-4 mb-2 bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                <p className="text-sm font-semibold text-orange-800">Connecting you with a human agent...</p>
              </div>
              <p className="text-xs text-orange-600 mt-1">Please stay in this conversation. An agent will join shortly.</p>
            </div>
          )}

          {/* Agent connected banner */}
          {ticket.status === 'HUMAN_AGENT_ACTIVE' && ticket.assigned_agent && (
            <div className="mx-4 mb-2 bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <p className="text-sm font-semibold text-green-800">
                {ticket.assigned_agent.name} is actively helping you
              </p>
            </div>
          )}

          {/* Closed/Resolved */}
          {['CLOSED', 'RESOLVED'].includes(ticket.status) && (
            <div className="mx-4 mb-2 bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <CheckCircle size={20} className="text-green-500 mx-auto mb-1" />
              <p className="text-sm font-bold text-green-800">Ticket {ticket.status}</p>
              <p className="text-xs text-green-600">Thank you for using SupportAI!</p>
            </div>
          )}

          {/* Input */}
          {canSendMessage ? (
            <div className="border-t border-gray-100 p-4 flex-shrink-0">
              {/* Human request button */}
              {!['WAITING_FOR_AGENT', 'HUMAN_AGENT_ACTIVE'].includes(ticket.status) && (
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => setShowEscalation(true)}
                    className="text-xs text-gray-400 hover:text-orange-500 flex items-center gap-1 transition-colors"
                  >
                    <Phone size={11} />
                    Talk to a Human Agent
                  </button>
                </div>
              )}
              <div className="flex gap-2.5 items-end">
                <button
                  type="button"
                  onClick={toggleInlineMic}
                  title={isMicListening ? 'Listening... click to stop' : 'Click to speak your message'}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                    isMicListening
                      ? 'bg-red-500 text-white animate-pulse shadow-md shadow-red-500/30'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <Mic size={18} />
                </button>
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isMicListening
                      ? 'Listening to your voice... Speak now'
                      : ticket.status === 'WAITING_FOR_AGENT'
                      ? 'Waiting for agent...'
                      : ticket.status === 'HUMAN_AGENT_ACTIVE'
                      ? 'Message your agent...'
                      : 'Describe your issue or respond to AI...'
                  }
                  rows={1}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent max-h-32"
                  style={{ minHeight: '48px' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputText.trim()}
                  className="w-11 h-11 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors shadow-sm"
                >
                  <Send size={16} className={inputText.trim() ? 'text-white' : 'text-gray-400'} />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                Press <kbd className="bg-gray-100 px-1 rounded text-xs">Enter</kbd> to send • <kbd className="bg-gray-100 px-1 rounded text-xs">Shift+Enter</kbd> for new line
              </p>
            </div>
          ) : (
            <div className="border-t border-gray-100 p-4 text-center flex-shrink-0">
              <p className="text-sm text-gray-400">This ticket is {ticket.status.toLowerCase()}</p>
              <button onClick={() => navigate('/customer/create-ticket')} className="btn-primary text-sm mt-2 py-2">
                Create New Ticket
              </button>
            </div>
          )}
        </div>

        {/* Desktop sidebar */}
        <div className="hidden lg:flex w-80 border-l border-gray-100 flex-col bg-white flex-shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setSidebarTab('analysis')}
              className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                sidebarTab === 'analysis' ? 'text-orange-600 border-b-2 border-orange-500' : 'text-gray-500'
              }`}
            >
              AI ANALYSIS
            </button>
            <button
              onClick={() => setSidebarTab('timeline')}
              className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                sidebarTab === 'timeline' ? 'text-orange-600 border-b-2 border-orange-500' : 'text-gray-500'
              }`}
            >
              TIMELINE
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {sidebarTab === 'analysis' ? (
              <AIAnalysisPanel
                analysis={analysis}
                attemptCount={ticket.ai_attempt_count}
              />
            ) : (
              <div>
                <h4 className="text-xs font-bold text-black uppercase tracking-wide mb-4">Ticket Timeline</h4>
                {ticket.events.length > 0 ? (
                  <TicketTimeline events={ticket.events} />
                ) : (
                  <p className="text-xs text-gray-400">No events yet</p>
                )}
              </div>
            )}
          </div>

          {/* Solution attempts */}
          {ticket.solution_attempts.length > 0 && (
            <div className="border-t border-gray-100 p-4">
              <h4 className="text-xs font-bold text-black uppercase tracking-wide mb-3">Solution Attempts</h4>
              <div className="space-y-2">
                {ticket.solution_attempts.map((attempt) => (
                  <div key={attempt.id} className="flex items-start gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                      attempt.result === 'FAILED' ? 'bg-orange-100 text-orange-600' :
                      attempt.result === 'SUCCESS' ? 'bg-green-100 text-green-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {attempt.attempt_number}
                    </div>
                    <div>
                      <p className="text-xs text-black leading-tight">{attempt.solution_summary}</p>
                      <p className={`text-xs font-medium mt-0.5 ${
                        attempt.result === 'FAILED' ? 'text-orange-500' :
                        attempt.result === 'SUCCESS' ? 'text-green-600' :
                        'text-gray-400'
                      }`}>
                        {attempt.result}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live AI Voice Support System */}
      <VoiceCall
        isOpen={isVoiceCallOpen}
        onClose={() => setIsVoiceCallOpen(false)}
        ticket={ticket}
        onTicketStatusChange={(newStatus) => {
          setTicket((prev) => (prev ? { ...prev, status: newStatus as any } : null));
        }}
        onEscalate={handleEscalate}
      />
    </div>
  );
}

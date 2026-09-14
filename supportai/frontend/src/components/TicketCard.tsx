import { Ticket, TicketStatus } from '../types';
import { CheckCircle, Clock, Bot, User, AlertTriangle, RotateCcw, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

function StatusBadge({ status }: { status: TicketStatus }) {
  const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    CREATED: { label: 'Created', className: 'badge-black', icon: <Clock size={10} /> },
    AI_ASSISTING: { label: 'AI Assisting', className: 'badge-orange', icon: <Bot size={10} /> },
    WAITING_FOR_CUSTOMER: { label: 'Awaiting Response', className: 'badge-orange', icon: <Clock size={10} /> },
    CUSTOMER_NOT_SATISFIED: { label: 'Not Satisfied', className: 'badge-orange', icon: <AlertTriangle size={10} /> },
    ESCALATION_REQUESTED: { label: 'Escalation Requested', className: 'badge-orange', icon: <AlertTriangle size={10} /> },
    WAITING_FOR_AGENT: { label: 'Waiting for Agent', className: 'badge-orange', icon: <Clock size={10} /> },
    AGENT_ASSIGNED: { label: 'Agent Assigned', className: 'badge-green', icon: <User size={10} /> },
    HUMAN_AGENT_ACTIVE: { label: 'Agent Active', className: 'badge-green', icon: <User size={10} /> },
    AI_RESOLVED: { label: 'AI Resolved', className: 'badge-green', icon: <CheckCircle size={10} /> },
    RESOLVED: { label: 'Resolved', className: 'badge-green', icon: <CheckCircle size={10} /> },
    REOPENED: { label: 'Reopened', className: 'badge-orange', icon: <RotateCcw size={10} /> },
    CLOSED: { label: 'Closed', className: 'badge-green', icon: <CheckCircle size={10} /> },
  };

  const cfg = config[status] || { label: status, className: 'badge-black', icon: null };
  return (
    <span className={`${cfg.className} gap-1`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, string> = {
    LOW: 'badge-green',
    MEDIUM: 'badge-black',
    HIGH: 'badge-orange',
    CRITICAL: 'bg-black text-white text-xs font-semibold px-2.5 py-0.5 rounded-full inline-flex items-center',
  };
  return <span className={config[priority] || 'badge-black'}>{priority}</span>;
}

interface TicketCardProps {
  ticket: Ticket;
  linkTo?: string;
  showAgent?: boolean;
  onAccept?: () => void;
}

export default function TicketCard({ ticket, linkTo, showAgent, onAccept }: TicketCardProps) {
  const latestAnalysis = ticket.analyses?.[ticket.analyses.length - 1];
  const waitingTime = (() => {
    const created = new Date(ticket.created_at);
    const now = new Date();
    const diff = Math.floor((now.getTime() - created.getTime()) / 1000 / 60);
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  })();

  const CardContent = (
    <div className="card p-5 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-semibold text-orange-500">{ticket.public_token}</span>
            <StatusBadge status={ticket.status} />
          </div>
          <h3 className="font-semibold text-black truncate">{ticket.title}</h3>
          {ticket.customer && showAgent && (
            <p className="text-xs text-gray-500 mt-0.5">
              Customer: {ticket.customer.name}
            </p>
          )}
        </div>
        <PriorityBadge priority={ticket.priority} />
      </div>

      {/* Description */}
      <p className="text-sm text-gray-500 line-clamp-2 mb-3">{ticket.description}</p>

      {/* Analysis info */}
      {latestAnalysis && (
        <div className="flex flex-wrap gap-2 mb-3">
          {latestAnalysis.sentiment_label && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              latestAnalysis.sentiment_label === 'NEGATIVE' ? 'bg-orange-50 text-orange-600' :
              latestAnalysis.sentiment_label === 'POSITIVE' ? 'bg-green-50 text-green-600' :
              'bg-gray-100 text-gray-600'
            }`}>
              {latestAnalysis.sentiment_label === 'NEGATIVE' ? '😟' : latestAnalysis.sentiment_label === 'POSITIVE' ? '😊' : '😐'} {latestAnalysis.sentiment_label}
            </span>
          )}
          {latestAnalysis.escalation_risk_score !== undefined && latestAnalysis.escalation_risk_score > 50 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-50 text-orange-700">
              ⚠️ Risk: {latestAnalysis.escalation_risk_score.toFixed(0)}%
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{ticket.category}</span>
          <span className="text-xs text-gray-400">{waitingTime}</span>
          {ticket.ai_attempt_count > 0 && (
            <span className="text-xs text-gray-400">AI: {ticket.ai_attempt_count} attempts</span>
          )}
        </div>
        {onAccept && (
          <button
            onClick={(e) => { e.preventDefault(); onAccept(); }}
            className="btn-primary text-xs py-1.5 px-3"
          >
            Accept
          </button>
        )}
      </div>
    </div>
  );

  if (linkTo) {
    return <Link to={linkTo} className="block">{CardContent}</Link>;
  }

  return CardContent;
}

export { StatusBadge, PriorityBadge };

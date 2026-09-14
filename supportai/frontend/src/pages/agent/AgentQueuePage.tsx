import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AgentSidebar from '../../components/agent/AgentSidebar';
import { agentsAPI, ticketsAPI } from '../../services/api';
import { Ticket } from '../../types';
import TicketCard from '../../components/TicketCard';
import {
  Inbox,
  RefreshCw,
  Filter,
  CheckCircle,
  SlidersHorizontal,
} from 'lucide-react';

export default function AgentQueuePage() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'risk' | 'time' | 'priority'>('risk');

  const loadQueue = async () => {
    try {
      const res = await agentsAPI.getQueue();
      setQueue(res.data);
    } catch (err) {
      console.error('Failed to load agent queue:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadQueue();
  };

  const handleAccept = async (ticketId: number) => {
    try {
      await ticketsAPI.assign(ticketId);
      navigate(`/agent/tickets/${ticketId}`);
    } catch (err) {
      console.error('Failed to accept ticket:', err);
      loadQueue();
    }
  };

  // Filter
  const filtered = queue.filter((t) => {
    if (filterPriority === 'ALL') return true;
    return t.priority === filterPriority;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'risk') {
      const riskA = a.analyses?.[a.analyses.length - 1]?.escalation_risk_score ?? 0;
      const riskB = b.analyses?.[b.analyses.length - 1]?.escalation_risk_score ?? 0;
      return riskB - riskA;
    }
    if (sortBy === 'priority') {
      const pMap: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return (pMap[b.priority] || 0) - (pMap[a.priority] || 0);
    }
    // time: oldest first
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return (
    <div className="flex min-h-screen bg-[#F8F8F8]">
      <AgentSidebar />

      <main className="flex-1 p-8 max-w-6xl">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-[#111111] tracking-tight">
                Live Support Queue
              </h1>
              <span className="px-3 py-1 bg-orange-100 text-orange-800 text-xs font-bold rounded-full border border-orange-200">
                {queue.length} waiting
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-1">
              Customers escalated from AI assistant awaiting human support agent
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="self-start md:self-auto flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-[#111111] hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-orange-500' : ''} />
            <span>Refresh Queue</span>
          </button>
        </div>

        {/* Controls Bar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-gray-400" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Priority:
            </span>
            <div className="flex gap-1.5">
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => (
                <button
                  key={p}
                  onClick={() => setFilterPriority(p)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    filterPriority === p
                      ? 'bg-[#111111] text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal size={15} className="text-gray-400" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Sort By:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-gray-100 border-none text-xs font-semibold text-[#111111] rounded-md px-3 py-1.5 focus:ring-2 focus:ring-orange-500 cursor-pointer"
            >
              <option value="risk">Highest Escalation Risk</option>
              <option value="priority">Priority Level</option>
              <option value="time">Oldest Waiting (FIFO)</option>
            </select>
          </div>
        </div>

        {/* Queue List */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200/80 p-12 text-center text-gray-400">
            Loading live queue...
          </div>
        ) : sorted.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200/80 p-16 text-center flex flex-col items-center justify-center shadow-sm">
            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center text-green-600 mb-3">
              <CheckCircle size={32} />
            </div>
            <h3 className="font-bold text-lg text-[#111111]">No Tickets in Queue</h3>
            <p className="text-gray-500 text-sm max-w-sm mt-1">
              {filterPriority !== 'ALL'
                ? `No ${filterPriority.toLowerCase()} priority tickets are waiting in queue.`
                : 'All customers are currently being handled by AI or support agents.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {sorted.map((ticket) => (
              <div
                key={ticket.id}
                className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-sm hover:border-orange-200 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="font-mono font-bold text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                      {ticket.public_token}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        ticket.priority === 'CRITICAL'
                          ? 'bg-black text-white'
                          : ticket.priority === 'HIGH'
                          ? 'bg-orange-100 text-orange-800'
                          : ticket.priority === 'MEDIUM'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {ticket.priority} PRIORITY
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500 font-medium">{ticket.category}</span>
                  </div>

                  <h3 className="text-base font-bold text-[#111111] mb-1">{ticket.title}</h3>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3 max-w-2xl">
                    {ticket.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <span className="text-gray-600 font-medium">
                      Customer:{' '}
                      <strong className="text-[#111111] font-semibold">
                        {ticket.customer?.name ?? 'Anonymous'}
                      </strong>
                    </span>
                    {ticket.analyses?.[ticket.analyses.length - 1] && (
                      <>
                        <span className="text-gray-600">
                          Sentiment:{' '}
                          <strong
                            className={
                              ticket.analyses[ticket.analyses.length - 1].sentiment_label ===
                              'NEGATIVE'
                                ? 'text-orange-600'
                                : 'text-green-600'
                            }
                          >
                            {ticket.analyses[ticket.analyses.length - 1].sentiment_label}
                          </strong>
                        </span>
                        <span className="text-gray-600">
                          Escalation Risk:{' '}
                          <strong className="text-orange-600 font-bold">
                            {ticket.analyses[
                              ticket.analyses.length - 1
                            ].escalation_risk_score.toFixed(0)}
                            %
                          </strong>
                        </span>
                      </>
                    )}
                    <span className="text-gray-500">
                      AI Attempts: <strong>{ticket.ai_attempt_count}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-center flex-shrink-0">
                  <button
                    onClick={() => handleAccept(ticket.id)}
                    className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-lg shadow-sm transition-all transform active:scale-95"
                  >
                    Accept Ticket
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

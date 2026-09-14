import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AgentSidebar from '../../components/agent/AgentSidebar';
import { agentsAPI, ticketsAPI } from '../../services/api';
import { Ticket } from '../../types';
import TicketCard from '../../components/TicketCard';
import {
  Inbox,
  CheckCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export default function AgentDashboard() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<Ticket[]>([]);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [queueRes, myTicketsRes] = await Promise.all([
        agentsAPI.getQueue(),
        agentsAPI.getMyTickets(),
      ]);
      setQueue(queueRes.data);
      setMyTickets(myTicketsRes.data);
    } catch (err) {
      console.error('Failed to load agent dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleAcceptTicket = async (ticketId: number) => {
    try {
      await ticketsAPI.assign(ticketId);
      navigate(`/agent/tickets/${ticketId}`);
    } catch (err) {
      console.error('Failed to accept ticket:', err);
      loadData();
    }
  };

  const activeAssigned = myTickets.filter(
    (t) => t.status === 'HUMAN_AGENT_ACTIVE' || t.status === 'AGENT_ASSIGNED'
  );
  const resolvedAssigned = myTickets.filter(
    (t) => t.status === 'RESOLVED' || t.status === 'CLOSED'
  );

  return (
    <div className="flex min-h-screen bg-[#F8F8F8]">
      <AgentSidebar />

      <main className="flex-1 p-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-[#111111] tracking-tight">
              Agent Console
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Live escalation queue & active customer sessions
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-[#111111] hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-orange-500' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          {/* Waiting in Queue */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Waiting in Queue
              </span>
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500">
                <Inbox size={18} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#111111]">{queue.length}</span>
              {queue.length > 0 && (
                <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full animate-pulse">
                  Action required
                </span>
              )}
            </div>
          </div>

          {/* Active Assigned */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                My Active Tickets
              </span>
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                <Clock size={18} />
              </div>
            </div>
            <span className="text-3xl font-extrabold text-[#111111]">{activeAssigned.length}</span>
          </div>

          {/* Resolved */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                My Resolved
              </span>
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                <CheckCircle size={18} />
              </div>
            </div>
            <span className="text-3xl font-extrabold text-[#111111]">{resolvedAssigned.length}</span>
          </div>

          {/* Resolution Rate */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Resolution Rate
              </span>
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700">
                <TrendingUp size={18} />
              </div>
            </div>
            <span className="text-3xl font-extrabold text-[#111111]">
              {myTickets.length > 0
                ? `${Math.round((resolvedAssigned.length / myTickets.length) * 100)}%`
                : '100%'}
            </span>
          </div>
        </div>

        {/* Main Grid: Queue & My Tickets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Live Queue Section */}
          <section className="bg-white rounded-xl border border-gray-200/80 p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                <h2 className="text-lg font-bold text-[#111111]">Escalation Queue</h2>
                <span className="text-xs bg-orange-100 text-orange-800 font-semibold px-2 py-0.5 rounded-full">
                  {queue.length} waiting
                </span>
              </div>
              <Link
                to="/agent/queue"
                className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1"
              >
                View full queue <ArrowRight size={13} />
              </Link>
            </div>

            {loading ? (
              <div className="py-12 text-center text-gray-400 text-sm">Loading queue...</div>
            ) : queue.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center">
                <CheckCircle size={36} className="text-green-500 mb-2" />
                <p className="font-semibold text-gray-700 text-sm">Queue is empty!</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  All customer issues are currently handled by AI or resolved.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5 overflow-y-auto max-h-[500px] pr-1">
                {queue.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    showAgent={true}
                    onAccept={() => handleAcceptTicket(ticket.id)}
                    linkTo={`/agent/tickets/${ticket.id}`}
                  />
                ))}
              </div>
            )}
          </section>

          {/* My Assigned Tickets Section */}
          <section className="bg-white rounded-xl border border-gray-200/80 p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#111111]">My Assigned Tickets</h2>
                <span className="text-xs bg-gray-100 text-gray-700 font-semibold px-2 py-0.5 rounded-full">
                  {activeAssigned.length} active
                </span>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-gray-400 text-sm">Loading assigned tickets...</div>
            ) : myTickets.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center">
                <AlertCircle size={36} className="text-gray-300 mb-2" />
                <p className="font-semibold text-gray-700 text-sm">No tickets assigned yet</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Accept a ticket from the live queue to begin assisting customers.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5 overflow-y-auto max-h-[500px] pr-1">
                {myTickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    showAgent={true}
                    linkTo={`/agent/tickets/${ticket.id}`}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

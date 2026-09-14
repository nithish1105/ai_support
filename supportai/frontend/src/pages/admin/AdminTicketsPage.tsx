import { useEffect, useState, useMemo } from 'react';
import { Search, Filter, RefreshCw, Ticket as TicketIcon } from 'lucide-react';
import { ticketsAPI } from '../../services/api';
import { Ticket, TicketStatus } from '../../types';
import AdminSidebar from '../../components/admin/AdminSidebar';
import TicketCard from '../../components/TicketCard';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'CREATED', label: 'Created' },
  { value: 'AI_ASSISTING', label: 'AI Assisting' },
  { value: 'WAITING_FOR_CUSTOMER', label: 'Waiting for Customer' },
  { value: 'CUSTOMER_NOT_SATISFIED', label: 'Not Satisfied' },
  { value: 'ESCALATION_REQUESTED', label: 'Escalation Requested' },
  { value: 'WAITING_FOR_AGENT', label: 'Waiting for Agent' },
  { value: 'AGENT_ASSIGNED', label: 'Agent Assigned' },
  { value: 'HUMAN_AGENT_ACTIVE', label: 'Agent Active' },
  { value: 'AI_RESOLVED', label: 'AI Resolved' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'REOPENED', label: 'Reopened' },
  { value: 'CLOSED', label: 'Closed' },
];

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTickets = (status?: string) => {
    setLoading(true);
    setError('');
    ticketsAPI
      .list(status || undefined)
      .then((res) => setTickets(res.data))
      .catch(() => setError('Failed to load tickets.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTickets(statusFilter);
  }, [statusFilter]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return tickets;
    const q = searchQuery.toLowerCase();
    return tickets.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.public_token.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.customer?.name?.toLowerCase().includes(q)
    );
  }, [tickets, searchQuery]);

  return (
    <div className="flex min-h-screen bg-[#F8F8F8]">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-black">All Tickets</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {filtered.length} ticket{filtered.length !== 1 ? 's' : ''} found
              </p>
            </div>
            <button
              onClick={() => fetchTickets(statusFilter)}
              className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
        </div>

        <div className="px-8 py-6">
          {/* Filters */}
          <div className="card p-4 mb-6 flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by title, token, or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-9 py-2 text-sm"
              />
            </div>

            {/* Status filter */}
            <div className="relative">
              <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-field pl-9 py-2 text-sm pr-8 appearance-none cursor-pointer min-w-[180px]"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-24">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="card p-8 text-center">
              <p className="text-orange-600 font-medium">{error}</p>
              <button
                onClick={() => fetchTickets(statusFilter)}
                className="btn-primary mt-4 text-sm py-2 px-5"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && filtered.length === 0 && (
            <div className="card p-12 text-center">
              <TicketIcon size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No tickets found</p>
              <p className="text-gray-400 text-sm mt-1">
                Try adjusting your filters or search query
              </p>
            </div>
          )}

          {/* Ticket list */}
          {!loading && !error && filtered.length > 0 && (
            <div className="space-y-3">
              {filtered.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  linkTo={`/agent/tickets/${ticket.id}`}
                  showAgent
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

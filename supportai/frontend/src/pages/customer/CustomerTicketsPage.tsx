import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { ticketsAPI } from '../../services/api';
import { Ticket } from '../../types';
import TicketCard from '../../components/TicketCard';
import { MessageSquare, Plus } from 'lucide-react';

export default function CustomerTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      const response = await ticketsAPI.list();
      setTickets(response.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === 'all' ? tickets : tickets.filter(t => {
    if (filter === 'active') return ['AI_ASSISTING', 'WAITING_FOR_CUSTOMER', 'HUMAN_AGENT_ACTIVE', 'WAITING_FOR_AGENT'].includes(t.status);
    if (filter === 'resolved') return ['RESOLVED', 'CLOSED', 'AI_RESOLVED'].includes(t.status);
    if (filter === 'escalated') return ['WAITING_FOR_AGENT', 'ESCALATION_REQUESTED', 'HUMAN_AGENT_ACTIVE'].includes(t.status);
    return true;
  });

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-extrabold text-black">My Support Tickets</h1>
          <Link to="/customer/create-ticket" className="btn-primary flex items-center gap-2 text-sm py-2.5">
            <Plus size={16} />
            New Ticket
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'escalated', label: 'With Agent' },
            { key: 'resolved', label: 'Resolved' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-orange-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-orange-300'
              }`}
            >
              {f.label}
              {f.key === 'all' && tickets.length > 0 && (
                <span className="ml-1.5 bg-white/20 text-xs px-1.5 py-0.5 rounded-full">
                  {filter === 'all' ? '' : ''}
                  {tickets.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tickets */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-12 text-center">
            <MessageSquare size={40} className="text-gray-200 mx-auto mb-4" />
            <h3 className="font-bold text-black mb-2">
              {filter === 'all' ? 'No tickets yet' : `No ${filter} tickets`}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {filter === 'all' ? 'Create your first support ticket to get help.' : 'Try a different filter.'}
            </p>
            {filter === 'all' && (
              <Link to="/customer/create-ticket" className="btn-primary inline-flex items-center gap-2">
                <Plus size={16} />
                Create Support Ticket
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(ticket => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                linkTo={`/customer/tickets/${ticket.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

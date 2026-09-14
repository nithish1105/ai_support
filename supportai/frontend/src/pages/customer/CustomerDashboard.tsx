import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { ticketsAPI, authAPI } from '../../services/api';
import { Ticket } from '../../types';
import Navbar from '../../components/Navbar';
import TicketCard from '../../components/TicketCard';
import { Plus, MessageSquare, CheckCircle, Clock, Bot, LogOut } from 'lucide-react';

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <span className="text-3xl font-extrabold text-black">{value}</span>
      </div>
      <p className="text-sm font-medium text-gray-600">{label}</p>
    </div>
  );
}

export default function CustomerDashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      const response = await ticketsAPI.list();
      setTickets(response.data);
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch {}
    logout();
    navigate('/');
  };

  const activeTickets = tickets.filter(t =>
    ['AI_ASSISTING', 'WAITING_FOR_CUSTOMER', 'ESCALATION_REQUESTED', 'WAITING_FOR_AGENT', 'AGENT_ASSIGNED', 'HUMAN_AGENT_ACTIVE'].includes(t.status)
  );
  const waitingForAgent = tickets.filter(t => ['WAITING_FOR_AGENT', 'ESCALATION_REQUESTED'].includes(t.status));
  const resolvedTickets = tickets.filter(t => ['AI_RESOLVED', 'RESOLVED', 'CLOSED'].includes(t.status));

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Welcome header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-black">
              Welcome back, {user?.name?.split(' ')[0]}! 👋
            </h1>
            <p className="text-gray-500 mt-1">How can we help you today?</p>
          </div>
          <button onClick={handleLogout} className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
            <LogOut size={14} />
            Logout
          </button>
        </div>

        {/* Create ticket CTA */}
        <Link
          to="/customer/create-ticket"
          className="block bg-black rounded-2xl p-6 mb-8 hover:bg-gray-900 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-orange-400 transition-colors">
              <Plus size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-white font-bold text-lg">Create New Support Issue</h2>
              <p className="text-gray-400 text-sm mt-0.5">Describe your problem and get instant AI assistance</p>
            </div>
            <div className="text-orange-500 font-bold">→</div>
          </div>
        </Link>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Active Tickets"
            value={activeTickets.length}
            icon={<Bot size={18} className="text-orange-600" />}
            color="bg-orange-50"
          />
          <StatCard
            label="Waiting for Agent"
            value={waitingForAgent.length}
            icon={<Clock size={18} className="text-orange-600" />}
            color="bg-orange-50"
          />
          <StatCard
            label="Resolved"
            value={resolvedTickets.length}
            icon={<CheckCircle size={18} className="text-green-600" />}
            color="bg-green-50"
          />
        </div>

        {/* Recent tickets */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-black">Your Tickets</h2>
          <Link to="/customer/tickets" className="text-sm text-orange-500 font-medium hover:text-orange-600">
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-1/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="card p-12 text-center">
            <MessageSquare size={40} className="text-gray-200 mx-auto mb-4" />
            <h3 className="font-bold text-black mb-2">No support tickets yet</h3>
            <p className="text-gray-500 text-sm mb-4">Create your first support ticket to get help from our AI assistant.</p>
            <Link to="/customer/create-ticket" className="btn-primary inline-flex items-center gap-2">
              <Plus size={16} />
              Create Support Ticket
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.slice(0, 5).map((ticket) => (
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

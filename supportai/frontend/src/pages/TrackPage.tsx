import { useState } from 'react';
import Navbar from '../components/Navbar';
import { ticketsAPI } from '../services/api';
import { Ticket } from '../types';
import { StatusBadge } from '../components/TicketCard';
import { Search, CheckCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TrackPage() {
  const [token, setToken] = useState('');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;

    setLoading(true);
    setError('');
    setTicket(null);

    try {
      const response = await ticketsAPI.getByToken(token.trim().toUpperCase());
      setTicket(response.data);
    } catch (err: any) {
      setError('Ticket not found. Please check your token and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-black mb-3">Track Your Support Issue</h1>
          <p className="text-gray-500">Enter your support token to view your ticket status</p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="card p-6 mb-6">
          <label className="block text-sm font-semibold text-black mb-2">Support Token</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value.toUpperCase())}
              placeholder="SUP-2026-XXXXXX"
              className="input-field flex-1 font-mono uppercase tracking-wider"
              maxLength={20}
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center gap-2 whitespace-nowrap"
            >
              <Search size={16} />
              {loading ? 'Searching...' : 'Track'}
            </button>
          </div>
          {error && (
            <p className="text-sm text-orange-600 mt-2">{error}</p>
          )}
        </form>

        {/* Result */}
        {ticket && (
          <div className="card p-6 animate-fadeIn">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle size={20} className="text-green-500" />
              <span className="font-bold text-black">Ticket Found</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Token</p>
                  <p className="font-mono font-bold text-orange-500 text-lg">{ticket.public_token}</p>
                </div>
                <StatusBadge status={ticket.status} />
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Issue</p>
                <p className="font-semibold text-black">{ticket.title}</p>
              </div>

              <div className="flex gap-8">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Priority</p>
                  <p className="font-semibold text-black">{ticket.priority}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Category</p>
                  <p className="font-semibold text-black">{ticket.category}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Created</p>
                <p className="font-semibold text-black flex items-center gap-1">
                  <Clock size={12} />
                  {new Date(ticket.created_at).toLocaleDateString('en-US', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                  })}
                </p>
              </div>

              {ticket.assigned_agent && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Assigned Agent</p>
                  <p className="font-semibold text-green-600">{ticket.assigned_agent.name}</p>
                </div>
              )}

              {/* AI Attempt info */}
              {ticket.ai_attempt_count > 0 && (
                <div className="bg-orange-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-orange-700">
                    AI has attempted {ticket.ai_attempt_count} solution{ticket.ai_attempt_count !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <Link to="/login" className="btn-primary flex-1 text-center text-sm py-2.5">
                Login to View Chat
              </Link>
            </div>
          </div>
        )}

        {/* Help text */}
        <p className="text-center text-sm text-gray-400 mt-6">
          Don't have a token?{' '}
          <Link to="/register" className="text-orange-500 hover:text-orange-600 font-medium">
            Create a Support Ticket
          </Link>
        </p>
      </div>
    </div>
  );
}

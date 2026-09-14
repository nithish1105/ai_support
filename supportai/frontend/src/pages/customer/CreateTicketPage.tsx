import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { ticketsAPI } from '../../services/api';
import { CheckCircle, Copy, ArrowRight, Loader } from 'lucide-react';

const CATEGORIES = [
  'Technical Issue', 'Internet Problem', 'Billing Problem', 'Payment Problem',
  'Refund', 'Account Problem', 'Password', 'Order', 'Delivery',
  'Subscription', 'Cancellation', 'Product Information', 'Complaint', 'Feedback', 'Other'
];

export default function CreateTicketPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Technical Issue',
    order_id: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdTicket, setCreatedTicket] = useState<{ public_token: string; id: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      setError('Please fill in the title and description');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await ticketsAPI.create({
        title: formData.title,
        description: formData.description,
        category: formData.category,
        order_id: formData.order_id || undefined,
      });
      setCreatedTicket({ public_token: response.data.public_token, id: response.data.id });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToken = () => {
    if (createdTicket) {
      navigator.clipboard.writeText(createdTicket.public_token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Success screen
  if (createdTicket) {
    return (
      <div className="min-h-screen bg-surface">
        <Navbar />
        <div className="max-w-lg mx-auto px-4 py-16">
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-extrabold text-black mb-2">Support Ticket Created!</h2>
            <p className="text-gray-500 mb-6">Keep this token to track and continue your support conversation.</p>

            {/* Token display */}
            <div className="bg-black rounded-xl py-4 px-6 mb-3">
              <p className="text-gray-400 text-xs mb-1">Your Support Token</p>
              <p className="font-mono text-2xl font-bold text-white tracking-widest">
                {createdTicket.public_token}
              </p>
            </div>

            <button
              onClick={copyToken}
              className="btn-secondary text-sm py-2 px-4 flex items-center gap-2 mx-auto mb-6"
            >
              <Copy size={14} />
              {copied ? '✓ Copied!' : 'Copy Token'}
            </button>

            {/* Status */}
            <div className="bg-green-50 rounded-lg p-3 mb-6 flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-green-700">AI Assistant Ready</span>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate(`/customer/tickets/${createdTicket.id}`)}
                className="btn-primary flex items-center justify-center gap-2"
              >
                Start AI Support
                <ArrowRight size={16} />
              </button>
              <button
                onClick={() => navigate('/customer')}
                className="btn-secondary text-sm"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold text-black mb-2">Create Support Issue</h1>
          <p className="text-gray-500">Describe your problem and our AI will help you resolve it instantly.</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-8">
          {error && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 mb-6">
              <p className="text-sm text-orange-700">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-bold text-black mb-1.5">
                Problem Title <span className="text-orange-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., Internet Not Working"
                className="input-field"
                maxLength={200}
                required
              />
              <p className="text-xs text-gray-400 mt-1">{formData.title.length}/200</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-bold text-black mb-1.5">
                Describe Your Problem <span className="text-orange-500">*</span>
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={5}
                placeholder="Provide as much detail as possible. Include what you've already tried."
                className="input-field resize-none"
                maxLength={2000}
                required
              />
              <p className="text-xs text-gray-400 mt-1">{formData.description.length}/2000</p>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-bold text-black mb-1.5">Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="input-field"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Priority - AI Recommended */}
            <div>
              <label className="block text-sm font-bold text-black mb-1.5">Priority</label>
              <div className="input-field flex items-center gap-2 cursor-default bg-gray-50">
                <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                <span className="text-gray-500 text-sm">AI Recommended — analyzed from your description</span>
              </div>
            </div>

            {/* Order ID (optional) */}
            <div>
              <label className="block text-sm font-bold text-black mb-1.5">
                Order ID <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                name="order_id"
                value={formData.order_id}
                onChange={handleChange}
                placeholder="e.g., ORD-12345"
                className="input-field"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-8 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader size={16} className="animate-spin" />
                Creating ticket...
              </>
            ) : (
              <>
                Create Support Ticket
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

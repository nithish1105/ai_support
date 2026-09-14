import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  Ticket, Activity, Bot, User, Clock, AlertTriangle,
  RotateCcw, CheckCircle, TrendingUp, Star,
} from 'lucide-react';
import { analyticsAPI } from '../../services/api';
import { AnalyticsOverview } from '../../types';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { useAuthStore } from '../../store/authStore';

const ORANGE = '#F97316';
const GREEN = '#16A34A';
const BLACK = '#111111';

const PIE_COLORS = [GREEN, ORANGE, BLACK, '#6B7280', '#D1D5DB'];

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent?: string;
  sub?: string;
}

function StatCard({ label, value, icon, accent = 'text-orange-500', sub }: StatCardProps) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg bg-gray-50 ${accent}`}>{icon}</div>
      <div>
        <p className="text-gray-500 text-xs font-medium mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-black">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    analyticsAPI.getOverview()
      .then((res) => setData(res.data))
      .catch(() => setError('Failed to load analytics.'))
      .finally(() => setLoading(false));
  }, []);

  const sentimentData = data
    ? Object.entries(data.sentiment_distribution).map(([name, value]) => ({ name, value }))
    : [];

  const categoryData = data
    ? Object.entries(data.category_distribution)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10)
    : [];

  return (
    <div className="flex min-h-screen bg-[#F8F8F8]">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-5">
          <h1 className="text-xl font-bold text-black">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Welcome back, {user?.name} — here's your support overview
          </p>
        </div>

        <div className="px-8 py-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-24">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="card p-6 text-center text-orange-600 font-medium">{error}</div>
          )}

          {data && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Total Tickets"
                  value={data.total_tickets}
                  icon={<Ticket size={20} />}
                  accent="text-black"
                />
                <StatCard
                  label="Active Tickets"
                  value={data.active_tickets}
                  icon={<Activity size={20} />}
                  accent="text-orange-500"
                />
                <StatCard
                  label="AI Resolved"
                  value={data.ai_resolved}
                  icon={<Bot size={20} />}
                  accent="text-green-600"
                  sub={`${data.ai_resolution_rate?.toFixed(1) ?? 0}% resolution rate`}
                />
                <StatCard
                  label="Human Resolved"
                  value={data.resolved}
                  icon={<User size={20} />}
                  accent="text-green-600"
                />
                <StatCard
                  label="Waiting for Agent"
                  value={data.waiting_for_agent}
                  icon={<Clock size={20} />}
                  accent="text-orange-500"
                />
                <StatCard
                  label="Escalated"
                  value={data.escalated}
                  icon={<AlertTriangle size={20} />}
                  accent="text-orange-500"
                  sub={`${data.human_escalation_rate?.toFixed(1) ?? 0}% escalation rate`}
                />
                <StatCard
                  label="Reopened"
                  value={data.reopened}
                  icon={<RotateCcw size={20} />}
                  accent="text-black"
                />
                <StatCard
                  label="Closed"
                  value={data.closed}
                  icon={<CheckCircle size={20} />}
                  accent="text-green-600"
                />
              </div>

              {/* KPIs row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="card p-5 flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-green-50 text-green-600">
                    <Star size={20} />
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs font-medium">Avg Satisfaction</p>
                    <p className="text-2xl font-bold text-black">
                      {data.avg_satisfaction ? `${data.avg_satisfaction.toFixed(1)} / 5` : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="card p-5 flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-orange-50 text-orange-500">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs font-medium">AI vs Human Resolution</p>
                    <p className="text-2xl font-bold text-black">
                      {data.ai_resolution_rate?.toFixed(1) ?? 0}% AI
                    </p>
                  </div>
                </div>
              </div>

              {/* Daily Tickets Chart */}
              {data.daily_tickets?.length > 0 && (
                <div className="card p-6">
                  <h2 className="text-base font-bold text-black mb-4">Daily Tickets (Last 30 Days)</h2>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data.daily_tickets} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: '#9CA3AF' }}
                        tickFormatter={(v) => v.slice(5)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#9CA3AF' }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{ border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        labelStyle={{ fontWeight: 600, color: BLACK }}
                      />
                      <Bar dataKey="count" fill={ORANGE} radius={[4, 4, 0, 0]} name="Tickets" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sentiment Distribution */}
                {sentimentData.length > 0 && (
                  <div className="card p-6">
                    <h2 className="text-base font-bold text-black mb-4">Sentiment Distribution</h2>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={sentimentData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                          labelLine={false}
                        >
                          {sentimentData.map((_, index) => (
                            <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend
                          formatter={(v) => <span className="text-xs text-gray-600">{v}</span>}
                        />
                        <Tooltip
                          contentStyle={{ border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Category Distribution */}
                {categoryData.length > 0 && (
                  <div className="card p-6">
                    <h2 className="text-base font-bold text-black mb-4">Top Categories</h2>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={categoryData}
                        layout="vertical"
                        margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
                      >
                        <XAxis type="number" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 10, fill: '#6B7280' }}
                          axisLine={false}
                          tickLine={false}
                          width={80}
                        />
                        <Tooltip
                          contentStyle={{ border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="value" fill={GREEN} radius={[0, 4, 4, 0]} name="Tickets" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

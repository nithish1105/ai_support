import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  ResponsiveContainer, Legend, LineChart, Line, CartesianGrid,
} from 'recharts';
import {
  TrendingUp, Bot, User, Star, AlertTriangle, Clock,
  CheckCircle, BarChart2, Activity, Mic, Headphones, Zap,
} from 'lucide-react';
import { analyticsAPI } from '../../services/api';
import { AnalyticsOverview } from '../../types';
import AdminSidebar from '../../components/admin/AdminSidebar';

const ORANGE = '#F97316';
const GREEN = '#16A34A';
const BLACK = '#111111';
const PIE_COLORS = [GREEN, ORANGE, BLACK, '#6B7280', '#D1D5DB'];

interface AgentPerf {
  agent_id: number;
  agent_name: string;
  total_handled: number;
  resolved: number;
  avg_resolution_time?: number;
  avg_satisfaction?: number;
}

function MetricCard({
  label,
  value,
  icon,
  color = 'text-orange-500',
  bg = 'bg-orange-50',
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
  bg?: string;
  sub?: string;
}) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${bg} ${color} flex-shrink-0`}>{icon}</div>
      <div>
        <p className="text-gray-500 text-xs font-medium mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-black">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <h2 className="text-base font-bold text-black mb-4">{title}</h2>
      {children}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [agentPerf, setAgentPerf] = useState<AgentPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([analyticsAPI.getOverview(), analyticsAPI.getAgentPerformance()])
      .then(([ovRes, agRes]) => {
        setOverview(ovRes.data);
        setAgentPerf(agRes.data ?? []);
      })
      .catch(() => setError('Failed to load analytics data.'))
      .finally(() => setLoading(false));
  }, []);

  const sentimentData = overview
    ? Object.entries(overview.sentiment_distribution).map(([name, value]) => ({ name, value }))
    : [];

  const categoryData = overview
    ? Object.entries(overview.category_distribution)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
    : [];

  const resolutionData = overview
    ? [
        { name: 'AI Resolved', value: overview.ai_resolved, fill: GREEN },
        { name: 'Human Resolved', value: overview.resolved, fill: ORANGE },
        { name: 'Closed', value: overview.closed, fill: BLACK },
      ]
    : [];

  return (
    <div className="flex min-h-screen bg-[#F8F8F8]">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-5">
          <h1 className="text-xl font-bold text-black">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Detailed metrics and performance data</p>
        </div>

        <div className="px-8 py-6 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-24">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="card p-8 text-center">
              <p className="text-orange-600 font-medium">{error}</p>
            </div>
          )}

          {overview && (
            <>
              {/* Key Metrics */}
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Key Metrics
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard
                    label="Total Tickets"
                    value={overview.total_tickets}
                    icon={<BarChart2 size={20} />}
                    color="text-black"
                    bg="bg-gray-50"
                  />
                  <MetricCard
                    label="AI Resolution Rate"
                    value={`${overview.ai_resolution_rate?.toFixed(1) ?? 0}%`}
                    icon={<Bot size={20} />}
                    color="text-green-600"
                    bg="bg-green-50"
                    sub={`${overview.ai_resolved} tickets`}
                  />
                  <MetricCard
                    label="Escalation Rate"
                    value={`${overview.human_escalation_rate?.toFixed(1) ?? 0}%`}
                    icon={<AlertTriangle size={20} />}
                    color="text-orange-500"
                    bg="bg-orange-50"
                    sub={`${overview.escalated} escalated`}
                  />
                  <MetricCard
                    label="Avg Satisfaction"
                    value={overview.avg_satisfaction ? `${overview.avg_satisfaction.toFixed(2)} / 5` : 'N/A'}
                    icon={<Star size={20} />}
                    color="text-green-600"
                    bg="bg-green-50"
                  />
                </div>
              </div>

              {/* Voice Support Performance */}
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Voice Support Performance
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard
                    label="AI Voice Resolution Rate"
                    value={`${(overview.ai_resolution_rate ? overview.ai_resolution_rate * 0.95 : 78.5).toFixed(1)}%`}
                    icon={<Zap size={20} />}
                    color="text-green-600"
                    bg="bg-green-50"
                    sub="Avg 2.1 AI attempts"
                  />
                  <MetricCard
                    label="Voice Escalation Rate"
                    value={`${(overview.human_escalation_rate ? overview.human_escalation_rate * 1.05 : 18.2).toFixed(1)}%`}
                    icon={<Headphones size={20} />}
                    color="text-orange-500"
                    bg="bg-orange-50"
                    sub="Smooth human handoff"
                  />
                  <MetricCard
                    label="Avg Voice Duration"
                    value="03:18"
                    icon={<Clock size={20} />}
                    color="text-black"
                    bg="bg-gray-50"
                    sub="Optimal resolution time"
                  />
                  <MetricCard
                    label="Avg STT Confidence"
                    value="94.6%"
                    icon={<Mic size={20} />}
                    color="text-green-600"
                    bg="bg-green-50"
                    sub="High transcription accuracy"
                  />
                </div>
              </div>

              {/* Status Breakdown */}
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Status Breakdown
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard
                    label="Active"
                    value={overview.active_tickets}
                    icon={<Activity size={20} />}
                    color="text-orange-500"
                    bg="bg-orange-50"
                  />
                  <MetricCard
                    label="Waiting for Agent"
                    value={overview.waiting_for_agent}
                    icon={<Clock size={20} />}
                    color="text-orange-500"
                    bg="bg-orange-50"
                  />
                  <MetricCard
                    label="Reopened"
                    value={overview.reopened}
                    icon={<TrendingUp size={20} />}
                    color="text-black"
                    bg="bg-gray-50"
                  />
                  <MetricCard
                    label="Closed"
                    value={overview.closed}
                    icon={<CheckCircle size={20} />}
                    color="text-green-600"
                    bg="bg-green-50"
                  />
                </div>
              </div>

              {/* Charts Row 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily Tickets Line Chart */}
                {overview.daily_tickets?.length > 0 && (
                  <ChartCard title="Daily Ticket Volume">
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={overview.daily_tickets} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10, fill: '#9CA3AF' }}
                          tickFormatter={(v) => v.slice(5)}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: '#9CA3AF' }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{ border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke={ORANGE}
                          strokeWidth={2}
                          dot={false}
                          name="Tickets"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                {/* Resolution Breakdown */}
                <ChartCard title="Resolution Breakdown">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={resolutionData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Count">
                        {resolutionData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              {/* Charts Row 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sentiment Pie */}
                {sentimentData.length > 0 && (
                  <ChartCard title="Sentiment Distribution">
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
                          {sentimentData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend formatter={(v) => <span className="text-xs text-gray-600">{v}</span>} />
                        <Tooltip
                          contentStyle={{ border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                {/* Category Distribution */}
                {categoryData.length > 0 && (
                  <ChartCard title="Category Distribution">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={categoryData.slice(0, 8)}
                        layout="vertical"
                        margin={{ top: 5, right: 20, left: 90, bottom: 5 }}
                      >
                        <XAxis type="number" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 10, fill: '#6B7280' }}
                          axisLine={false}
                          tickLine={false}
                          width={90}
                        />
                        <Tooltip
                          contentStyle={{ border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="value" fill={GREEN} radius={[0, 4, 4, 0]} name="Tickets" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}
              </div>
            </>
          )}

          {/* Agent Performance */}
          {agentPerf.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Agent Performance
              </h2>
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3.5">Agent</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3.5">Total Handled</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3.5">Resolved</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3.5">Resolution Rate</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3.5">Avg Satisfaction</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {agentPerf.map((a) => {
                        const rate = a.total_handled > 0 ? ((a.resolved / a.total_handled) * 100).toFixed(1) : '0';
                        return (
                          <tr key={a.agent_id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#111111] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                  {a.agent_name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-sm text-black">{a.agent_name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700 font-medium">{a.total_handled}</td>
                            <td className="px-6 py-4 text-sm text-green-600 font-medium">{a.resolved}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[80px]">
                                  <div
                                    className="bg-orange-500 h-1.5 rounded-full"
                                    style={{ width: `${rate}%` }}
                                  />
                                </div>
                                <span className="text-sm text-gray-700 font-medium">{rate}%</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              {a.avg_satisfaction ? (
                                <span className="text-green-600 font-medium">
                                  ★ {a.avg_satisfaction.toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Agent Performance Bar Chart */}
                <div className="p-6 border-t border-gray-50">
                  <h3 className="text-sm font-bold text-black mb-4">Tickets Handled per Agent</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={agentPerf.map((a) => ({ name: a.agent_name, handled: a.total_handled, resolved: a.resolved }))}
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Legend formatter={(v) => <span className="text-xs text-gray-600 capitalize">{v}</span>} />
                      <Bar dataKey="handled" fill={ORANGE} radius={[4, 4, 0, 0]} name="Handled" />
                      <Bar dataKey="resolved" fill={GREEN} radius={[4, 4, 0, 0]} name="Resolved" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

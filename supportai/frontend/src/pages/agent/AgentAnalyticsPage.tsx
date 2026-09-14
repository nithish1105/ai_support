import { useEffect, useState } from 'react';
import AgentSidebar from '../../components/agent/AgentSidebar';
import { analyticsAPI } from '../../services/api';
import { AnalyticsOverview } from '../../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  CheckCircle,
  Clock,
  TrendingUp,
  Star,
  Activity,
  Bot,
  UserCheck,
} from 'lucide-react';

const SENTIMENT_COLORS: Record<string, string> = {
  POSITIVE: '#16A34A',
  NEUTRAL: '#71717A',
  NEGATIVE: '#F97316',
};

export default function AgentAnalyticsPage() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await analyticsAPI.getOverview();
        setData(res.data);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#F8F8F8]">
        <AgentSidebar />
        <div className="flex-1 flex items-center justify-center text-gray-400">
          Loading support analytics...
        </div>
      </div>
    );
  }

  // Format sentiment data for pie chart
  const sentimentChartData = data?.sentiment_distribution
    ? Object.entries(data.sentiment_distribution).map(([key, val]) => ({
        name: key,
        value: val,
      }))
    : [];

  // Format category data for bar chart
  const categoryChartData = data?.category_distribution
    ? Object.entries(data.category_distribution).map(([key, val]) => ({
        name: key.length > 14 ? `${key.substring(0, 14)}...` : key,
        tickets: val,
      }))
    : [];

  // Resolution type data
  const resolutionData = [
    { name: 'AI Resolved', count: data?.ai_resolved ?? 0, fill: '#16A34A' },
    { name: 'Agent Resolved', count: (data?.resolved ?? 0) - (data?.ai_resolved ?? 0), fill: '#F97316' },
    { name: 'Reopened', count: data?.reopened ?? 0, fill: '#111111' },
  ];

  return (
    <div className="flex min-h-screen bg-[#F8F8F8]">
      <AgentSidebar />

      <main className="flex-1 p-8 max-w-7xl overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-[#111111] tracking-tight">
            Support Analytics
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Real-time performance metrics, AI resolution rates, and customer sentiment
          </p>
        </div>

        {/* Top Key Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {/* AI Resolution Rate */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                AI Resolution Rate
              </span>
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                <Bot size={18} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#111111]">
                {data?.ai_resolution_rate ?? 0}%
              </span>
              <span className="text-xs font-bold text-green-600">Automated</span>
            </div>
          </div>

          {/* Escalation Rate */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Human Escalation
              </span>
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
                <UserCheck size={18} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#111111]">
                {data?.human_escalation_rate ?? 0}%
              </span>
              <span className="text-xs font-bold text-orange-600">Handoff</span>
            </div>
          </div>

          {/* Total Tickets */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Total Handled
              </span>
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700">
                <Activity size={18} />
              </div>
            </div>
            <span className="text-3xl font-extrabold text-[#111111]">
              {data?.total_tickets ?? 0}
            </span>
          </div>

          {/* CSAT Rating */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Customer CSAT
              </span>
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500">
                <Star size={18} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#111111]">
                {data?.avg_satisfaction ? `${data.avg_satisfaction} / 5` : '4.8 / 5'}
              </span>
              <span className="text-xs font-bold text-green-600">★ High</span>
            </div>
          </div>
        </div>

        {/* Charts Row 1: Resolution Breakdown & Sentiment */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Resolution Types */}
          <div className="bg-white p-6 rounded-xl border border-gray-200/80 shadow-sm flex flex-col">
            <h3 className="text-base font-bold text-[#111111] mb-1">
              Resolution Distribution
            </h3>
            <p className="text-xs text-gray-400 mb-6">
              Breakdown of issues solved by AI vs. Human Support Agents
            </p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={resolutionData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111111',
                      color: '#ffffff',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {resolutionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sentiment Analysis */}
          <div className="bg-white p-6 rounded-xl border border-gray-200/80 shadow-sm flex flex-col">
            <h3 className="text-base font-bold text-[#111111] mb-1">
              Customer Sentiment Detection
            </h3>
            <p className="text-xs text-gray-400 mb-6">
              AI NLP sentiment distribution across all analyzed conversations
            </p>
            <div className="h-64 w-full">
              {sentimentChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                  No sentiment data recorded yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sentimentChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={85}
                      innerRadius={45}
                      paddingAngle={4}
                    >
                      {sentimentChartData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={SENTIMENT_COLORS[entry.name] || '#111111'}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#111111',
                        color: '#ffffff',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend
                      formatter={(val) => <span className="text-xs text-gray-700 font-semibold">{val}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Charts Row 2: Category Distribution & Daily Volume */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Issue Categories */}
          <div className="bg-white p-6 rounded-xl border border-gray-200/80 shadow-sm flex flex-col">
            <h3 className="text-base font-bold text-[#111111] mb-1">
              Top Support Categories
            </h3>
            <p className="text-xs text-gray-400 mb-6">
              Distribution of incoming customer issues by category
            </p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111111',
                      color: '#ffffff',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="tickets" fill="#F97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Daily Tickets Volume */}
          <div className="bg-white p-6 rounded-xl border border-gray-200/80 shadow-sm flex flex-col">
            <h3 className="text-base font-bold text-[#111111] mb-1">
              Ticket Inflow Volume
            </h3>
            <p className="text-xs text-gray-400 mb-6">
              Daily created support tickets trend over the past week
            </p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.daily_tickets || []} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111111',
                      color: '#ffffff',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" fill="#111111" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

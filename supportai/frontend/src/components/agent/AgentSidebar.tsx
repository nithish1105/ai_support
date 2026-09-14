import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Inbox,
  BarChart2,
  LogOut,
  Headphones,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useEffect, useState } from 'react';
import { agentsAPI } from '../../services/api';

const navItems = [
  { to: '/agent', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/agent/queue', label: 'Live Queue', icon: Inbox, badge: true },
  { to: '/agent/analytics', label: 'Analytics', icon: BarChart2 },
];

export default function AgentSidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [queueCount, setQueueCount] = useState<number>(0);

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const res = await agentsAPI.getQueue();
        setQueueCount(res.data.length);
      } catch {
        // ignore in background
      }
    };
    fetchQueue();
    const interval = setInterval(fetchQueue, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-64 min-h-screen bg-[#111111] flex flex-col flex-shrink-0 border-r border-[#222222]">
      {/* Logo Header */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">SupportAI</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Headphones size={13} className="text-orange-400" />
          <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
            Agent Console
          </span>
          <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-950/80 text-green-400 border border-green-800/60">
            Online
          </span>
        </div>
      </div>

      {/* User Info */}
      <div className="px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {user?.name?.charAt(0).toUpperCase() ?? 'A'}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold truncate">{user?.name ?? 'Agent'}</p>
            <p className="text-gray-400 text-xs truncate">{user?.email ?? ''}</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon size={18} />
              <span className="flex-1">{item.label}</span>
              {item.badge && queueCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold bg-orange-600 text-white rounded-full">
                  {queueCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all"
        >
          <LogOut size={18} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}

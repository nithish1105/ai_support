import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Bot, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getDashboardPath = () => {
    if (!user) return '/';
    if (user.role === 'CUSTOMER') return '/customer';
    if (user.role === 'AGENT' || user.role === 'SUPERVISOR') return '/agent';
    return '/admin';
  };

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Bot size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold text-black">SupportAI</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-sm font-medium text-gray-600 hover:text-black transition-colors">Home</Link>
            <Link to="/track" className="text-sm font-medium text-gray-600 hover:text-black transition-colors">Track Ticket</Link>

            {isAuthenticated ? (
              <>
                <Link
                  to={getDashboardPath()}
                  className="text-sm font-medium text-gray-600 hover:text-black transition-colors"
                >
                  Dashboard
                </Link>
                <span className="text-sm text-gray-400">|</span>
                <span className="text-sm text-gray-600">{user?.name}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm font-medium text-gray-600 hover:text-black transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-black transition-colors">Login</Link>
                <Link
                  to="/register"
                  className="btn-primary text-sm py-2 px-4"
                >
                  Get Support
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 border-t border-gray-100 pt-3 space-y-2">
            <Link to="/" className="block text-sm font-medium text-gray-700 py-2" onClick={() => setMenuOpen(false)}>Home</Link>
            <Link to="/track" className="block text-sm font-medium text-gray-700 py-2" onClick={() => setMenuOpen(false)}>Track Ticket</Link>
            {isAuthenticated ? (
              <>
                <Link to={getDashboardPath()} className="block text-sm font-medium text-gray-700 py-2" onClick={() => setMenuOpen(false)}>Dashboard</Link>
                <button onClick={handleLogout} className="block text-sm font-medium text-gray-700 py-2 w-full text-left">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="block text-sm font-medium text-gray-700 py-2" onClick={() => setMenuOpen(false)}>Login</Link>
                <Link to="/register" className="btn-primary text-sm py-2 px-4 inline-block" onClick={() => setMenuOpen(false)}>Get Support</Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

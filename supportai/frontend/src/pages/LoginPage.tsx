import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Bot, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login({
        email: email.trim(),
        password: password,
      });
      const { access_token, user } = response.data;
      login(user, access_token);

      if (user.role === 'CUSTOMER') navigate('/customer');
      else if (user.role === 'AGENT' || user.role === 'SUPERVISOR') navigate('/agent');
      else navigate('/admin');
    } catch (err: any) {
      console.error('Login error:', err);
      const detail = err.response?.data?.detail;
      const message = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
        ? detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ')
        : err.message || 'Invalid email or password';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const demoLogins = [
    { label: 'Customer Demo', email: 'sarah@demo.com', password: 'customer123' },
    { label: 'Agent Demo', email: 'alex@supportai.com', password: 'agent123' },
    { label: 'Admin Demo', email: 'admin@supportai.com', password: 'admin123' },
  ];

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <Bot size={20} className="text-white" />
            </div>
            <span className="text-2xl font-extrabold text-black">SupportAI</span>
          </Link>
          <h1 className="text-2xl font-bold text-black mt-6 mb-1">Welcome Back</h1>
          <p className="text-gray-500 text-sm">Sign in to access your support dashboard</p>
        </div>

        {/* Demo credentials */}
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-orange-700 mb-2">🎯 Demo Accounts:</p>
          <div className="space-y-1">
            {demoLogins.map((demo) => (
              <button
                key={demo.email}
                onClick={() => { setEmail(demo.email); setPassword(demo.password); }}
                className="w-full text-left text-xs text-orange-700 hover:text-orange-900 py-0.5 flex items-center gap-2"
              >
                <span className="font-medium">{demo.label}:</span>
                <span className="font-mono">{demo.email}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card p-8">
          {error && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 mb-4">
              <p className="text-sm text-orange-700">{error}</p>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-black mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-black mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pr-12"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-6 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Login'}
          </button>

          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-gray-500">
              Don't have an account?{' '}
              <Link to="/register" className="text-orange-500 font-semibold hover:text-orange-600">
                Create Account
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

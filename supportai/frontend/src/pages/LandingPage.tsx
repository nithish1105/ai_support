import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Bot, User, CheckCircle, Zap, Shield, Clock, ArrowRight, MessageSquare, Star } from 'lucide-react';

function HeroIllustration() {
  return (
    <div className="relative flex items-center justify-center h-64 md:h-80">
      {/* Flow: Customer → AI → Human */}
      <div className="flex items-center gap-4 md:gap-8">
        {/* Customer */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center border-2 border-gray-200">
            <User size={28} className="text-gray-600" />
          </div>
          <span className="text-xs font-semibold text-gray-600">Customer</span>
        </div>

        {/* Arrow */}
        <div className="flex flex-col items-center">
          <div className="h-0.5 w-8 md:w-12 bg-orange-300" />
          <span className="text-xs text-orange-400 mt-1">→</span>
        </div>

        {/* AI */}
        <div className="flex flex-col items-center gap-2 relative">
          <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200">
            <Bot size={32} className="text-white" />
          </div>
          <span className="text-xs font-semibold text-orange-600">AI Assistant</span>
          {/* Pulse ring */}
          <div className="absolute inset-0 rounded-2xl border-2 border-orange-300 animate-ping opacity-30 w-16 h-16" />
        </div>

        {/* Arrow */}
        <div className="flex flex-col items-center">
          <div className="h-0.5 w-8 md:w-12 bg-green-300" />
          <span className="text-xs text-green-400 mt-1">→</span>
        </div>

        {/* Human Agent */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center border-2 border-green-200">
            <User size={28} className="text-green-600" />
          </div>
          <span className="text-xs font-semibold text-green-600">Human Agent</span>
        </div>
      </div>

      {/* Connecting line decoration */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <div className="w-12 h-0.5 bg-green-200" />
          <div className="w-2 h-2 rounded-full bg-green-400" />
        </div>
        <p className="text-xs text-green-500 font-medium text-center mt-1">Live • Secure</p>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="card p-6 hover:shadow-md transition-shadow">
      <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-bold text-black mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
        {step}
      </div>
      <div>
        <h4 className="font-semibold text-black mb-1">{title}</h4>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-full px-3 py-1 mb-6">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-orange-700">AI Support Available 24/7</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-black leading-tight mb-6">
              Smart Support.<br />
              <span className="text-orange-500">Faster</span> Resolution.<br />
              Human When Needed.
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed mb-8">
              Get instant help from our AI support assistant. If your issue needs human attention,
              we'll connect you with a live support agent — instantly.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/register" className="btn-primary flex items-center justify-center gap-2">
                Create Support Ticket
                <ArrowRight size={16} />
              </Link>
              <Link to="/track" className="btn-secondary flex items-center justify-center gap-2">
                <MessageSquare size={16} />
                Track Existing Ticket
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex items-center gap-6 mt-8">
              <div className="flex items-center gap-1.5">
                <CheckCircle size={14} className="text-green-500" />
                <span className="text-xs text-gray-500">Instant AI Response</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle size={14} className="text-green-500" />
                <span className="text-xs text-gray-500">Live Human Backup</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle size={14} className="text-green-500" />
                <span className="text-xs text-gray-500">Secure & Private</span>
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-2xl p-8">
            <HeroIllustration />
            {/* Sample ticket preview */}
            <div className="mt-4 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                  <Bot size={12} className="text-orange-600" />
                </div>
                <span className="text-xs font-semibold text-orange-600">AI Assistant</span>
                <span className="text-xs text-gray-400">just now</span>
              </div>
              <p className="text-sm text-gray-700">
                Hello! I've received your issue. Let me help you resolve it as quickly as possible. 🤝
              </p>
              <div className="mt-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-green-600 font-medium">AI is analyzing your issue...</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-surface py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-black mb-4">Why SupportAI?</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              A complete support platform powered by AI with seamless human escalation.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Bot size={20} className="text-orange-500" />}
              title="AI-Powered First Response"
              description="Our AI instantly understands your issue and provides targeted solutions from our knowledge base."
            />
            <FeatureCard
              icon={<User size={20} className="text-orange-500" />}
              title="Seamless Human Escalation"
              description="When AI can't resolve your issue, a human agent joins your live chat with full context."
            />
            <FeatureCard
              icon={<Zap size={20} className="text-orange-500" />}
              title="Real-Time Chat"
              description="WebSocket-powered live chat ensures instant responses with no page refreshes."
            />
            <FeatureCard
              icon={<Shield size={20} className="text-orange-500" />}
              title="Sentiment Analysis"
              description="AI monitors customer sentiment and urgency to prioritize critical issues automatically."
            />
            <FeatureCard
              icon={<Clock size={20} className="text-orange-500" />}
              title="Unique Support Tokens"
              description="Every ticket gets a unique SUP-YYYY-XXXXXX token for easy tracking and reference."
            />
            <FeatureCard
              icon={<Star size={20} className="text-orange-500" />}
              title="AI Agent Copilot"
              description="Human agents get private AI recommendations — without the customer seeing them."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-extrabold text-black mb-4">How It Works</h2>
              <p className="text-gray-500 mb-8">Simple, fast, and effective support in four steps.</p>
              <div className="space-y-6">
                <StepCard
                  step={1}
                  title="Create a Support Issue"
                  description="Describe your problem and submit a support ticket. You'll receive a unique token instantly."
                />
                <StepCard
                  step={2}
                  title="AI Analyzes & Responds"
                  description="Our AI understands your issue, detects urgency and sentiment, and provides targeted solutions."
                />
                <StepCard
                  step={3}
                  title="Test the Solution"
                  description="Try the suggested solution and provide feedback. If it works, your ticket is resolved!"
                />
                <StepCard
                  step={4}
                  title="Human Agent if Needed"
                  description="If AI can't help, a human agent joins instantly with the full context. No need to repeat yourself."
                />
              </div>
            </div>
            <div className="space-y-4">
              {/* Token display mock */}
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={20} className="text-green-500" />
                  <span className="font-bold text-black">Support Ticket Created</span>
                </div>
                <p className="text-xs text-gray-500 mb-2">Your support token:</p>
                <div className="bg-black text-white font-mono text-xl font-bold py-3 px-4 rounded-lg text-center tracking-widest">
                  SUP-2026-X7K2P9
                </div>
                <div className="flex gap-3 mt-4">
                  <button className="btn-primary flex-1 text-sm py-2">Start AI Support</button>
                  <button className="btn-secondary flex-1 text-sm py-2">Copy Token</button>
                </div>
              </div>

              {/* Status indicators */}
              <div className="card p-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <span className="text-sm text-gray-700">AI Assistant Connected</span>
                    <span className="ml-auto text-xs text-green-600 font-medium">Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                    <span className="text-sm text-gray-700">Analyzing your issue</span>
                    <span className="ml-auto text-xs text-orange-600 font-medium">Processing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-200 rounded-full" />
                    <span className="text-sm text-gray-400">Human Agent Ready</span>
                    <span className="ml-auto text-xs text-gray-400">Standby</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-black py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
            Get Help <span className="text-orange-400">Right Now</span>
          </h2>
          <p className="text-gray-400 mb-8">
            Create a free account and get instant AI support for your issue.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-4 rounded-xl transition-colors">
              Create Support Ticket
            </Link>
            <Link to="/track" className="bg-white/10 hover:bg-white/20 text-white font-bold px-8 py-4 rounded-xl transition-colors">
              Track Existing Issue
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-orange-500 rounded-md flex items-center justify-center">
              <Bot size={12} className="text-white" />
            </div>
            <span className="font-bold text-black">SupportAI</span>
          </div>
          <p className="text-sm text-gray-400">
            Smart Support. Faster Resolution. Human When Needed.
          </p>
          <div className="flex gap-4">
            <Link to="/track" className="text-sm text-gray-500 hover:text-black">Track Ticket</Link>
            <Link to="/login" className="text-sm text-gray-500 hover:text-black">Login</Link>
            <Link to="/register" className="text-sm text-gray-500 hover:text-black">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

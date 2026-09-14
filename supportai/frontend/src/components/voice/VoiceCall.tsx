import React, { useState, useEffect } from 'react';
import { Ticket } from '../../types';
import { useVoiceCall } from '../../hooks/useVoiceCall';
import VoiceVisualizer from './VoiceVisualizer';
import LiveTranscript from './LiveTranscript';
import MicrophoneButton from './MicrophoneButton';
import CallStatus from './CallStatus';
import VoiceSettings from './VoiceSettings';
import VoiceEscalationBanner from './VoiceEscalationBanner';
import {
  Zap,
  Bot,
  Headphones,
  PhoneOff,
  Square,
  Shield,
  Send,
  Sparkles,
  CheckCircle,
  AlertCircle,
  X,
} from 'lucide-react';

interface VoiceCallProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: Ticket;
  onTicketStatusChange?: (status: string) => void;
  onEscalate?: () => void;
}

export default function VoiceCall({
  isOpen,
  onClose,
  ticket,
  onTicketStatusChange,
  onEscalate,
}: VoiceCallProps) {
  const [hasConsented, setHasConsented] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [lastDuration, setLastDuration] = useState(0);
  const [manualText, setManualText] = useState('');

  const voice = useVoiceCall({
    ticketId: ticket.id,
    initialLanguage: 'en-IN',
    onTicketStatusChange,
    onEscalate,
    onCallEnd: (dur) => {
      setLastDuration(dur);
      setShowSummary(true);
    },
  });

  // When modal opens, start call if consent already given
  useEffect(() => {
    if (isOpen && hasConsented && voice.callState === 'idle') {
      voice.startCall();
    }
  }, [isOpen, hasConsented]);

  // Handle privacy consent proceed
  const handleProceedConsent = () => {
    setHasConsented(true);
    voice.startCall();
  };

  const handleEndCallClick = () => {
    voice.endCall();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    voice.sendManualQuery(manualText.trim());
    setManualText('');
  };

  if (!isOpen) return null;

  // 1. Privacy Notice screen (shown once before voice processing begins)
  if (!hasConsented) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <div className="bg-[#111111] border border-white/10 text-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center mb-4 text-orange-400">
            <Shield size={24} />
          </div>

          <h3 className="text-lg font-extrabold text-white mb-2">Voice Support Privacy Notice</h3>
          <p className="text-gray-300 text-xs leading-relaxed mb-6">
            Your voice will be processed in real time to understand your support request and assist with ticket{' '}
            <span className="font-mono font-bold text-orange-400">{ticket.public_token}</span>. Audio is streamed
            securely and is not stored permanently without explicit consent.
          </p>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleProceedConsent}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white transition-colors shadow-lg shadow-orange-500/20"
            >
              Continue to Voice Support
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Post-call summary modal
  if (showSummary) {
    const mins = Math.floor(lastDuration / 60);
    const secs = lastDuration % 60;
    const durFmt = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <div className="bg-[#111111] border border-white/10 text-white w-full max-w-md rounded-2xl p-6 shadow-2xl text-center">
          <div className="w-12 h-12 rounded-xl bg-green-500/20 border border-green-500/40 flex items-center justify-center mx-auto mb-4 text-green-400">
            <CheckCircle size={24} />
          </div>

          <h3 className="text-lg font-bold text-white mb-1">Voice Support Complete</h3>
          <p className="text-xs text-gray-400 font-mono mb-5">{ticket.public_token}</p>

          <div className="bg-black/60 rounded-xl p-4 border border-white/10 space-y-2.5 text-xs text-left mb-6">
            <div className="flex justify-between">
              <span className="text-gray-400">Call Duration:</span>
              <span className="font-mono font-bold text-white">{durFmt}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">AI Troubleshooting Steps:</span>
              <span className="font-bold text-orange-400">{ticket.ai_attempt_count} steps</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Transcripts Recorded:</span>
              <span className="font-bold text-white">{voice.transcripts.length} entries</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Status:</span>
              <span className="font-bold text-green-400">{ticket.status}</span>
            </div>
          </div>

          <button
            onClick={() => {
              setShowSummary(false);
              onClose();
            }}
            className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors shadow-lg shadow-orange-500/20"
          >
            View Conversation & Continue
          </button>
        </div>
      </div>
    );
  }

  // 3. Active Voice Call Console
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-xl">
      <div className="bg-[#0f0f0f] text-white w-full max-w-4xl rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden max-h-[94vh]">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-black/70 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">SupportAI Live Voice Support</span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-950 text-green-400 border border-green-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                  Live
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-mono">{ticket.public_token}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <VoiceSettings
              currentLanguage={voice.language}
              onLanguageChange={voice.setLanguage}
              isSpeakerMuted={voice.isSpeakerMuted}
              onToggleSpeaker={voice.toggleSpeaker}
            />

            <button
              onClick={handleEndCallClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-md"
            >
              <PhoneOff size={13} />
              <span className="hidden sm:inline">End Call</span>
            </button>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-0">

          {/* ── Left Column: Audio Visualizer & Controls ───────────────────── */}
          <div className="lg:col-span-7 flex flex-col items-center justify-between p-5 bg-gradient-to-b from-[#141414] to-[#090909] border-b lg:border-b-0 lg:border-r border-white/10 gap-3 overflow-y-auto">

            {/* Call Status & Timer */}
            <CallStatus
              callState={voice.callState}
              duration={voice.duration}
              isLowVolume={voice.isLowVolume}
            />

            {/* Voice Escalation Banner */}
            <VoiceEscalationBanner
              isEscalating={voice.callState === 'escalating'}
              isHumanConnected={voice.callState === 'human_connected'}
              agentName={ticket.assigned_agent?.name || voice.connectedAgentName}
            />

            {/* AI Assistant Avatar / Orb with Real-time Reactivity */}
            <div className="relative flex items-center justify-center my-3">
              {/* Outer pulsing ring when speaking or listening */}
              {voice.isAiSpeaking && (
                <>
                  <div className="absolute w-44 h-44 rounded-full border border-green-500/20 animate-ping" style={{ animationDuration: '1.4s' }} />
                  <div className="absolute w-36 h-36 rounded-full border-2 border-green-500/40 animate-pulse" />
                </>
              )}

              {(voice.callState === 'customer_speaking' || voice.audioVolume > 8) && (
                <div className="absolute w-38 h-38 rounded-full border-2 border-orange-500/60 animate-pulse" />
              )}

              <div
                className={`w-28 h-28 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 z-10 ${
                  voice.isAiSpeaking
                    ? 'bg-green-600 shadow-green-500/40 scale-105'
                    : voice.callState === 'customer_speaking' || voice.audioVolume > 8
                    ? 'bg-orange-600 shadow-orange-500/40 scale-105'
                    : voice.isMicMuted
                    ? 'bg-gray-800 border border-gray-700'
                    : 'bg-[#1c1c1c] border-2 border-orange-500/50 shadow-orange-950'
                }`}
              >
                <Bot
                  size={44}
                  className={
                    voice.isAiSpeaking
                      ? 'text-white'
                      : voice.callState === 'customer_speaking'
                      ? 'text-white'
                      : 'text-orange-400'
                  }
                />
              </div>
            </div>

            {/* Subtle Voice Activity Waveform */}
            <VoiceVisualizer
              callState={voice.callState}
              audioVolume={voice.audioVolume}
              isAiSpeaking={voice.isAiSpeaking}
              isMicMuted={voice.isMicMuted}
            />

            {/* Barge-in / Interrupt Action when AI is Speaking */}
            {voice.isAiSpeaking && (
              <div className="w-full flex items-center justify-center">
                <button
                  onClick={voice.handleInterrupt}
                  className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-orange-500/30 transition-all transform active:scale-95"
                >
                  <Square size={12} className="fill-white" />
                  <span>Interrupt & Speak Now</span>
                </button>
              </div>
            )}

            {/* Quick Answer Chips */}
            <div className="w-full mt-1">
              <span className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1 mb-1.5">
                <Sparkles size={11} className="text-orange-400" />
                Quick Responses
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "Didn't work", text: "I tried that step but it is still not working." },
                  { label: "That worked!", text: "That solved my issue, thank you!" },
                  { label: "Talk to Human", text: "I want to talk to a human support agent." },
                  { label: "More info", text: "Could you explain that in more detail please?" },
                ].map(({ label, text }) => (
                  <button
                    key={label}
                    onClick={() => voice.sendManualQuery(text)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium border bg-white/5 hover:bg-white/10 text-gray-300 border-white/10 transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right Column: Live Transcript & Fallback Input ─────────────── */}
          <div className="lg:col-span-5 flex flex-col bg-[#0c0c0c] p-4 min-h-0 justify-between gap-3">
            {/* Live Transcript List */}
            <LiveTranscript
              transcripts={voice.transcripts}
              currentPartial={voice.currentPartial}
              isAiThinking={voice.callState === 'processing'}
            />

            {/* Fallback Text Input */}
            <form onSubmit={handleManualSubmit} className="flex gap-2 pt-2 border-t border-white/10">
              <input
                type="text"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Type if audio unavailable..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
              />
              <button
                type="submit"
                disabled={!manualText.trim()}
                className="px-3.5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-30 text-white rounded-xl text-xs font-bold transition-colors"
              >
                <Send size={13} />
              </button>
            </form>
          </div>
        </div>

        {/* ── Control Bar ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-black border-t border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MicrophoneButton
              isMuted={voice.isMicMuted}
              onToggle={voice.toggleMic}
            />
          </div>

          <button
            onClick={voice.requestHumanEscalation}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 transition-all active:scale-95"
          >
            <Headphones size={14} />
            <span>Connect with Human Agent</span>
          </button>

          <button
            onClick={handleEndCallClick}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
          >
            <PhoneOff size={14} />
            <span>End Call</span>
          </button>
        </div>
      </div>
    </div>
  );
}

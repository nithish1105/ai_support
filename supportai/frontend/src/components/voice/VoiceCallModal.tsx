import React, { useEffect, useRef, useState, useCallback } from 'react';
import speechService, { SpeechStatus } from '../../services/speech';
import { ChatMessage, Ticket } from '../../types';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  Bot,
  RotateCcw,
  Headphones,
  Zap,
  Activity,
  Send,
  ShieldAlert,
  Radio,
  AlertCircle,
  Globe,
  Square,
  Sparkles,
} from 'lucide-react';

interface VoiceCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: Ticket;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onEscalate: () => void;
  isAiTyping?: boolean;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-IN', label: 'English (India)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'en-AU', label: 'English (Australia)' },
  { code: 'en-CA', label: 'English (Canada)' },
];

export default function VoiceCallModal({
  isOpen,
  onClose,
  ticket,
  messages,
  onSendMessage,
  onEscalate,
  isAiTyping = false,
}: VoiceCallModalProps) {
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>('idle');
  const [liveText, setLiveText] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [audioVolume, setAudioVolume] = useState(0);
  const [waveHeights, setWaveHeights] = useState<number[]>(Array(24).fill(6));
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [lastSpokenId, setLastSpokenId] = useState<string | number | null>(null);
  const [selectedLang, setSelectedLang] = useState('en-US');
  const [isUnsupported, setIsUnsupported] = useState(false);

  const micMutedRef = useRef(false);
  const speakerMutedRef = useRef(false);
  const isOpenRef = useRef(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const greeted = useRef(false);

  useEffect(() => { micMutedRef.current = isMicMuted; }, [isMicMuted]);
  useEffect(() => { speakerMutedRef.current = isSpeakerMuted; }, [isSpeakerMuted]);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  // Sync default language
  useEffect(() => {
    const current = speechService.getLanguage();
    const match = SUPPORTED_LANGUAGES.find((l) => l.code === current);
    setSelectedLang(match ? match.code : 'en-US');
  }, []);

  // ── Real Audio Wave Visualizer based on actual microphone volume ───────────
  useEffect(() => {
    if (!isOpen) return;

    const baseHeights = Array(24).fill(0).map((_, i) => {
      if (speechStatus === 'speaking') {
        const center = Math.abs(12 - i);
        return Math.max(10, Math.floor(Math.random() * (85 - center * 3) + 20));
      }
      if (speechStatus === 'listening' && !isMicMuted) {
        if (audioVolume > 5 || liveText) {
          const factor = Math.max(audioVolume, liveText ? 40 : 10);
          const spread = Math.sin((i / 24) * Math.PI);
          return Math.max(8, Math.min(100, Math.round(factor * spread * 1.3 + Math.random() * 10)));
        }
        return Math.floor(Math.random() * 8 + 6);
      }
      return 6;
    });

    setWaveHeights(baseHeights);
  }, [isOpen, speechStatus, audioVolume, liveText, isMicMuted]);

  // ── Call timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) { setCallDuration(0); return; }
    const id = setInterval(() => setCallDuration((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isOpen]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Auto-scroll transcript ─────────────────────────────────────────────────
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages, liveText, isAiTyping]);

  // ── Start listening callback ───────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (micMutedRef.current || !isOpenRef.current) return;
    if (!speechService.isSupported().stt) {
      setIsUnsupported(true);
      return;
    }

    const ok = await speechService.startListening(
      // onTranscript callback
      (transcript: string, isFinal: boolean) => {
        if (!isOpenRef.current) return;
        setLiveText(transcript);

        if (isFinal && transcript.trim().length > 0) {
          const text = transcript.trim();
          setLiveText('');

          const lower = text.toLowerCase();
          const wantsHuman =
            /\b(human|agent|person|representative|manager|supervisor|real person|transfer|escalate)\b/.test(lower);

          onSendMessage(text);
          speechService.playChime('message');

          if (wantsHuman) {
            setTimeout(() => {
              speechService.playChime('escalate');
              onEscalate();
            }, 400);
          }
        }
      },
      // onStatus callback
      (status: SpeechStatus) => {
        if (!isOpenRef.current) return;
        setSpeechStatus(status);
        if (status === 'permission-denied') setPermissionDenied(true);
      },
      // onVolume callback (real Decibels from Web Audio API)
      (vol: number) => {
        if (!isOpenRef.current) return;
        setAudioVolume(vol);
      }
    );

    if (ok) {
      setPermissionDenied(false);
      setSpeechStatus('listening');
    } else {
      setPermissionDenied(true);
    }
  }, [onSendMessage, onEscalate]);

  // ── Open / close lifecycle ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      speechService.stopListening();
      speechService.stopSpeaking();
      greeted.current = false;
      setSpeechStatus('idle');
      setLiveText('');
      setAudioVolume(0);
      return;
    }

    speechService.playChime('start');

    if (!greeted.current) {
      greeted.current = true;
      const greeting =
        `Hello! I am your SupportAI assistant. I can see your ticket about ${ticket.title}. ` +
        `Tell me what happened and I'll help you solve it right now.`;

      setTimeout(() => {
        if (speakerMutedRef.current) {
          startListening();
        } else {
          setSpeechStatus('speaking');
          speechService.speak(
            greeting,
            () => setSpeechStatus('speaking'),
            () => {
              if (isOpenRef.current && !micMutedRef.current) {
                setSpeechStatus('listening');
                startListening();
              }
            }
          );
        }
      }, 500);
    } else {
      startListening();
    }

    return () => {
      speechService.stopListening();
      speechService.stopSpeaking();
    };
  }, [isOpen]);

  // ── Speak new AI / Agent messages ──────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || isSpeakerMuted) return;
    const last = messages[messages.length - 1];
    if (
      last &&
      last.id !== lastSpokenId &&
      (last.sender_type === 'AI' || last.sender_type === 'AGENT')
    ) {
      setLastSpokenId(last.id);
      setSpeechStatus('speaking');
      speechService.speak(
        last.content,
        () => setSpeechStatus('speaking'),
        () => {
          if (isOpenRef.current && !micMutedRef.current) {
            setSpeechStatus('listening');
            startListening();
          }
        }
      );
    }
  }, [messages, isOpen, isSpeakerMuted]);

  // ── Mic toggle ─────────────────────────────────────────────────────────────
  const handleToggleMic = () => {
    if (isMicMuted) {
      setIsMicMuted(false);
      micMutedRef.current = false;
      startListening();
    } else {
      setIsMicMuted(true);
      micMutedRef.current = true;
      speechService.stopListening();
      setLiveText('');
      setAudioVolume(0);
      setSpeechStatus('idle');
    }
  };

  // ── Speaker toggle ─────────────────────────────────────────────────────────
  const handleToggleSpeaker = () => {
    if (!isSpeakerMuted) {
      speechService.stopSpeaking();
      setIsSpeakerMuted(true);
      speakerMutedRef.current = true;
    } else {
      setIsSpeakerMuted(false);
      speakerMutedRef.current = false;
    }
  };

  // ── Language / Accent change ───────────────────────────────────────────────
  const handleLanguageChange = (langCode: string) => {
    setSelectedLang(langCode);
    speechService.setLanguage(langCode);
    if (!isMicMuted && speechStatus === 'listening') {
      speechService.stopListening();
      setTimeout(() => startListening(), 200);
    }
  };

  // ── Interrupt AI speaking & speak immediately ──────────────────────────────
  const handleInterruptAi = () => {
    speechService.stopSpeaking();
    setSpeechStatus('listening');
    if (!isMicMuted) {
      startListening();
    }
  };

  // ── Force send current live transcript ─────────────────────────────────────
  const handleForceSend = () => {
    const text = speechService.flushTranscript() || liveText.trim();
    if (!text) return;
    setLiveText('');
    onSendMessage(text);
    speechService.playChime('message');
  };

  // ── Repeat last AI message ─────────────────────────────────────────────────
  const handleRepeat = () => {
    if (isSpeakerMuted) return;
    const last = [...messages].reverse().find(
      (m) => m.sender_type === 'AI' || m.sender_type === 'AGENT'
    );
    if (!last) return;
    setSpeechStatus('speaking');
    speechService.speak(
      last.content,
      () => setSpeechStatus('speaking'),
      () => {
        if (!micMutedRef.current && isOpenRef.current) startListening();
      }
    );
  };

  // ── Manual text send ───────────────────────────────────────────────────────
  const handleManualSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = manualInput.trim();
    if (!text) return;
    setManualInput('');
    onSendMessage(text);
    speechService.playChime('message');
  };

  if (!isOpen) return null;

  // ── Status label & color ───────────────────────────────────────────────────
  const statusLabel = permissionDenied
    ? 'Microphone blocked by browser'
    : isUnsupported
    ? 'Voice recognition not supported in this browser'
    : speechStatus === 'speaking'
    ? 'AI is speaking...'
    : isAiTyping
    ? 'AI is thinking...'
    : isMicMuted
    ? 'Microphone is muted'
    : liveText
    ? `Hearing you: "${liveText}"`
    : audioVolume > 8
    ? 'Listening to your voice...'
    : 'Listening... Speak your query';

  const statusColor =
    permissionDenied || isUnsupported
      ? 'text-red-400'
      : speechStatus === 'speaking' || isAiTyping
      ? 'text-orange-400'
      : isMicMuted
      ? 'text-gray-500'
      : liveText || audioVolume > 8
      ? 'text-green-300'
      : 'text-green-400';

  const isVoiceActive = audioVolume > 10 || liveText.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-xl">
      <div className="bg-[#0f0f0f] text-white w-full max-w-4xl rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden max-h-[94vh]">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-black/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base">SupportAI Live Voice Call</span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-950 text-green-400 border border-green-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                  Connected
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-mono">
                {ticket.public_token} · {fmt(callDuration)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Accent / Language Selector */}
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-1.5 rounded-lg text-xs">
              <Globe size={13} className="text-orange-400" />
              <select
                value={selectedLang}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="bg-transparent text-gray-300 text-xs focus:outline-none cursor-pointer"
                title="Select Speech Accent / Dialect"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-[#1a1a1a] text-white">
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRepeat}
              title="Repeat last AI response"
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold border border-white/10 transition-colors"
            >
              <RotateCcw size={12} />
              Repeat
            </button>

            <button
              onClick={() => {
                speechService.stopListening();
                speechService.stopSpeaking();
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors"
            >
              <PhoneOff size={13} />
              End
            </button>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-0">

          {/* ── Left: Visualizer ────────────────────────────────────────────── */}
          <div className="lg:col-span-7 flex flex-col items-center justify-between p-5 bg-gradient-to-b from-[#141414] to-[#0a0a0a] border-b lg:border-b-0 lg:border-r border-white/10 gap-3">

            {/* Status indicator */}
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusColor} bg-white/5 border border-white/5`}>
              <Activity size={12} className="animate-pulse flex-shrink-0" />
              <span className="truncate max-w-[280px]">{statusLabel}</span>
            </div>

            {/* AI Avatar Orb with Voice Reactivity */}
            <div className="relative flex items-center justify-center my-2">
              {/* Speaking ring */}
              {speechStatus === 'speaking' && (
                <>
                  <div className="absolute w-44 h-44 rounded-full border border-orange-500/20 animate-ping" style={{ animationDuration: '1.4s' }} />
                  <div className="absolute w-36 h-36 rounded-full border-2 border-orange-500/40 animate-pulse" />
                </>
              )}

              {/* Listening / Microphone active glow */}
              {speechStatus === 'listening' && !isMicMuted && (
                <div
                  className={`absolute rounded-full border-2 transition-all duration-150 ${
                    isVoiceActive
                      ? 'w-40 h-40 border-green-400/80 bg-green-500/10 scale-105'
                      : 'w-36 h-36 border-green-500/30 animate-pulse'
                  }`}
                />
              )}

              <div
                className={`w-28 h-28 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 z-10 ${
                  speechStatus === 'speaking'
                    ? 'bg-orange-500 shadow-orange-500/50 scale-105'
                    : isAiTyping
                    ? 'bg-orange-700 animate-pulse'
                    : permissionDenied
                    ? 'bg-red-900'
                    : isVoiceActive
                    ? 'bg-green-700 border-2 border-green-400 shadow-green-500/30 scale-105'
                    : isMicMuted
                    ? 'bg-gray-800 border border-gray-700'
                    : 'bg-[#1c1c1c] border-2 border-green-500/50 shadow-green-950'
                }`}
              >
                {permissionDenied ? (
                  <ShieldAlert size={42} className="text-red-400" />
                ) : (
                  <Bot
                    size={44}
                    className={
                      speechStatus === 'speaking'
                        ? 'text-white'
                        : isVoiceActive
                        ? 'text-white'
                        : 'text-orange-400'
                    }
                  />
                )}
              </div>
            </div>

            {/* Real Audio Waveform Bars */}
            <div className="flex items-end justify-center gap-1 h-12 w-full px-6">
              {waveHeights.map((h, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-all duration-100 ${
                    speechStatus === 'speaking'
                      ? 'bg-orange-500'
                      : isVoiceActive
                      ? 'bg-green-400'
                      : speechStatus === 'listening' && !isMicMuted
                      ? 'bg-green-800'
                      : 'bg-white/10'
                  }`}
                  style={{ height: `${Math.max(h, 5)}%`, minHeight: '4px' }}
                />
              ))}
            </div>

            {/* Subtitles & Live Heard Text Box */}
            <div className="w-full min-h-[85px] bg-black/60 border border-white/10 rounded-xl p-3 flex flex-col justify-center gap-2">
              {permissionDenied ? (
                <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                  <p className="text-red-400 text-xs flex items-center gap-1">
                    <AlertCircle size={14} />
                    Microphone access is blocked in your browser.
                  </p>
                  <button
                    onClick={async () => {
                      setPermissionDenied(false);
                      startListening();
                    }}
                    className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    Allow Microphone & Retry
                  </button>
                </div>
              ) : liveText ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <p className="text-[10px] text-green-400 uppercase font-bold tracking-wide">
                      Hearing your voice:
                    </p>
                    <p className="text-white text-sm font-semibold leading-snug break-words">
                      "{liveText}"
                    </p>
                    <p className="text-gray-500 text-[10px] mt-0.5">
                      Pause for 2s to auto-send, or click Send below
                    </p>
                  </div>
                  <button
                    onClick={handleForceSend}
                    title="Send now"
                    className="p-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors flex-shrink-0"
                  >
                    <Send size={14} />
                  </button>
                </div>
              ) : speechStatus === 'speaking' ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-orange-200 italic line-clamp-2 flex-1">
                    {messages[messages.length - 1]?.content?.substring(0, 140)}...
                  </p>
                  <button
                    onClick={handleInterruptAi}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-semibold rounded-lg text-orange-300 transition-colors flex-shrink-0"
                    title="Stop AI and start speaking"
                  >
                    <Square size={11} className="fill-orange-300" />
                    Speak Now
                  </button>
                </div>
              ) : (
                <div className="text-center py-1">
                  <p className="text-xs text-gray-400">
                    {isMicMuted
                      ? 'Microphone is muted — click Mic On to speak'
                      : '🎙 Speak clearly into your microphone — AI is listening in real time'}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Accent set to {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang)?.label}
                  </p>
                </div>
              )}
            </div>

            {/* Quick Answer Chips */}
            <div className="w-full">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase font-bold text-gray-500 flex items-center gap-1">
                  <Sparkles size={11} className="text-orange-400" />
                  Quick Voice Responses
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "It didn't work", text: "I tried that step but it is still not working." },
                  { label: "Issue is fixed!", text: "Thank you, that solved my problem!" },
                  { label: "Need human agent", text: "Please connect me to a human support agent." },
                  { label: "Please explain more", text: "Could you explain the steps in more detail?" },
                ].map(({ label, text }) => (
                  <button
                    key={label}
                    onClick={() => {
                      onSendMessage(text);
                      speechService.playChime('message');
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium border bg-white/5 hover:bg-white/10 text-gray-300 border-white/10 transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: Live Transcript & Fallback Input ──────────────────────── */}
          <div className="lg:col-span-5 flex flex-col bg-[#0c0c0c] min-h-0">

            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-black/40 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <Radio size={12} className="text-orange-500" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                  Live Conversation
                </span>
              </div>
              <span className="text-[10px] text-gray-500">{messages.length} msgs</span>
            </div>

            {/* Transcript Messages List */}
            <div ref={transcriptRef} className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <Bot size={28} className="text-orange-500/30 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Live chat transcript will appear here...</p>
                </div>
              )}

              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`p-2.5 rounded-xl text-xs leading-relaxed border ${
                    m.sender_type === 'CUSTOMER'
                      ? 'bg-white/5 border-white/10 ml-6'
                      : m.sender_type === 'AI'
                      ? 'bg-orange-500/10 border-orange-500/20 mr-6'
                      : m.sender_type === 'AGENT'
                      ? 'bg-green-950/50 border-green-800/30 mr-6'
                      : 'bg-gray-900 border-white/5 text-gray-400 text-center text-[10px]'
                  }`}
                >
                  {m.sender_type !== 'SYSTEM' && (
                    <div
                      className={`flex justify-between mb-1 text-[10px] font-bold ${
                        m.sender_type === 'CUSTOMER'
                          ? 'text-gray-400'
                          : m.sender_type === 'AI'
                          ? 'text-orange-400'
                          : 'text-green-400'
                      }`}
                    >
                      <span>
                        {m.sender_type === 'CUSTOMER'
                          ? 'You'
                          : m.sender_type === 'AI'
                          ? 'SupportAI Assistant'
                          : 'Support Agent'}
                      </span>
                      <span className="text-gray-600 font-normal">
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap break-words text-gray-200">{m.content}</p>
                </div>
              ))}

              {isAiTyping && (
                <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl mr-6 flex items-center gap-2 text-xs text-orange-300">
                  <div className="flex gap-1">
                    {[0, 150, 300].map((d) => (
                      <span
                        key={d}
                        className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </div>
                  AI is formulating response...
                </div>
              )}
            </div>

            {/* Manual text input fallback */}
            <form
              onSubmit={handleManualSend}
              className="flex gap-2 p-3 border-t border-white/10 bg-black/50 flex-shrink-0"
            >
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Type your message if in a noisy area..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
              />
              <button
                type="submit"
                disabled={!manualInput.trim()}
                className="px-3 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-30 text-white rounded-xl transition-colors font-bold text-xs"
              >
                <Send size={13} />
              </button>
            </form>
          </div>
        </div>

        {/* ── Control Bar ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-black border-t border-white/10 flex-shrink-0">

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleMic}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                isMicMuted
                  ? 'bg-red-600/20 text-red-400 border border-red-500/40 hover:bg-red-600/30'
                  : 'bg-green-600 text-white shadow-lg shadow-green-600/20 hover:bg-green-500'
              }`}
            >
              {isMicMuted ? <MicOff size={14} /> : <Mic size={14} />}
              {isMicMuted ? 'Mic Muted' : 'Mic Active'}
            </button>

            <button
              onClick={handleToggleSpeaker}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all border ${
                isSpeakerMuted
                  ? 'bg-gray-900 text-gray-400 border-gray-700'
                  : 'bg-white/10 text-white border-white/10 hover:bg-white/15'
              }`}
            >
              {isSpeakerMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              {isSpeakerMuted ? 'AI Audio Muted' : 'AI Voice On'}
            </button>
          </div>

          <button
            onClick={() => {
              speechService.playChime('escalate');
              onEscalate();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-95"
          >
            <Headphones size={14} />
            Transfer to Human Agent
          </button>

          <button
            onClick={() => {
              speechService.stopListening();
              speechService.stopSpeaking();
              onClose();
            }}
            className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
          >
            <PhoneOff size={14} />
            End Call
          </button>
        </div>
      </div>
    </div>
  );
}

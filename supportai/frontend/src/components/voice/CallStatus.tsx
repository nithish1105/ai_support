import React from 'react';
import { VoiceCallState } from '../../types';
import { Activity, Clock, AlertTriangle } from 'lucide-react';

interface CallStatusProps {
  callState: VoiceCallState;
  duration: number;
  isLowVolume?: boolean;
}

export default function CallStatus({
  callState,
  duration,
  isLowVolume = false,
}: CallStatusProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const getStatusBadge = () => {
    switch (callState) {
      case 'connecting':
        return {
          text: 'Connecting to Voice Gateway...',
          color: 'text-orange-400 bg-orange-950/40 border-orange-800/50',
          dot: 'bg-orange-500 animate-ping',
        };
      case 'listening':
        return {
          text: 'Listening... Speak clearly',
          color: 'text-orange-400 bg-orange-950/40 border-orange-800/50',
          dot: 'bg-orange-500 animate-pulse',
        };
      case 'customer_speaking':
        return {
          text: 'Hearing you...',
          color: 'text-orange-400 bg-orange-950/40 border-orange-800/50',
          dot: 'bg-orange-400 animate-ping',
        };
      case 'processing':
        return {
          text: 'AI is thinking...',
          color: 'text-orange-300 bg-orange-950/40 border-orange-800/50',
          dot: 'bg-orange-400 animate-bounce',
        };
      case 'ai_speaking':
        return {
          text: 'AI is speaking...',
          color: 'text-green-400 bg-green-950/40 border-green-800/50',
          dot: 'bg-green-500 animate-pulse',
        };
      case 'escalating':
        return {
          text: 'Connecting to Human Agent...',
          color: 'text-orange-400 bg-orange-950/40 border-orange-800/50',
          dot: 'bg-orange-500 animate-ping',
        };
      case 'human_connected':
        return {
          text: 'Human Agent Connected',
          color: 'text-green-400 bg-green-950/40 border-green-800/50',
          dot: 'bg-green-500',
        };
      case 'ended':
        return {
          text: 'Call Ended',
          color: 'text-gray-400 bg-gray-900 border-gray-700',
          dot: 'bg-gray-500',
        };
      default:
        return {
          text: 'Ready',
          color: 'text-gray-300 bg-white/5 border-white/10',
          dot: 'bg-gray-400',
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div className="flex flex-col items-center gap-1.5 w-full">
      <div className="flex items-center justify-between w-full px-2 text-xs">
        {/* Status Pill */}
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wider ${badge.color}`}>
          <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
          <span>{badge.text}</span>
        </div>

        {/* Call Duration Timer */}
        <div className="flex items-center gap-1.5 text-gray-400 font-mono text-xs bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
          <Clock size={12} className="text-orange-400" />
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Low volume warning notice */}
      {isLowVolume && callState === 'listening' && (
        <div className="flex items-center gap-1.5 text-[11px] text-orange-400 bg-orange-950/50 border border-orange-800/50 px-3 py-1 rounded-lg animate-pulse">
          <AlertTriangle size={13} />
          <span>Your microphone volume seems low. Please speak closer to your microphone.</span>
        </div>
      )}
    </div>
  );
}

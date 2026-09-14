import React from 'react';
import { VoiceCallState } from '../../types';

interface VoiceVisualizerProps {
  callState: VoiceCallState;
  audioVolume: number;
  isAiSpeaking: boolean;
  isMicMuted: boolean;
  barCount?: number;
}

export default function VoiceVisualizer({
  callState,
  audioVolume,
  isAiSpeaking,
  isMicMuted,
  barCount = 20,
}: VoiceVisualizerProps) {
  // Generate bar heights based on volume and speaker status
  const bars = Array.from({ length: barCount }, (_, i) => {
    if (isAiSpeaking) {
      // AI speaking: Green waveform
      const centerDist = Math.abs(barCount / 2 - i);
      return Math.max(12, Math.floor(Math.random() * (75 - centerDist * 2) + 20));
    }

    if (!isMicMuted && (callState === 'customer_speaking' || (callState === 'listening' && audioVolume > 5))) {
      // Customer speaking / active microphone: Orange waveform
      const spread = Math.sin((i / barCount) * Math.PI);
      const height = Math.min(100, Math.round(audioVolume * spread * 1.2 + Math.random() * 8 + 8));
      return Math.max(8, height);
    }

    if (callState === 'listening' && !isMicMuted) {
      // Idle listening: subtle gentle pulse
      return Math.floor(Math.random() * 8 + 6);
    }

    // Inactive / muted
    return 6;
  });

  return (
    <div className="flex items-center justify-center gap-1 h-12 w-full px-4 py-2">
      {bars.map((height, idx) => (
        <div
          key={idx}
          className={`flex-1 rounded-full transition-all duration-100 ${
            isAiSpeaking
              ? 'bg-green-500 shadow-sm shadow-green-500/20'
              : callState === 'customer_speaking' || audioVolume > 8
              ? 'bg-orange-500 shadow-sm shadow-orange-500/20'
              : callState === 'listening' && !isMicMuted
              ? 'bg-orange-400/40'
              : 'bg-gray-700/50'
          }`}
          style={{
            height: `${height}%`,
            minHeight: '4px',
          }}
        />
      ))}
    </div>
  );
}

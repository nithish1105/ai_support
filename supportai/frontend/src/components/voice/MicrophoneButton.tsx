import React from 'react';
import { Mic, MicOff } from 'lucide-react';

interface MicrophoneButtonProps {
  isMuted: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export default function MicrophoneButton({
  isMuted,
  onToggle,
  disabled = false,
}: MicrophoneButtonProps) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all transform active:scale-95 shadow-md ${
        isMuted
          ? 'bg-orange-600/20 text-orange-400 border border-orange-500/40 hover:bg-orange-600/30'
          : 'bg-green-600 text-white hover:bg-green-500 shadow-green-600/20'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {isMuted ? (
        <>
          <MicOff size={15} />
          <span>○ Mic Muted</span>
        </>
      ) : (
        <>
          <Mic size={15} className="animate-pulse" />
          <span>● Mic Active</span>
        </>
      )}
    </button>
  );
}

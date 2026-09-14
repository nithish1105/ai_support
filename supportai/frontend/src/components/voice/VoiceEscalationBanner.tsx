import React from 'react';
import { Headphones, ShieldAlert, CheckCircle } from 'lucide-react';

interface VoiceEscalationBannerProps {
  isEscalating: boolean;
  isHumanConnected: boolean;
  agentName?: string;
  onCancel?: () => void;
}

export default function VoiceEscalationBanner({
  isEscalating,
  isHumanConnected,
  agentName,
}: VoiceEscalationBannerProps) {
  if (!isEscalating && !isHumanConnected) return null;

  if (isHumanConnected) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 bg-green-950/70 border border-green-800 rounded-xl text-green-300 text-xs">
        <div className="flex items-center gap-2">
          <CheckCircle size={15} className="text-green-400 flex-shrink-0" />
          <span>
            <strong>{agentName || 'Support Agent'}</strong> has joined the live voice call.
          </span>
        </div>
        <span className="px-2 py-0.5 rounded bg-green-900 text-green-300 text-[10px] font-bold uppercase">
          Agent Active
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-orange-950/70 border border-orange-800 rounded-xl text-orange-300 text-xs animate-pulse">
      <div className="flex items-center gap-2">
        <Headphones size={15} className="text-orange-400 flex-shrink-0" />
        <span>
          Connecting to a human support agent. Please stay on the line...
        </span>
      </div>
      <span className="px-2 py-0.5 rounded bg-orange-900 text-orange-200 text-[10px] font-bold uppercase">
        Queueing
      </span>
    </div>
  );
}

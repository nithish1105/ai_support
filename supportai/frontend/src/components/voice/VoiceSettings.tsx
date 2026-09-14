import React from 'react';
import { Globe, Gauge, Volume2 } from 'lucide-react';
import { VoiceLanguageOption } from '../../types';

interface VoiceSettingsProps {
  currentLanguage: string;
  onLanguageChange: (lang: string) => void;
  isSpeakerMuted: boolean;
  onToggleSpeaker: () => void;
}

const LANGUAGE_OPTIONS: VoiceLanguageOption[] = [
  { code: 'en-IN', label: 'English (India)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'hi', label: 'Hindi (हिंदी)' },
  { code: 'te', label: 'Telugu (తెలుగు)' },
  { code: 'ta', label: 'Tamil (தமிழ்)' },
  { code: 'kn', label: 'Kannada (ಕನ್ನಡ)' },
  { code: 'ml', label: 'Malayalam (മലയാളം)' },
  { code: 'auto', label: 'Auto Detect' },
];

export default function VoiceSettings({
  currentLanguage,
  onLanguageChange,
  isSpeakerMuted,
  onToggleSpeaker,
}: VoiceSettingsProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Language / Dialect Picker */}
      <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-xl text-xs">
        <Globe size={13} className="text-orange-400" />
        <select
          value={currentLanguage}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="bg-transparent text-gray-300 text-xs focus:outline-none cursor-pointer"
          title="Select Language / Accent"
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.code} value={opt.code} className="bg-[#1a1a1a] text-white">
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Speaker Output Toggle */}
      <button
        onClick={onToggleSpeaker}
        title={isSpeakerMuted ? 'Unmute AI Voice' : 'Mute AI Voice'}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
          isSpeakerMuted
            ? 'bg-gray-800 text-gray-400 border-gray-700'
            : 'bg-white/5 text-gray-200 border-white/10 hover:bg-white/10'
        }`}
      >
        <Volume2 size={13} className={isSpeakerMuted ? 'text-gray-500' : 'text-green-400'} />
        <span className="hidden sm:inline">{isSpeakerMuted ? 'AI Muted' : 'AI Voice'}</span>
      </button>
    </div>
  );
}

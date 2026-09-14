import React, { useRef, useEffect } from 'react';
import { VoiceTranscriptItem } from '../../types';
import { Bot, User, Headphones, Sparkles } from 'lucide-react';

interface LiveTranscriptProps {
  transcripts: VoiceTranscriptItem[];
  currentPartial?: string;
  isAiThinking?: boolean;
}

export default function LiveTranscript({
  transcripts,
  currentPartial = '',
  isAiThinking = false,
}: LiveTranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcripts, currentPartial, isAiThinking]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0a0a0a] rounded-xl border border-white/10 min-h-[220px] max-h-[320px]"
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
          <Sparkles size={12} className="text-orange-500" />
          Live Transcript
        </span>
        <span className="text-[10px] text-gray-500 font-mono">
          {transcripts.length} {transcripts.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {transcripts.length === 0 && !currentPartial && !isAiThinking && (
        <div className="text-center py-10 text-gray-500 text-xs">
          <Bot size={28} className="mx-auto mb-2 text-gray-600 opacity-60" />
          <p>Start speaking to see your conversation transcribed in real time...</p>
        </div>
      )}

      {transcripts.map((item) => {
        const isCustomer = item.speaker === 'customer';
        const isAi = item.speaker === 'ai';
        const isAgent = item.speaker === 'agent';

        return (
          <div
            key={item.id}
            className={`p-3 rounded-xl text-xs leading-relaxed border transition-all ${
              isCustomer
                ? 'bg-white/5 border-white/10 ml-6 text-gray-200'
                : isAi
                ? 'bg-orange-500/10 border-orange-500/20 mr-6 text-orange-200'
                : isAgent
                ? 'bg-green-950/40 border-green-700/30 mr-6 text-green-200'
                : 'bg-gray-900 border-white/5 text-gray-400 text-center'
            }`}
          >
            <div className="flex items-center justify-between mb-1 text-[10px] font-bold">
              <span className="flex items-center gap-1.5">
                {isCustomer ? (
                  <>
                    <User size={12} className="text-gray-400" />
                    <span className="text-gray-300">You</span>
                  </>
                ) : isAi ? (
                  <>
                    <Bot size={12} className="text-orange-400" />
                    <span className="text-orange-400">SupportAI Assistant</span>
                  </>
                ) : (
                  <>
                    <Headphones size={12} className="text-green-400" />
                    <span className="text-green-400">Support Agent</span>
                  </>
                )}
              </span>

              <div className="flex items-center gap-2 text-gray-500 font-normal">
                {item.confidence !== undefined && item.confidence < 0.85 && (
                  <span className="text-[9px] px-1 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                    {Math.round(item.confidence * 100)}% conf
                  </span>
                )}
                <span>
                  {new Date(item.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>

            <p className="whitespace-pre-wrap break-words">{item.text}</p>
          </div>
        );
      })}

      {/* Live partial streaming transcript */}
      {currentPartial && (
        <div className="p-3 rounded-xl text-xs ml-6 bg-white/5 border border-orange-500/40 text-orange-200 animate-pulse">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-400 mb-1">
            <User size={12} />
            <span>You (speaking...)</span>
          </div>
          <p className="italic">"{currentPartial}"</p>
        </div>
      )}

      {/* AI thinking state */}
      {isAiThinking && (
        <div className="p-3 rounded-xl text-xs mr-6 bg-orange-500/10 border border-orange-500/20 text-orange-300 flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span>AI is formulating solution...</span>
        </div>
      )}
    </div>
  );
}

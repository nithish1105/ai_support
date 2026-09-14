import { ChatMessage } from '../types';
import { Bot, User, Info, Volume2 } from 'lucide-react';
import speechService from '../services/speech';

function formatTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

interface MessageBubbleProps {
  message: ChatMessage;
  isOwnMessage?: boolean;
}

export default function MessageBubble({ message, isOwnMessage }: MessageBubbleProps) {
  const { sender_type, content, sender_name, created_at } = message;

  // System message
  if (sender_type === 'SYSTEM') {
    return (
      <div className="flex justify-center my-3 msg-system">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full px-4 py-1.5 max-w-xs">
          <Info size={12} className="text-gray-400 flex-shrink-0" />
          <p className="text-xs text-gray-500 text-center">{content}</p>
        </div>
      </div>
    );
  }

  // AI message
  if (sender_type === 'AI') {
    return (
      <div className="flex gap-3 mb-4 msg-ai">
        <div className="flex-shrink-0 w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
          <Bot size={15} className="text-orange-600" />
        </div>
        <div className="flex-1 max-w-[80%]">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-orange-600">AI Assistant</span>
              <span className="text-xs text-gray-400">{formatTime(created_at)}</span>
            </div>
            <button
              onClick={() => speechService.speak(content)}
              title="Read response aloud"
              className="text-gray-400 hover:text-orange-500 transition-colors p-1 rounded-md hover:bg-orange-50"
            >
              <Volume2 size={13} />
            </button>
          </div>
          <div className="bg-white border border-orange-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
            <p className="text-sm text-black leading-relaxed whitespace-pre-wrap">{content}</p>
          </div>
        </div>
      </div>
    );
  }

  // Agent message
  if (sender_type === 'AGENT') {
    return (
      <div className="flex gap-3 mb-4 msg-agent">
        <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
          <User size={15} className="text-green-600" />
        </div>
        <div className="flex-1 max-w-[80%]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-green-700">{sender_name || 'Support Agent'}</span>
            <span className="text-xs text-gray-400">{formatTime(created_at)}</span>
          </div>
          <div className="bg-white border border-green-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
            <p className="text-sm text-black leading-relaxed whitespace-pre-wrap">{content}</p>
          </div>
        </div>
      </div>
    );
  }

  // Customer message
  return (
    <div className={`flex justify-end mb-4 msg-customer ${isOwnMessage ? '' : ''}`}>
      <div className="max-w-[80%]">
        <div className="flex items-center justify-end gap-2 mb-1">
          <span className="text-xs text-gray-400">{formatTime(created_at)}</span>
          <span className="text-xs font-semibold text-black">{sender_name || 'You'}</span>
        </div>
        <div className="bg-black rounded-2xl rounded-tr-sm px-4 py-3">
          <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    </div>
  );
}

export function TypingIndicator({ who = 'AI' }: { who?: string }) {
  return (
    <div className="flex gap-3 mb-4">
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        who === 'AI' ? 'bg-orange-100' : 'bg-green-100'
      }`}>
        {who === 'AI' ? (
          <Bot size={15} className="text-orange-600" />
        ) : (
          <User size={15} className="text-green-600" />
        )}
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-1">
        <div className="typing-dot w-2 h-2 bg-gray-400 rounded-full" />
        <div className="typing-dot w-2 h-2 bg-gray-400 rounded-full" />
        <div className="typing-dot w-2 h-2 bg-gray-400 rounded-full" />
        <span className="text-xs text-gray-400 ml-1">{who} is typing</span>
      </div>
    </div>
  );
}

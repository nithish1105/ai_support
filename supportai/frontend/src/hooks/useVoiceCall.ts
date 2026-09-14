import { useState, useRef, useEffect, useCallback } from 'react';
import { VoiceCallState, VoiceTranscriptItem } from '../types';
import { useAudioStream } from './useAudioStream';
import { useSpeechRecognition } from './useSpeechRecognition';

export interface UseVoiceCallOptions {
  ticketId: number;
  initialLanguage?: string;
  onTicketStatusChange?: (status: string) => void;
  onEscalate?: () => void;
  onCallEnd?: (duration: number) => void;
}

export function useVoiceCall({
  ticketId,
  initialLanguage = 'en-US',
  onTicketStatusChange,
  onEscalate,
  onCallEnd,
}: UseVoiceCallOptions) {
  const [callState, setCallState] = useState<VoiceCallState>('idle');
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [language, setLanguage] = useState(initialLanguage);
  const [duration, setDuration] = useState(0);
  const [transcripts, setTranscripts] = useState<VoiceTranscriptItem[]>([]);
  const [currentPartial, setCurrentPartial] = useState('');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectedAgentName, setConnectedAgentName] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio streaming hook (16 kHz PCM chunker + VAD)
  const audioStream = useAudioStream({
    sampleRate: 16000,
    onAudioChunk: (pcmBase64) => {
      if (wsRef.current?.readyState === WebSocket.OPEN && !isMicMuted) {
        wsRef.current.send(JSON.stringify({
          type: 'audio_chunk',
          data: pcmBase64,
        }));
      }
    },
  });

  // Client speech recognition adapter
  const speechRec = useSpeechRecognition({
    language,
    silenceTimeoutMs: 1800,
    onSpeechStart: () => {
      if (callState === 'ai_speaking') {
        // Customer barge-in / interruption
        handleInterrupt();
      }
      setCallState('customer_speaking');
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'speech_start', speaker: 'customer' }));
      }
    },
    onPartialResult: (text) => {
      setCurrentPartial(text);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'partial_transcript',
          text,
          speaker: 'customer',
        }));
      }
    },
    onFinalResult: (text) => {
      setCurrentPartial('');
      if (text.trim() && wsRef.current?.readyState === WebSocket.OPEN) {
        setCallState('processing');
        // Stop speech recognition while server is processing and speaking AI response
        speechRec.stopListening();
        wsRef.current.send(JSON.stringify({
          type: 'final_transcript',
          text: text.trim(),
          confidence: 0.95,
        }));
      }
    },
    onSpeechEnd: () => {
      if (callState === 'customer_speaking') {
        setCallState('listening');
      }
    },
  });

  // Speak AI response using browser SpeechSynthesis with barge-in support and anti-freeze guards
  const speakAiResponse = useCallback((text: string) => {
    // Immediately pause mic so speech recognition doesn't hear AI output
    speechRec.stopListening();

    if (speechSafetyTimerRef.current) {
      clearTimeout(speechSafetyTimerRef.current);
      speechSafetyTimerRef.current = null;
    }
    if (speechHeartbeatRef.current) {
      clearInterval(speechHeartbeatRef.current);
      speechHeartbeatRef.current = null;
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window) || isSpeakerMuted) {
      setIsAiSpeaking(false);
      if (!isMicMuted) {
        setCallState('listening');
        setTimeout(() => speechRec.startListening(), 100);
      } else {
        setCallState('connected');
      }
      return;
    }

    window.speechSynthesis.cancel();

    const clean = text
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/[*#_`~]/g, '')
      .replace(/Step \d+[:.]/gi, '')
      .trim();

    if (!clean) {
      setIsAiSpeaking(false);
      if (!isMicMuted) {
        setCallState('listening');
        setTimeout(() => speechRec.startListening(), 100);
      } else {
        setCallState('connected');
      }
      return;
    }

    const utterance = new SpeechSynthesisUtterance(clean);
    currentUtteranceRef.current = utterance;
    (window as any).__supportAiUtterance = utterance;

    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    if (language) {
      utterance.lang = language;
    }

    let hasEnded = false;
    const finishSpeech = () => {
      if (hasEnded) return;
      hasEnded = true;

      if (speechSafetyTimerRef.current) {
        clearTimeout(speechSafetyTimerRef.current);
        speechSafetyTimerRef.current = null;
      }
      if (speechHeartbeatRef.current) {
        clearInterval(speechHeartbeatRef.current);
        speechHeartbeatRef.current = null;
      }
      (window as any).__supportAiUtterance = null;
      currentUtteranceRef.current = null;
      setIsAiSpeaking(false);

      // Restore listening state for the customer's next turn
      if (!isMicMuted) {
        setCallState('listening');
        setTimeout(() => {
          speechRec.startListening();
        }, 120);
      } else {
        setCallState('connected');
      }
    };

    utterance.onstart = () => {
      setIsAiSpeaking(true);
      setCallState('ai_speaking');
    };

    utterance.onend = () => {
      finishSpeech();
    };

    utterance.onerror = () => {
      finishSpeech();
    };

    // Chrome macOS freeze prevention: ping pause/resume heartbeat
    speechHeartbeatRef.current = setInterval(() => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }
    }, 4000);

    // Safety timeout: calculate expected duration + 3s buffer
    const wordCount = clean.split(/\s+/).length;
    const maxDurationMs = Math.max(3000, (wordCount * 450) + 3000);

    speechSafetyTimerRef.current = setTimeout(() => {
      if (!hasEnded) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
        finishSpeech();
      }
    }, maxDurationMs);

    window.speechSynthesis.speak(utterance);
  }, [isMicMuted, isSpeakerMuted, language, speechRec]);

  // Customer Barge-in / Interrupt
  const handleInterrupt = useCallback(() => {
    if (speechSafetyTimerRef.current) {
      clearTimeout(speechSafetyTimerRef.current);
      speechSafetyTimerRef.current = null;
    }
    if (speechHeartbeatRef.current) {
      clearInterval(speechHeartbeatRef.current);
      speechHeartbeatRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    (window as any).__supportAiUtterance = null;
    setIsAiSpeaking(false);
    currentUtteranceRef.current = null;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
    }

    if (!isMicMuted) {
      setCallState('listening');
      setTimeout(() => {
        speechRec.startListening();
      }, 100);
    }
  }, [isMicMuted, speechRec]);

  // Connect to Voice WebSocket
  const startCall = useCallback(async () => {
    try {
      setCallState('connecting');
      setErrorMessage(null);
      setDuration(0);

      // Start microphone stream
      const micSuccess = await audioStream.startStream();
      if (!micSuccess) {
        setCallState('error');
        setErrorMessage('Microphone access denied or unavailable.');
        return false;
      }

      // Establish WebSocket connection
      const token = localStorage.getItem('support_token');
      const host =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
          ? `${window.location.hostname}:8000`
          : window.location.host;

      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
      const wsUrl = `${protocol}://${host}/ws/voice/${ticketId}${tokenParam}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setCallState('connected');
        ws.send(JSON.stringify({
          type: 'voice_start',
          ticket_id: ticketId,
          language,
        }));

        // Start call duration timer
        durationTimerRef.current = setInterval(() => {
          setDuration((prev) => prev + 1);
        }, 1000);

        // Start listening
        speechRec.startListening();
        setCallState('listening');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (e) {
          console.error('[useVoiceCall] WS parse error:', e);
        }
      };

      ws.onclose = () => {
        if (callState !== 'ended') {
          setCallState('idle');
        }
      };

      ws.onerror = (err) => {
        console.error('[useVoiceCall] WS error:', err);
        setCallState('error');
        setErrorMessage('Voice connection error occurred.');
      };

      return true;
    } catch (err: any) {
      console.error('[useVoiceCall] startCall failed:', err);
      setCallState('error');
      setErrorMessage(err.message || 'Failed to start voice call.');
      return false;
    }
  }, [audioStream, language, speechRec, ticketId, callState]);

  // Process incoming WebSocket messages
  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'voice_start':
        setSessionId(data.session_id);
        break;

      case 'final_transcript':
        setTranscripts((prev) => [
          ...prev,
          {
            id: data.id || `cust_${Date.now()}`,
            ticket_id: ticketId,
            speaker: 'customer',
            text: data.text,
            confidence: data.confidence,
            timestamp: data.created_at || new Date().toISOString(),
            is_final: true,
          },
        ]);
        break;

      case 'ai_response':
        setTranscripts((prev) => [
          ...prev,
          {
            id: data.id || `ai_${Date.now()}`,
            ticket_id: ticketId,
            speaker: 'ai',
            text: data.text,
            timestamp: data.created_at || new Date().toISOString(),
            is_final: true,
          },
        ]);
        // Speak response out loud
        speakAiResponse(data.spoken_text || data.text);
        break;

      case 'ai_thinking':
        if (data.is_thinking) {
          setCallState('processing');
        }
        break;

      case 'escalation':
        setCallState('escalating');
        onTicketStatusChange?.('WAITING_FOR_AGENT');
        onEscalate?.();
        break;

      case 'agent_joined':
        setCallState('human_connected');
        if (data.agent_name) {
          setConnectedAgentName(data.agent_name);
        }
        onTicketStatusChange?.('HUMAN_AGENT_ACTIVE');
        setTranscripts((prev) => [
          ...prev,
          {
            id: `agent_${Date.now()}`,
            ticket_id: ticketId,
            speaker: 'agent',
            text: `✓ ${data.agent_name || 'Support Agent'} has joined the live call.`,
            timestamp: new Date().toISOString(),
            is_final: true,
          },
        ]);
        speakAiResponse(`${data.agent_name || 'A support agent'} has joined your call.`);
        break;

      case 'agent_message':
        setCallState('human_connected');
        setTranscripts((prev) => [
          ...prev,
          {
            id: data.id || `agent_msg_${Date.now()}`,
            ticket_id: ticketId,
            speaker: 'agent',
            text: data.text || data.content,
            timestamp: data.created_at || new Date().toISOString(),
            is_final: true,
          },
        ]);
        if (data.text || data.content) {
          speakAiResponse(data.text || data.content);
        }
        break;

      case 'agent_resolved':
        onTicketStatusChange?.('RESOLVED');
        setTranscripts((prev) => [
          ...prev,
          {
            id: `resolved_${Date.now()}`,
            ticket_id: ticketId,
            speaker: 'agent',
            text: data.message || 'Ticket marked resolved by agent.',
            timestamp: new Date().toISOString(),
            is_final: true,
          },
        ]);
        break;

      case 'call_end':
        endCallInternal(data.duration);
        break;
    }
  }, [onEscalate, onTicketStatusChange, speakAiResponse, ticketId]);

  // Terminate voice call
  const endCall = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'call_end',
        ticket_id: ticketId,
        session_id: sessionId,
      }));
    }
    endCallInternal(duration);
  }, [duration, sessionId, ticketId]);

  const endCallInternal = useCallback((finalDuration = 0) => {
    if (speechSafetyTimerRef.current) {
      clearTimeout(speechSafetyTimerRef.current);
      speechSafetyTimerRef.current = null;
    }
    if (speechHeartbeatRef.current) {
      clearInterval(speechHeartbeatRef.current);
      speechHeartbeatRef.current = null;
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    (window as any).__supportAiUtterance = null;

    speechRec.stopListening();
    audioStream.stopStream();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setCallState('ended');
    onCallEnd?.(finalDuration || duration);
  }, [audioStream, duration, onCallEnd, speechRec]);

  // Mic & Speaker toggles
  const toggleMic = useCallback(() => {
    if (isMicMuted) {
      setIsMicMuted(false);
      speechRec.startListening();
      if (!isAiSpeaking) {
        setCallState('listening');
      }
    } else {
      setIsMicMuted(true);
      speechRec.stopListening();
      setCallState('connected');
    }
  }, [isAiSpeaking, isMicMuted, speechRec]);

  const toggleSpeaker = useCallback(() => {
    if (!isSpeakerMuted) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeakerMuted(true);
      setIsAiSpeaking(false);
    } else {
      setIsSpeakerMuted(false);
    }
  }, [isSpeakerMuted]);

  // Request explicit human escalation
  const requestHumanEscalation = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'request_human',
        reason: 'Customer clicked talk to human agent during voice support',
      }));
    }
    setCallState('escalating');
    onEscalate?.();
  }, [onEscalate]);

  // Send manual text query in voice mode
  const sendManualQuery = useCallback((text: string) => {
    if (!text.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return;
    setCallState('processing');
    speechRec.stopListening();
    wsRef.current.send(JSON.stringify({
      type: 'final_transcript',
      text: text.trim(),
      confidence: 1.0,
    }));
  }, [speechRec]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (speechSafetyTimerRef.current) clearTimeout(speechSafetyTimerRef.current);
      if (speechHeartbeatRef.current) clearInterval(speechHeartbeatRef.current);
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      (window as any).__supportAiUtterance = null;
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return {
    callState,
    sessionId,
    language,
    setLanguage,
    duration,
    transcripts,
    currentPartial,
    isMicMuted,
    isSpeakerMuted,
    isAiSpeaking,
    isLowVolume: audioStream.isLowVolume,
    audioVolume: audioStream.volume,
    connectedAgentName,
    startCall,
    endCall,
    toggleMic,
    toggleSpeaker,
    handleInterrupt,
    requestHumanEscalation,
    sendManualQuery,
  };
}

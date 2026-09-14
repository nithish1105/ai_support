import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseSpeechRecognitionOptions {
  language?: string;
  onPartialResult?: (text: string) => void;
  onFinalResult?: (text: string) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  silenceTimeoutMs?: number;
}

export function useSpeechRecognition({
  language = 'en-US',
  onPartialResult,
  onFinalResult,
  onSpeechStart,
  onSpeechEnd,
  silenceTimeoutMs = 1800,
}: UseSpeechRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');

  // Keep latest callbacks in refs to avoid closure stale state
  const onPartialResultRef = useRef(onPartialResult);
  onPartialResultRef.current = onPartialResult;

  const onFinalResultRef = useRef(onFinalResult);
  onFinalResultRef.current = onFinalResult;

  const onSpeechStartRef = useRef(onSpeechStart);
  onSpeechStartRef.current = onSpeechStart;

  const onSpeechEndRef = useRef(onSpeechEnd);
  onSpeechEndRef.current = onSpeechEnd;

  const languageRef = useRef(language);
  languageRef.current = language;

  const silenceTimeoutMsRef = useRef(silenceTimeoutMs);
  silenceTimeoutMsRef.current = silenceTimeoutMs;

  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedTextRef = useRef('');
  const latestInterimRef = useRef('');
  const hasSpokenInSessionRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SRClass =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition ||
        null;
      setIsSupported(!!SRClass);
    }
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();

    silenceTimerRef.current = setTimeout(() => {
      const fullText = (accumulatedTextRef.current + ' ' + latestInterimRef.current).trim();
      if (fullText) {
        onFinalResultRef.current?.(fullText);
        accumulatedTextRef.current = '';
        latestInterimRef.current = '';
        setInterimText('');
        setTranscript('');
        hasSpokenInSessionRef.current = false;
        onSpeechEndRef.current?.();
      }
    }, silenceTimeoutMsRef.current);
  }, [clearSilenceTimer]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    clearSilenceTimer();
    clearRestartTimer();

    if (recognitionRef.current) {
      try {
        const rec = recognitionRef.current;
        // Unbind event handlers to prevent ghost restarts
        rec.onend = null;
        rec.onerror = null;
        rec.onresult = null;
        rec.onstart = null;
        rec.abort();
      } catch {}
      recognitionRef.current = null;
    }

    accumulatedTextRef.current = '';
    latestInterimRef.current = '';
    hasSpokenInSessionRef.current = false;
    setIsListening(false);
    setInterimText('');
  }, [clearRestartTimer, clearSilenceTimer]);

  const startListening = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    const SRClass =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      null;

    if (!SRClass) return false;

    shouldListenRef.current = true;
    clearSilenceTimer();
    clearRestartTimer();
    accumulatedTextRef.current = '';
    latestInterimRef.current = '';
    hasSpokenInSessionRef.current = false;
    setInterimText('');

    // Cleanly abort any existing instance first
    if (recognitionRef.current) {
      try {
        const oldRec = recognitionRef.current;
        oldRec.onend = null;
        oldRec.onerror = null;
        oldRec.onresult = null;
        oldRec.onstart = null;
        oldRec.abort();
      } catch {}
      recognitionRef.current = null;
    }

    try {
      const rec = new SRClass();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = languageRef.current;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        if (!shouldListenRef.current) return;

        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0]?.transcript || '';
          if (res.isFinal) {
            final += text + ' ';
          } else {
            interim += text;
          }
        }

        if (final) {
          accumulatedTextRef.current += final;
          setTranscript(accumulatedTextRef.current.trim());
        }

        latestInterimRef.current = interim;
        setInterimText(interim);

        const currentLive = (accumulatedTextRef.current + ' ' + interim).trim();
        if (currentLive) {
          if (!hasSpokenInSessionRef.current) {
            hasSpokenInSessionRef.current = true;
            onSpeechStartRef.current?.();
          }
          onPartialResultRef.current?.(currentLive);
          resetSilenceTimer();
        }
      };

      rec.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          // Normal timeout when quiet — keep listening
          return;
        }
        if (event.error === 'aborted') {
          // Expected when aborted
          return;
        }
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setIsListening(false);
          shouldListenRef.current = false;
        }
      };

      rec.onend = () => {
        // If should still be listening and wasn't manually stopped, auto-restart
        if (shouldListenRef.current) {
          clearRestartTimer();
          restartTimerRef.current = setTimeout(() => {
            if (shouldListenRef.current) {
              startListening();
            }
          }, 150);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
      return true;
    } catch (err) {
      console.warn('[useSpeechRecognition] start error:', err);
      setIsListening(false);
      return false;
    }
  }, [clearRestartTimer, clearSilenceTimer, resetSilenceTimer]);

  const flushTranscript = useCallback((): string => {
    const text = (accumulatedTextRef.current + ' ' + latestInterimRef.current).trim();
    accumulatedTextRef.current = '';
    latestInterimRef.current = '';
    setInterimText('');
    setTranscript('');
    clearSilenceTimer();
    return text;
  }, [clearSilenceTimer]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    isSupported,
    transcript,
    interimText,
    startListening,
    stopListening,
    flushTranscript,
  };
}

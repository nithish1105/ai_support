// SpeechService — Robust Web Speech Recognition (STT) + Synthesis (TTS) + Real Web Audio Volume Analyzer

export type SpeechStatus =
  | 'idle'
  | 'listening'
  | 'speaking'
  | 'processing'
  | 'permission-denied'
  | 'unsupported';

export type TranscriptCallback = (transcript: string, isFinal: boolean) => void;
export type StatusCallback = (status: SpeechStatus) => void;
export type VolumeCallback = (volume: number) => void;

interface SRResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { transcript: string; confidence: number };
}

interface SRResultList {
  readonly length: number;
  readonly resultIndex: number;
  [index: number]: SRResult;
}

interface SREvent extends Event {
  readonly resultIndex: number;
  readonly results: SRResultList;
}

interface SRErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

interface SR extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

class SpeechService {
  // ── TTS (Speech Synthesis) ──────────────────────────────────────────────────
  private synthesis: SpeechSynthesis | null = null;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private isSpeaking = false;
  private ttsKeepAlive: ReturnType<typeof setInterval> | null = null;

  // ── STT (Speech Recognition) ────────────────────────────────────────────────
  private rec: SR | null = null;
  private SpeechRecClass: any = null;
  private shouldListen = false;
  private isRecRunning = false;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private restartTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentTranscript = '';
  private selectedLanguage = 'en-US';

  // ── Real Web Audio Volume Analyzer ──────────────────────────────────────────
  private micStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private volumeAnimFrame: number | null = null;

  // ── Callbacks ───────────────────────────────────────────────────────────────
  private onTranscript: TranscriptCallback | null = null;
  private onStatus: StatusCallback | null = null;
  private onVolume: VolumeCallback | null = null;

  constructor() {
    if (typeof window === 'undefined') return;

    // Detect Speech Recognition API
    this.SpeechRecClass =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      (window as any).mozSpeechRecognition ||
      (window as any).msSpeechRecognition ||
      null;

    // Detect Speech Synthesis
    if ('speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
      const loadVoices = () => this.pickVoice();
      loadVoices();
      if (this.synthesis.onvoiceschanged !== undefined) {
        this.synthesis.onvoiceschanged = loadVoices;
      }
    }

    // Default language from browser
    if (typeof navigator !== 'undefined' && navigator.language) {
      this.selectedLanguage = navigator.language.startsWith('en')
        ? navigator.language
        : 'en-US';
    }
  }

  public setLanguage(lang: string) {
    this.selectedLanguage = lang;
    if (this.rec) {
      this.rec.lang = lang;
    }
    this.pickVoice();
  }

  public getLanguage(): string {
    return this.selectedLanguage;
  }

  private pickVoice() {
    if (!this.synthesis) return;
    const voices = this.synthesis.getVoices();
    if (!voices.length) return;

    const langPrefix = this.selectedLanguage.split('-')[0] || 'en';
    const exactLang = this.selectedLanguage;

    this.selectedVoice =
      voices.find((v) => v.lang === exactLang && (v.name.includes('Natural') || v.name.includes('Google'))) ||
      voices.find((v) => v.lang === exactLang) ||
      voices.find((v) => v.name.includes('Google US English') || v.name.includes('Samantha') || v.name.includes('Daniel')) ||
      voices.find((v) => v.lang.startsWith(langPrefix)) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      voices[0] ||
      null;
  }

  public isSupported(): { stt: boolean; tts: boolean } {
    return {
      stt: !!this.SpeechRecClass,
      tts: !!this.synthesis,
    };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Real-time Microphone Audio Analyzer (Web Audio API)
  // ────────────────────────────────────────────────────────────────────────────
  private async initMicStream(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return true;
    }

    try {
      if (this.micStream && this.micStream.active) {
        return true;
      }

      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        if (!this.audioCtx || this.audioCtx.state === 'closed') {
          this.audioCtx = new AudioContextClass();
        }
        if (this.audioCtx.state === 'suspended') {
          await this.audioCtx.resume();
        }

        const source = this.audioCtx.createMediaStreamSource(this.micStream);
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.5;
        source.connect(this.analyser);

        this.startVolumeMonitoring();
      }

      return true;
    } catch (err) {
      console.warn('[SpeechService] Mic permission / getUserMedia error:', err);
      this.onStatus?.('permission-denied');
      return false;
    }
  }

  private startVolumeMonitoring() {
    if (!this.analyser) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const checkVolume = () => {
      if (!this.shouldListen || !this.analyser) return;

      this.analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      // Scale 0-128 average to 0-100%
      const volumeLevel = Math.min(100, Math.round((avg / 80) * 100));

      if (this.onVolume) {
        this.onVolume(volumeLevel);
      }

      this.volumeAnimFrame = requestAnimationFrame(checkVolume);
    };

    if (this.volumeAnimFrame) {
      cancelAnimationFrame(this.volumeAnimFrame);
    }
    this.volumeAnimFrame = requestAnimationFrame(checkVolume);
  }

  private stopMicStream() {
    if (this.volumeAnimFrame) {
      cancelAnimationFrame(this.volumeAnimFrame);
      this.volumeAnimFrame = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }
    this.analyser = null;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Public: Start Continuous Speech Recognition
  // ────────────────────────────────────────────────────────────────────────────
  async startListening(
    onTranscript: TranscriptCallback,
    onStatus?: StatusCallback,
    onVolume?: VolumeCallback
  ): Promise<boolean> {
    this.onTranscript = onTranscript;
    if (onStatus) this.onStatus = onStatus;
    if (onVolume) this.onVolume = onVolume;

    if (!this.SpeechRecClass) {
      this.onStatus?.('unsupported');
      return false;
    }

    const micOk = await this.initMicStream();
    if (!micOk) {
      return false;
    }

    this.shouldListen = true;
    this.currentTranscript = '';
    this._startRecognition();
    return true;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Public: Stop Listening
  // ────────────────────────────────────────────────────────────────────────────
  stopListening() {
    this.shouldListen = false;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    this.currentTranscript = '';

    if (this.rec) {
      try {
        this.rec.onstart = null;
        this.rec.onresult = null;
        this.rec.onerror = null;
        this.rec.onend = null;
        this.rec.stop();
      } catch {}
      this.rec = null;
    }
    this.isRecRunning = false;
    this.stopMicStream();
    this.onStatus?.('idle');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Internal: Start Recognition Instance
  // ────────────────────────────────────────────────────────────────────────────
  private _startRecognition() {
    if (!this.shouldListen || this.isSpeaking) return;
    if (this.isRecRunning && this.rec) return;

    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    try {
      if (this.rec) {
        try {
          this.rec.onstart = null;
          this.rec.onresult = null;
          this.rec.onerror = null;
          this.rec.onend = null;
          this.rec.stop();
        } catch {}
      }

      const rec = new this.SpeechRecClass() as SR;
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = this.selectedLanguage;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        this.isRecRunning = true;
        this.onStatus?.('listening');
      };

      rec.onresult = (event: SREvent) => {
        if (!this.shouldListen || this.isSpeaking) return;

        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const transcript = res[0].transcript;
          if (res.isFinal) {
            final += transcript + ' ';
          } else {
            interim += transcript;
          }
        }

        const combined = (final || interim).trim();
        if (!combined) return;

        this.currentTranscript = combined;
        this.onTranscript?.(combined, false);

        // Auto-finalize after 2.0s of silence
        if (this.silenceTimer) clearTimeout(this.silenceTimer);
        this.silenceTimer = setTimeout(() => {
          if (this.currentTranscript.trim() && this.onTranscript) {
            const text = this.currentTranscript.trim();
            this.currentTranscript = '';
            this.onTranscript(text, true);
          }
        }, 2000);
      };

      rec.onerror = (event: SRErrorEvent) => {
        const error = event.error;
        if (error === 'not-allowed' || error === 'audio-capture') {
          this.shouldListen = false;
          this.onStatus?.('permission-denied');
        } else if (error === 'no-speech') {
          // Keep listening
        } else if (error === 'network') {
          // Network hiccup - schedule retry
          this._scheduleRestart(1000);
        }
      };

      rec.onend = () => {
        this.isRecRunning = false;
        if (this.shouldListen && !this.isSpeaking) {
          this._scheduleRestart(300);
        } else {
          this.onStatus?.(this.isSpeaking ? 'speaking' : 'idle');
        }
      };

      this.rec = rec;
      rec.start();
      this.isRecRunning = true;
    } catch (err: any) {
      console.warn('[SpeechService] Recognition start error:', err);
      this.isRecRunning = false;
      if (this.shouldListen && !this.isSpeaking) {
        this._scheduleRestart(600);
      }
    }
  }

  private _scheduleRestart(delayMs = 300) {
    if (this.restartTimeout) clearTimeout(this.restartTimeout);
    this.restartTimeout = setTimeout(() => {
      if (this.shouldListen && !this.isSpeaking) {
        this._startRecognition();
      }
    }, delayMs);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Public: Flush current transcript immediately (e.g. user clicks Send)
  // ────────────────────────────────────────────────────────────────────────────
  flushTranscript(): string {
    const text = this.currentTranscript.trim();
    this.currentTranscript = '';
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    return text;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // TTS (Speech Synthesis): Speak text aloud with auto-resume of recognition
  // ────────────────────────────────────────────────────────────────────────────
  speak(text: string, onStart?: () => void, onEnd?: () => void) {
    if (!this.synthesis) {
      onEnd?.();
      return;
    }

    // Clean text for natural vocalization
    const clean = text
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/[*#_`~]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/https?:\/\/\S+/g, 'the link')
      .replace(/•/g, ', ')
      .replace(/Step (\d+)[:.]/gi, 'Step $1,')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ', ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!clean) {
      onEnd?.();
      return;
    }

    this.stopSpeaking();

    // Pause recognition during speech to avoid self-echo
    const wasListening = this.shouldListen;
    if (this.rec) {
      try {
        this.rec.stop();
      } catch {}
      this.isRecRunning = false;
    }

    if (this.synthesis.paused) {
      this.synthesis.resume();
    }

    const utterance = new SpeechSynthesisUtterance(clean);
    (window as any).__activeSupportAIUtterance = utterance;

    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.onStatus?.('speaking');
      onStart?.();

      if (this.ttsKeepAlive) clearInterval(this.ttsKeepAlive);
      this.ttsKeepAlive = setInterval(() => {
        if (this.synthesis?.paused) {
          this.synthesis.resume();
        }
      }, 4000);
    };

    const handleDone = () => {
      if (this.ttsKeepAlive) {
        clearInterval(this.ttsKeepAlive);
        this.ttsKeepAlive = null;
      }
      this.isSpeaking = false;
      (window as any).__activeSupportAIUtterance = null;
      this.onStatus?.('idle');
      onEnd?.();

      // Automatically resume listening if was listening
      if (wasListening && this.shouldListen) {
        setTimeout(() => {
          if (this.shouldListen && !this.isSpeaking) {
            this._startRecognition();
          }
        }, 400);
      }
    };

    utterance.onend = handleDone;
    utterance.onerror = (e: any) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.warn('[SpeechService] TTS error:', e.error);
      }
      handleDone();
    };

    this.synthesis.speak(utterance);
  }

  stopSpeaking() {
    if (this.ttsKeepAlive) {
      clearInterval(this.ttsKeepAlive);
      this.ttsKeepAlive = null;
    }
    if (this.synthesis) {
      this.synthesis.cancel();
    }
    this.isSpeaking = false;
    (window as any).__activeSupportAIUtterance = null;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Audio Feedback Chimes (Web Audio API)
  // ────────────────────────────────────────────────────────────────────────────
  playChime(type: 'start' | 'message' | 'escalate') {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'start') {
        osc.frequency.setValueAtTime(523.25, t); // C5
        osc.frequency.exponentialRampToValueAtTime(783.99, t + 0.18); // G5
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
      } else if (type === 'message') {
        osc.frequency.setValueAtTime(659.25, t); // E5
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.08); // A5
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.start(t);
        osc.stop(t + 0.18);
      } else {
        osc.frequency.setValueAtTime(440, t); // A4
        osc.frequency.exponentialRampToValueAtTime(659.25, t + 0.25); // E5
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.start(t);
        osc.stop(t + 0.5);
      }
    } catch {}
  }
}

export const speechService = new SpeechService();
export default speechService;

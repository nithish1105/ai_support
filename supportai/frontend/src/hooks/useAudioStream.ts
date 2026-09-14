import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseAudioStreamOptions {
  onAudioChunk?: (pcmBase64: string) => void;
  onVolumeChange?: (volume: number) => void;
  sampleRate?: number;
}

export function useAudioStream({
  onAudioChunk,
  onVolumeChange,
  sampleRate = 16000,
}: UseAudioStreamOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [volume, setVolume] = useState(0);
  const [isLowVolume, setIsLowVolume] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const startStream = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Audio recording not supported in this browser.');
      }

      // Request browser audio with noise suppression, echo cancellation, AGC
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      streamRef.current = stream;
      setHasPermission(true);

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass({ sampleRate });
      audioContextRef.current = audioCtx;

      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      analyserRef.current = analyser;

      // Script processor for 16-bit PCM chunk conversion
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32Array to 16-bit PCM
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        if (onAudioChunk) {
          // Convert binary to base64
          let binary = '';
          const bytes = new Uint8Array(pcm16.buffer);
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64Chunk = btoa(binary);
          onAudioChunk(base64Chunk);
        }
      };

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(audioCtx.destination);

      // Volume monitoring loop
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const monitorVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const currentVol = Math.min(100, Math.round((avg / 90) * 100));

        setVolume(currentVol);
        setIsLowVolume(currentVol > 0 && currentVol < 8);
        onVolumeChange?.(currentVol);

        animFrameRef.current = requestAnimationFrame(monitorVolume);
      };

      animFrameRef.current = requestAnimationFrame(monitorVolume);
      setIsStreaming(true);
      return true;
    } catch (err: any) {
      console.error('[useAudioStream] startStream error:', err);
      setHasPermission(false);
      setError(err.message || 'Failed to access microphone.');
      setIsStreaming(false);
      return false;
    }
  }, [onAudioChunk, onVolumeChange, sampleRate]);

  const stopStream = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }

    setVolume(0);
    setIsLowVolume(false);
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return {
    isStreaming,
    volume,
    isLowVolume,
    hasPermission,
    error,
    startStream,
    stopStream,
  };
}

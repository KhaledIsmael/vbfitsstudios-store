import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Radio, Sparkles } from 'lucide-react';

/**
 * Minimalist Atelier Audio Player
 * Synthesizes a warm, meditative luxury runway ambient texture (tape warmth + deep analog drone)
 * using the browser's native Web Audio API — completely free with zero external media files.
 */
export const AtelierAudioPlayer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const nodesRef = useRef<any[]>([]);

  const startAudio = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
      masterGain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 2.5);
      masterGain.connect(ctx.destination);
      masterGainRef.current = masterGain;

      // 1. Warm sub drone (55Hz — A1 note)
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(55, ctx.currentTime);

      const filter1 = ctx.createBiquadFilter();
      filter1.type = 'lowpass';
      filter1.frequency.setValueAtTime(140, ctx.currentTime);

      osc1.connect(filter1);
      filter1.connect(masterGain);
      osc1.start();

      // 2. Ethereal 5th harmonic (82.4Hz — E2) with slow LFO pulse
      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(82.4, ctx.currentTime);

      const filter2 = ctx.createBiquadFilter();
      filter2.type = 'lowpass';
      filter2.frequency.setValueAtTime(220, ctx.currentTime);

      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(0.06, ctx.currentTime);

      // Subtle LFO modulation for breathing warmth
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.15, ctx.currentTime); // 0.15 Hz slow breathing
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.03, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(gain2.gain);
      lfo.start();

      osc2.connect(filter2);
      filter2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start();

      // 3. Pink/Vinyl Noise Generator for analog archival texture
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        output[i] = (b0 + b1 + b2) * 0.05;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(800, ctx.currentTime);
      noiseFilter.Q.setValueAtTime(0.8, ctx.currentTime);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.015, ctx.currentTime);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(masterGain);
      noiseSource.start();

      nodesRef.current = [osc1, osc2, lfo, noiseSource, masterGain];
      setIsPlaying(true);
    } catch (e) {
      console.warn('AtelierAudioPlayer init note:', e);
    }
  };

  const stopAudio = () => {
    if (audioCtxRef.current && masterGainRef.current) {
      const ctx = audioCtxRef.current;
      masterGainRef.current.gain.setValueAtTime(masterGainRef.current.gain.value, ctx.currentTime);
      masterGainRef.current.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
      setTimeout(() => {
        try {
          ctx.close();
        } catch {}
        audioCtxRef.current = null;
        masterGainRef.current = null;
        nodesRef.current = [];
        setIsPlaying(false);
      }, 850);
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      startAudio();
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!masterGainRef.current || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (isMuted) {
      masterGainRef.current.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.3);
      setIsMuted(false);
    } else {
      masterGainRef.current.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      setIsMuted(true);
    }
  };

  const [volume, setVolume] = useState(0.12);

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (masterGainRef.current && audioCtxRef.current && !isMuted) {
      masterGainRef.current.gain.setValueAtTime(newVol, audioCtxRef.current.currentTime);
    }
  };

  useEffect(() => {
    const handleGlobalToggle = () => togglePlay();
    window.addEventListener('toggle-atelier-audio', handleGlobalToggle);
    return () => {
      window.removeEventListener('toggle-atelier-audio', handleGlobalToggle);
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch {}
      }
    };
  }, [isPlaying]);

  return (
    <aside aria-label="Atelier Soundscape Player" className="fixed bottom-6 left-6 z-40 select-none animate-fade-in font-mono">
      {minimized ? (
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="bg-black/90 hover:bg-black text-white px-3 py-2 text-[10px] uppercase tracking-widest border border-white/20 backdrop-blur-md shadow-xl flex items-center gap-2 transition-all hover:scale-105 focus-visible:ring-2 focus-visible:ring-white"
          title="Expand Atelier Radio"
          aria-label="Expand Atelier Radio"
        >
          <Radio className={`w-3.5 h-3.5 ${isPlaying ? 'text-emerald-400 animate-pulse' : 'text-white/60'}`} />
          <span className="hidden sm:inline">Atelier Radio</span>
          {isPlaying && (
            <span className="flex items-center gap-0.5 h-2.5">
              <span className="w-0.5 h-2 bg-emerald-400 animate-pulse" />
              <span className="w-0.5 h-3 bg-emerald-400 animate-pulse delay-75" />
              <span className="w-0.5 h-1.5 bg-emerald-400 animate-pulse delay-150" />
            </span>
          )}
        </button>
      ) : (
        <div className="bg-[#111114]/95 text-white border border-white/15 backdrop-blur-md shadow-2xl p-3 sm:p-3.5 max-w-xs transition-all animate-scale-in">
          <div className="flex items-center justify-between gap-3 mb-2 border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {isPlaying && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isPlaying ? 'bg-emerald-500' : 'bg-white/40'}`} />
              </span>
              <span className="text-[9px] uppercase tracking-widest text-white/50">
                VB Atelier Soundscape
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="text-white/40 hover:text-white text-xs px-1"
              aria-label="Minimize audio player"
            >
              _
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-white truncate uppercase tracking-wider">
                Tape 01 // Runway Ambient
              </p>
              <p className="text-[9px] text-white/40 truncate">
                55Hz Sub & Vintage Tape Texture
              </p>
            </div>

            {/* Waveform Visualization */}
            <div className="flex items-end gap-0.5 h-4 px-1" aria-hidden="true">
              {[0.4, 0.9, 0.6, 1.0, 0.5, 0.8].map((h, i) => (
                <span
                  key={i}
                  className={`w-0.5 bg-white/80 transition-all duration-300 ${
                    isPlaying && !isMuted ? 'animate-pulse' : 'opacity-20'
                  }`}
                  style={{
                    height: isPlaying && !isMuted ? `${h * 16}px` : '3px',
                    animationDelay: `${i * 120}ms`,
                  }}
                />
              ))}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isPlaying && (
                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded transition-colors"
                  aria-label={isMuted ? 'Unmute soundscape' : 'Mute soundscape'}
                  aria-pressed={isMuted}
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" aria-hidden="true" /> : <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />}
                </button>
              )}
              <button
                type="button"
                onClick={togglePlay}
                aria-pressed={isPlaying}
                aria-label={isPlaying ? 'Pause soundscape' : 'Play ambient soundscape'}
                className={`px-3 py-1 text-[10px] uppercase font-bold tracking-wider transition-all ${
                  isPlaying
                    ? 'bg-white text-black hover:bg-white/90'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                }`}
              >
                {isPlaying ? 'Pause' : 'Play Sound'}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

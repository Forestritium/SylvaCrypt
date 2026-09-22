/**
 * VoiceMessageBubble
 *
 * Renders an inline voice message player inside a chat bubble.
 * The audio bytes are fetched on first play (lazy), decrypted with AES-256-GCM,
 * and played back via a blob: URL so plaintext audio never hits the network.
 *
 * Playback speed control (tap gestures on the progress/waveform area):
 *   Double-tap cycles UP:   1x → 1.5x → 2x → 1x → …
 *   Triple-tap cycles DOWN: 1x → 0.5x → 0.75x → 1x → …
 *
 * Props:
 *   storagePath   — Supabase Storage path of the encrypted blob.
 *   voiceKey      — Base64 AES-256-GCM decryption key.
 *   duration      — Pre-stored duration in seconds (shown before audio loads).
 *   isSelf        — Applies inverted colour styling for own messages.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Mic } from 'lucide-react';
import { fetchAndDecryptVoiceMessage } from '@/lib/relay';

interface VoiceMessageBubbleProps {
  storagePath: string;
  voiceKey: string;
  duration: number; // seconds
  isSelf: boolean;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Speed cycles
// Double-tap (speed up): 1 → 1.5 → 2 → 1 → …
const SPEED_UP_CYCLE = [1, 1.5, 2] as const;
// Triple-tap (slow down): 1 → 0.5 → 0.75 → 1 → …
const SPEED_DOWN_CYCLE = [1, 0.5, 0.75] as const;

function speedLabel(rate: number): string {
  if (rate === 1) return '1×';
  return `${rate}×`;
}

export function VoiceMessageBubble({
  storagePath,
  voiceKey,
  duration,
  isSelf,
}: VoiceMessageBubbleProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [totalSec, setTotalSec] = useState(duration);
  const [error, setError] = useState(false);
  // Playback speed: index within whichever cycle is active
  const [speedUpIdx, setSpeedUpIdx] = useState(0);
  const [speedDownIdx, setSpeedDownIdx] = useState(0);
  // Derived playback rate: down-cycle wins when non-default, else up-cycle
  const playbackRate = speedDownIdx !== 0
    ? SPEED_DOWN_CYCLE[speedDownIdx]
    : SPEED_UP_CYCLE[speedUpIdx];

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Multi-click detection
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const CLICK_WINDOW_MS = 300; // max gap between clicks in the same burst

  // Keep audio.playbackRate in sync with state
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  const tickPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;
    setCurrentSec(Math.floor(audio.currentTime));
    rafRef.current = requestAnimationFrame(tickPlayback);
  }, []);

  const loadAndPlay = async () => {
    if (loading) return;
    if (blobUrl && audioRef.current) {
      if (playing) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {});
      }
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const url = await fetchAndDecryptVoiceMessage(storagePath, voiceKey);
      blobUrlRef.current = url;
      setBlobUrl(url);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAudioLoaded = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Number.isFinite(audio.duration)) setTotalSec(Math.round(audio.duration));
    audio.playbackRate = playbackRate;
    audio.play().catch(() => {});
  };

  const handlePlay = () => {
    setPlaying(true);
    rafRef.current = requestAnimationFrame(tickPlayback);
  };
  const handlePause = () => {
    setPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };
  const handleEnded = () => {
    setPlaying(false);
    setCurrentSec(0);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (audioRef.current) audioRef.current.currentTime = 0;
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrentSec(val);
    if (audioRef.current) audioRef.current.currentTime = val;
  };

  /**
   * Multi-click handler on the waveform area.
   * Collects rapid clicks within CLICK_WINDOW_MS, then fires once the burst ends:
   *   2 clicks → double-tap → speed-up cycle step
   *   3 clicks → triple-tap → slow-down cycle step
   *   1 click  → ignored (scrubber handles single interaction)
   */
  const handleWaveformClick = () => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      const count = clickCountRef.current;
      clickCountRef.current = 0;
      if (count === 2) {
        // Double-tap: advance speed-up cycle; reset slow-down to 1×
        setSpeedDownIdx(0);
        setSpeedUpIdx(prev => {
          const next = (prev + 1) % SPEED_UP_CYCLE.length;
          if (audioRef.current) audioRef.current.playbackRate = SPEED_UP_CYCLE[next];
          return next;
        });
      } else if (count >= 3) {
        // Triple-tap: advance slow-down cycle; reset speed-up to 1×
        setSpeedUpIdx(0);
        setSpeedDownIdx(prev => {
          const next = (prev + 1) % SPEED_DOWN_CYCLE.length;
          if (audioRef.current) audioRef.current.playbackRate = SPEED_DOWN_CYCLE[next];
          return next;
        });
      }
    }, CLICK_WINDOW_MS);
  };

  const progressPct = totalSec > 0 ? (currentSec / totalSec) * 100 : 0;
  const showSpeedBadge = playbackRate !== 1;

  // Colour tokens
  const iconCls = isSelf
    ? 'text-primary-foreground/80 hover:text-primary-foreground'
    : 'text-primary hover:text-primary/80';
  const trackCls = isSelf ? 'bg-primary-foreground/25' : 'bg-primary/20';
  const fillCls = isSelf ? 'bg-primary-foreground/70' : 'bg-primary';
  const timeCls = isSelf ? 'text-primary-foreground/70' : 'text-muted-foreground';
  const badgeCls = isSelf
    ? 'bg-primary-foreground/20 text-primary-foreground'
    : 'bg-primary/15 text-primary';

  return (
    <div className="flex items-center gap-2 min-w-[180px] max-w-[260px] py-0.5">
      {/* Hidden audio element */}
      {blobUrl && (
        <audio
          ref={audioRef}
          src={blobUrl}
          onLoadedMetadata={handleAudioLoaded}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          preload="auto"
        />
      )}

      {/* Play / Pause button */}
      <button
        type="button"
        onClick={loadAndPlay}
        disabled={loading}
        className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${iconCls}`}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : playing ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 translate-x-px" />
        )}
      </button>

      {/* Waveform bar + scrubber + speed badge — click counted for multi-tap speed gesture */}
      <div
        className="flex-1 flex flex-col gap-1 min-w-0"
        onClick={handleWaveformClick}
      >
        {error ? (
          <span className={`text-xs ${timeCls} opacity-70`}>Failed to load audio</span>
        ) : (
          <>
            {/* Progress track + invisible scrubber overlay */}
            <div className={`relative h-3 flex items-center rounded-full ${trackCls}`}>
              <div
                className={`absolute inset-y-0 left-0 rounded-full ${fillCls} transition-none`}
                style={{ width: `${progressPct}%` }}
              />
              <input
                type="range"
                min={0}
                max={totalSec}
                value={currentSec}
                onChange={handleScrub}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                aria-label="Voice message progress"
              />
            </div>
          </>
        )}
        {/* Duration row + speed badge */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <Mic className={`w-2.5 h-2.5 shrink-0 ${timeCls}`} />
            <span className={`text-xs tabular-nums ${timeCls}`}>
              {playing || currentSec > 0
                ? `${formatDuration(currentSec)} / ${formatDuration(totalSec)}`
                : formatDuration(totalSec)}
            </span>
          </div>
          {/* Speed badge — visible whenever rate ≠ 1× */}
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full tabular-nums transition-opacity ${badgeCls} ${showSpeedBadge ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            title="Double-tap to speed up · Triple-tap to slow down"
            aria-label={`Playback speed ${speedLabel(playbackRate)}`}
          >
            {speedLabel(playbackRate)}
          </span>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type LiveMicTestPanelProps = {
  stream: MediaStream | null;
  active: boolean;
  compact?: boolean;
};

export function LiveMicTestPanel({ stream, active, compact = false }: LiveMicTestPanelProps) {
  const { t } = useTranslation();
  const [level, setLevel] = useState(0);
  const [monitoring, setMonitoring] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!active || !stream) {
      setLevel(0);
      return;
    }
    const track = stream.getAudioTracks()[0];
    if (!track) return;

    let ctx: AudioContext | null = null;
    let meterStream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;

    const start = async () => {
      try {
        ctx = new AudioContext();
        await ctx.resume();
        if (cancelled) {
          await ctx.close();
          return;
        }
        meterStream = new MediaStream([track.clone()]);
        const source = ctx.createMediaStreamSource(meterStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (cancelled) return;
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          setLevel(Math.min(100, Math.round(rms * 320)));
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setLevel(0);
      }
    };

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      meterStream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
    };
  }, [stream, active]);

  useEffect(() => {
    setMonitoring(false);
  }, [stream]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (monitoring && stream) {
      el.srcObject = stream;
      void el.play().catch(() => undefined);
    } else {
      el.pause();
      el.srcObject = null;
    }
    return () => {
      el.pause();
      el.srcObject = null;
    };
  }, [monitoring, stream]);

  if (!active || !stream?.getAudioTracks().length) return null;

  const signalDetected = level > 8;

  return (
    <div className={`rounded-xl border border-[#2d2d3d] bg-[#0b0b0f] ${compact ? 'p-2 space-y-1.5' : 'p-3 space-y-2.5'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`font-semibold text-gray-300 ${compact ? 'text-[10px]' : 'text-xs'}`}>
          {t('live.setupMicTestTitle')}
        </p>
        <button
          type="button"
          onClick={() => setMonitoring((on) => !on)}
          className={`shrink-0 rounded-lg font-semibold border transition ${
            compact ? 'min-h-[32px] px-2 py-1 text-[10px]' : 'min-h-[36px] px-3 py-1.5 text-[11px]'
          } ${
            monitoring
              ? 'border-amber-500/40 bg-amber-950/30 text-amber-200'
              : 'border-[#2d2d3d] bg-[#12121a] text-gray-300 hover:border-emerald-500/40'
          }`}
        >
          {monitoring ? t('live.setupMicMonitorOff') : t('live.setupMicMonitorOn')}
        </button>
      </div>

      <div
        className={`rounded-full bg-[#1e1e2f] overflow-hidden ${compact ? 'h-2' : 'h-2.5'}`}
        role="meter"
        aria-valuenow={level}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('live.setupMicTestTitle')}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-75 ${
            signalDetected ? 'bg-emerald-500' : 'bg-emerald-900/60'
          }`}
          style={{ width: `${Math.max(level, signalDetected ? 4 : 0)}%` }}
        />
      </div>

      <p className={`leading-snug ${compact ? 'text-[10px]' : 'text-[11px] leading-relaxed'} ${signalDetected ? 'text-emerald-400' : 'text-gray-500'}`}>
        {signalDetected ? t('live.setupMicSignalOk') : t('live.setupMicSpeakHint')}
      </p>

      {monitoring && !compact && (
        <p className="text-[10px] text-amber-400/80 leading-relaxed">{t('live.setupMicMonitorHint')}</p>
      )}

      <audio ref={audioRef} className="sr-only" playsInline />
    </div>
  );
}

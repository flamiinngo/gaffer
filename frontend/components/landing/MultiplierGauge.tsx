"use client";

import { useEffect, useRef, useState } from "react";

/** Animated 1x → 3x autonomy gauge. Fills as it enters the viewport. */
export function MultiplierGauge() {
  const [progress, setProgress] = useState(0); // 0..1 maps 1x..3x
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const start = performance.now();
          const dur = 1600;
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / dur);
            setProgress(1 - Math.pow(1 - t, 3));
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          io.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const multiplier = (1 + progress * 2).toFixed(2);
  // Semicircle gauge geometry
  const R = 120;
  const cx = 150;
  const cy = 150;
  const startAngle = Math.PI; // 180°
  const sweep = Math.PI; // half circle
  const angle = startAngle + progress * sweep;
  const needleX = cx + R * Math.cos(angle);
  const needleY = cy + R * Math.sin(angle);
  const arcLen = Math.PI * R;

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-md">
      <svg viewBox="0 0 300 190" className="w-full">
        <defs>
          <linearGradient id="gauge" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--color-data)" />
            <stop offset="55%" stopColor="var(--color-grass)" />
            <stop offset="100%" stopColor="var(--color-gold)" />
          </linearGradient>
        </defs>
        {/* track */}
        <path
          d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* fill */}
        <path
          d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
          fill="none"
          stroke="url(#gauge)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={arcLen}
          strokeDashoffset={arcLen * (1 - progress)}
        />
        {/* ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const a = startAngle + p * sweep;
          const x1 = cx + (R - 16) * Math.cos(a);
          const y1 = cy + (R - 16) * Math.sin(a);
          const x2 = cx + (R - 26) * Math.cos(a);
          const y2 = cy + (R - 26) * Math.sin(a);
          return <line key={p} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-data)" strokeWidth="2" opacity="0.5" />;
        })}
        {/* needle */}
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="var(--color-chalk)" strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="7" fill="var(--color-chalk)" />
        <text x={cx - R} y={cy + 22} fill="var(--color-data)" fontSize="12" textAnchor="middle" className="mono">1.0x</text>
        <text x={cx + R} y={cy + 22} fill="var(--color-gold)" fontSize="12" textAnchor="middle" className="mono">3.0x</text>
      </svg>
      <div className="absolute inset-x-0 bottom-2 text-center">
        <div className="display text-6xl text-chalk">{multiplier}x</div>
        <div className="text-xs uppercase tracking-[0.2em] text-grass">Autonomy Multiplier</div>
      </div>
    </div>
  );
}

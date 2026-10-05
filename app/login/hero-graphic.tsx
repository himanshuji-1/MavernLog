/**
 * Landing-page illustration, drawn in code (no stock photos): a barbell over a
 * strength chart that draws itself, with a deload dip and recovery (exactly what
 * the engine does), plus two example "decisions" the app makes.
 */

// e1RM over a few weeks: steady climb, two missed sessions → deload dip, back up.
const POINTS: [number, number][] = [
  [24, 196], [66, 180], [108, 163], [150, 147], [192, 132], [234, 158], [276, 128], [318, 104], [360, 78],
];
const LINE = POINTS.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
const AREA = `${LINE} L360 230 L24 230 Z`;

function Barbell({ className = "" }: { className?: string }) {
  // Plates: [x, width, height]: big outer plates, smaller inner ones.
  const plates: [number, number, number][] = [
    [26, 14, 92], [42, 12, 72], [56, 9, 52],
    [255, 9, 52], [266, 12, 72], [280, 14, 92],
  ];
  return (
    <svg viewBox="0 0 320 110" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="plate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e4e4e7" />
          <stop offset="1" stopColor="#71717a" />
        </linearGradient>
      </defs>
      {/* bar + sleeves + collars */}
      <rect x="4" y="51" width="312" height="8" rx="4" fill="url(#bar)" />
      <rect x="66" y="47" width="6" height="16" rx="2" fill="#a1a1aa" />
      <rect x="248" y="47" width="6" height="16" rx="2" fill="#a1a1aa" />
      {/* knurling marks */}
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={i} x={118 + i * 6} y="51" width="2" height="8" fill="#52525b" opacity="0.35" />
      ))}
      {plates.map(([x, w, h]) => (
        <rect key={x} x={x} y={55 - h / 2} width={w} height={h} rx="3" fill="url(#plate)" />
      ))}
    </svg>
  );
}

export function HeroGraphic() {
  return (
    <div className="relative mx-auto w-full max-w-md px-2 pt-10 pb-20 sm:px-6">
      {/* The barbell, floating over the chart card */}
      <div className="absolute inset-x-0 top-0 z-10 flex justify-center motion-safe:animate-float">
        <Barbell className="w-64 drop-shadow-[0_10px_25px_rgba(16,185,129,0.35)] sm:w-72" />
      </div>

      {/* Chart card */}
      <div className="relative rounded-3xl border border-zinc-200/80 bg-white/80 p-5 pt-14 shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold">Bench Press</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">estimated 1RM</p>
        </div>
        <svg viewBox="0 0 384 240" className="mt-2 w-full" aria-hidden="true">
          <defs>
            <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="1" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[70, 120, 170, 220].map((y) => (
            <line key={y} x1="0" x2="384" y1={y} y2={y} stroke="currentColor" strokeOpacity="0.08" />
          ))}
          <path d={AREA} fill="url(#area)" className="motion-safe:animate-fade-up" style={{ animationDelay: "1.6s" }} />
          <path
            d={LINE}
            pathLength={1}
            fill="none"
            stroke="#10b981"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1"
            className="motion-safe:animate-draw"
          />
          {POINTS.map(([x, y], i) => (
            <circle
              key={x}
              cx={x}
              cy={y}
              r={i === 5 ? 6 : 4.5}
              fill={i === 5 ? "#f59e0b" : "#10b981"}
              stroke="var(--background)"
              strokeWidth="2"
              className="motion-safe:animate-pop"
              style={{ animationDelay: `${0.5 + i * 0.22}s`, transformOrigin: `${x}px ${y}px` }}
            />
          ))}
          <text x="234" y="186" textAnchor="middle" fontSize="12" fill="#f59e0b" fontWeight="600">
            deload
          </text>
        </svg>
      </div>

      {/* Example decisions */}
      <div
        className="absolute bottom-0 left-0 z-20 w-[48%] rounded-2xl border border-emerald-600/30 bg-white/90 p-3 shadow-lg backdrop-blur motion-safe:animate-fade-up sm:-left-4 sm:w-60 dark:bg-zinc-900/90"
        style={{ animationDelay: "1.2s" }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          Next session
        </p>
        <p className="mt-0.5 text-base font-bold sm:text-lg">62.5 kg × 3 × 5</p>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">Hit every rep at RIR ≤ 2 → +2.5 kg</p>
      </div>
      <div
        className="absolute bottom-0 right-0 z-20 w-[48%] rounded-2xl border border-zinc-200 bg-white/90 p-3 shadow-lg backdrop-blur motion-safe:animate-fade-up sm:-right-4 sm:w-52 dark:border-zinc-700 dark:bg-zinc-900/90"
        style={{ animationDelay: "1.8s" }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Weekly review
        </p>
        <p className="mt-0.5 font-bold">On track · −0.5%</p>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">Change nothing.</p>
      </div>
    </div>
  );
}

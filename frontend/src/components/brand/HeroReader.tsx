export default function HeroReader({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute left-[8%] top-[6%] h-[78%] w-[78%] rounded-full bg-wave/90" />
      <div
        className="absolute left-[4%] top-[2%] h-[86%] w-[86%] rounded-full"
        style={{
          background: 'repeating-conic-gradient(from 0deg, transparent 0 8deg, rgba(255,255,255,.35) 8deg 10deg)',
        }}
      />
      <div className="absolute right-[2%] top-[18%] grid grid-cols-6 gap-2 opacity-70">
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-accent-sky" />
        ))}
      </div>

      <svg viewBox="0 0 420 460" className="relative z-10 w-full hero-float" aria-hidden>
        <ellipse cx="210" cy="430" rx="120" ry="16" fill="#1B2A4A" opacity=".08" />
        <path d="M150 250c-30 40-18 120 60 130 78-8 96-92 62-132Z" fill="#1B2A4A" />
        <path d="M168 248c18 54 70 78 112 54 8-40-18-86-54-104-28 8-50 24-58 50Z" fill="#24365E" />
        <circle cx="214" cy="168" r="46" fill="#F1C7A4" />
        <path d="M176 160c8-28 70-34 80-4 6 8-8 14-18 12-18-4-46 0-62-8Z" fill="#1B2A4A" />
        <rect x="186" y="174" width="22" height="8" rx="4" fill="#1B2A4A" />
        <rect x="222" y="174" width="22" height="8" rx="4" fill="#1B2A4A" />
        <path d="M208 182h8" stroke="#1B2A4A" strokeWidth="3" />
        <path d="M148 268 L272 238 L286 268 L162 302 Z" fill="#14C4B0" />
        <path d="M148 268 L162 302 L162 314 L148 280 Z" fill="#0EAEA0" />
        <path d="M272 238 L286 268 L286 280 L272 250 Z" fill="#0B8F85" />
        <path d="M168 274 L258 250" stroke="#E6FAF7" strokeWidth="3" />
        <path d="M172 284 L254 260" stroke="#E6FAF7" strokeWidth="3" />
        <path d="M130 300c20 40 86 40 110 8 6 36-70 70-110 48-18-10-18-36 0-56Z" fill="#F4A261" />
        <path d="M250 292c-8 36 54 62 90 28-8-34-50-54-90-28Z" fill="#F4A261" />
      </svg>

      <div className="absolute bottom-[8%] left-0 z-20 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-card">
        <div className="flex -space-x-2">
          {['#14C4B0', '#F4A261', '#7EB6E9', '#C9B6F2'].map((color) => (
            <span key={color} className="h-8 w-8 rounded-full border-2 border-white" style={{ background: color }} />
          ))}
        </div>
        <div>
          <p className="text-sm font-extrabold text-navy leading-none">10k+ students</p>
          <p className="text-[11px] text-muted mt-1">Total enrolled writers</p>
        </div>
        <span className="rounded-full bg-[#F4A261] px-2 py-0.5 text-[10px] font-bold text-white">3K+</span>
      </div>
    </div>
  );
}

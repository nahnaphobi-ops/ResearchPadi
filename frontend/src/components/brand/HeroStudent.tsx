export default function HeroStudent({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute -left-6 top-8 h-40 w-40 rounded-full bg-brand/10" />
      <div className="absolute right-4 top-4 grid grid-cols-5 gap-2 opacity-60">
        {Array.from({ length: 20 }).map((_, i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-brand/50" />
        ))}
      </div>
      <div className="absolute bottom-10 right-0 h-24 w-24 rounded-full border-[6px] border-gold/80" />

      <svg viewBox="0 0 420 460" className="relative z-10 w-full hero-float" aria-hidden>
        <ellipse cx="210" cy="430" rx="130" ry="16" fill="#0E1B4D" opacity=".08" />
        <circle cx="210" cy="168" r="52" fill="#F3C7A6" />
        <path d="M168 158c12-34 78-38 88-6 4 10-12 16-24 12-22-6-50-2-64-6Z" fill="#1B1B1B" />
        <path d="M148 236c8-36 40-58 72-54 34-2 64 24 70 58 18 78-18 150-70 156-58-4-94-82-72-160Z" fill="#F5C400" />
        <path d="M168 250c18 8 70 10 96-4 6 42-20 92-50 98-36 4-58-42-46-94Z" fill="#E6B000" />
        <rect x="156" y="292" width="52" height="70" rx="6" fill="#3B6EFF" />
        <rect x="214" y="286" width="52" height="76" rx="6" fill="#FF4B4B" />
        <rect x="186" y="278" width="52" height="70" rx="6" fill="#0E1B4D" />
        <path d="M120 330c22 46 90 52 130 10" stroke="#3B6EFF" strokeWidth="10" strokeLinecap="round" fill="none" />
      </svg>

      <div className="absolute left-0 top-[38%] z-20 flex items-center gap-3 rounded-full bg-white px-4 py-2.5 shadow-card">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-white text-xs font-bold">10k</span>
        <p className="text-xs font-bold text-navy leading-tight">10k+ Active<br />Students</p>
      </div>
      <div className="absolute right-0 bottom-[22%] z-20 flex items-center gap-3 rounded-full bg-white px-4 py-2.5 shadow-card">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-alert text-white text-xs font-bold">4+</span>
        <p className="text-xs font-bold text-navy leading-tight">University<br />templates</p>
      </div>
    </div>
  );
}

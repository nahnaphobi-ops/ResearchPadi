function Tile({
  className = '',
  delay = 1,
  children,
}: {
  className?: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10 reveal reveal-delay-${delay} ${className}`}>
      {children}
    </div>
  );
}

export default function GalleryTiles() {
  return (
    <div className="relative">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 auto-rows-[140px] sm:auto-rows-[180px]">
      <Tile className="col-span-2 row-span-2 bg-[#0B4A86]" delay={1}>
        <svg viewBox="0 0 400 360" className="absolute inset-0 h-full w-full" aria-hidden>
          <ellipse cx="210" cy="330" rx="130" ry="16" fill="#002F5A" opacity=".45" />
          <path d="M70 230 L200 190 L330 230 L200 272 Z" fill="#E98A3A" />
          <path d="M70 230 L200 272 L200 292 L70 250 Z" fill="#C46B24" />
          <path d="M330 230 L200 272 L200 292 L330 250 Z" fill="#A85A1E" />
          <path d="M86 202 L200 164 L314 202 L200 242 Z" fill="#3BA55C" />
          <path d="M86 202 L200 242 L200 258 L86 218 Z" fill="#2D8448" />
          <path d="M314 202 L200 242 L200 258 L314 218 Z" fill="#246B3A" />
          <path d="M100 176 L200 140 L300 176 L200 214 Z" fill="#4BA8D8" />
          <path d="M100 176 L200 214 L200 228 L100 190 Z" fill="#2F8BB8" />
          <path d="M300 176 L200 214 L200 228 L300 190 Z" fill="#26739A" />
          <path d="M114 152 L200 118 L286 152 L200 188 Z" fill="#E45B5B" />
          <path d="M114 152 L200 188 L200 202 L114 166 Z" fill="#C44545" />
          <path d="M286 152 L200 188 L200 202 L286 166 Z" fill="#A33636" />
          <path d="M148 108 L252 80 L308 108 L204 140 Z" fill="#1A1A1A" />
          <path d="M148 108 L204 140 L204 148 L148 116 Z" fill="#111" />
          <path d="M308 108 L204 140 L204 148 L308 116 Z" fill="#000" />
          <path d="M230 108 C 258 118 274 140 270 172" stroke="#F0C14A" strokeWidth="5" fill="none" strokeLinecap="round" />
          <ellipse cx="270" cy="180" rx="8" ry="13" fill="#F0C14A" />
        </svg>
      </Tile>

      <Tile delay={2}>
        <svg viewBox="0 0 200 180" className="absolute inset-0 h-full w-full p-6 text-white/80" aria-hidden>
          <circle cx="100" cy="90" r="48" fill="none" stroke="currentColor" strokeWidth="3" />
          <ellipse cx="100" cy="90" rx="20" ry="48" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M52 90h96M100 42v96" stroke="currentColor" strokeWidth="3" />
        </svg>
      </Tile>

      <Tile className="bg-[#E98A3A]" delay={3}>
        <svg viewBox="0 0 200 180" className="absolute inset-0 h-full w-full p-7" aria-hidden>
          <rect x="40" y="38" width="120" height="18" rx="3" fill="#fff" opacity=".95" />
          <rect x="48" y="56" width="8" height="78" fill="#fff" opacity=".9" />
          <rect x="144" y="56" width="8" height="78" fill="#fff" opacity=".9" />
          <rect x="48" y="128" width="104" height="10" fill="#fff" opacity=".9" />
          <path d="M70 78h60M70 96h48M70 114h54" stroke="#C46B24" strokeWidth="6" strokeLinecap="round" />
        </svg>
      </Tile>

      <Tile className="bg-[#3BA55C]" delay={4}>
        <svg viewBox="0 0 200 180" className="absolute inset-0 h-full w-full p-8" aria-hidden>
          <circle cx="100" cy="62" r="22" fill="#fff" />
          <path d="M70 92c0-18 60-18 60 0v18c0 22-60 22-60 0V92Z" fill="#fff" />
          <rect x="92" y="110" width="16" height="28" rx="3" fill="#fff" />
          <path d="M78 138h44l-6 16H84Z" fill="#F0C14A" />
        </svg>
      </Tile>

      <Tile className="md:col-span-2 bg-[#4BA8D8]" delay={2}>
        <svg viewBox="0 0 420 180" className="absolute inset-0 h-full w-full p-6" aria-hidden>
          <rect x="36" y="40" width="150" height="100" rx="10" fill="#fff" opacity=".95" />
          <rect x="56" y="62" width="110" height="8" rx="4" fill="#2F8BB8" />
          <rect x="56" y="82" width="86" height="8" rx="4" fill="#2F8BB8" opacity=".55" />
          <rect x="56" y="102" width="98" height="8" rx="4" fill="#2F8BB8" opacity=".35" />
          <path d="M230 48 L340 78 L230 108 Z" fill="#fff" />
          <path d="M230 108 L340 78 L340 128 L230 158 Z" fill="#26739A" />
          <circle cx="366" cy="54" r="18" fill="#F0C14A" />
        </svg>
      </Tile>

      </div>
      <svg className="pointer-events-none absolute right-2 -top-14 h-16 w-16 text-white/15" viewBox="0 0 64 64" fill="none" aria-hidden>
        <path d="M22 8h20M24 8v12l8 8 8-8V8" stroke="currentColor" strokeWidth="2" />
        <path d="M32 28v16" stroke="currentColor" strokeWidth="2" />
        <ellipse cx="32" cy="50" rx="14" ry="8" stroke="currentColor" strokeWidth="2" />
      </svg>
    </div>
  );
}

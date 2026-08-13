export default function DecorMotifs({ light = false }: { light?: boolean }) {
  const tone = light ? 'text-white/20' : 'text-rule opacity-40';
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <svg className={`absolute left-[6%] top-[18%] h-16 w-16 ${tone}`} viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="1.5" />
        <ellipse cx="32" cy="32" rx="10" ry="22" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 32h44M32 10v44" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <svg className={`absolute right-[12%] top-[28%] h-12 w-12 ${light ? 'text-white/20' : 'text-rule opacity-35'}`} viewBox="0 0 64 64" fill="none">
        <path d="M20 12h8l4 36H16l4-36Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M28 12c6-8 18-8 24 0" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="44" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <svg className={`absolute left-[8%] bottom-[22%] h-14 w-14 ${light ? 'text-white/20' : 'text-rule opacity-35'}`} viewBox="0 0 64 64" fill="none">
        <path d="M20 8h24M22 8v10l10 8 10-8V8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M32 26v18" stroke="currentColor" strokeWidth="1.5" />
        <ellipse cx="32" cy="50" rx="14" ry="8" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <svg className={`absolute right-[8%] bottom-[18%] h-12 w-12 ${light ? 'text-white/15' : 'text-rule opacity-30'}`} viewBox="0 0 64 64" fill="none">
        <rect x="10" y="18" width="44" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <path d="M14 26v22M50 26v22M14 48h36" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

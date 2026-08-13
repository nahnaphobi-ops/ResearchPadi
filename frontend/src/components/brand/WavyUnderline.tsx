export default function WavyUnderline({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 14" className={className} aria-hidden focusable="false">
      <path
        d="M3 9 C 18 2, 28 13, 42 8 S 68 3, 82 9 112 3, 137 8"
        fill="none"
        stroke="#F5D04A"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

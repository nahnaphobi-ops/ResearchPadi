import { useId } from 'react';

interface BrandLogoProps {
  className?: string;
  markClassName?: string;
  wordmark?: boolean;
  /** Flat white mark + wordmark for very dark bars. */
  invert?: boolean;
  /** Colored mark + blue Padi; Research in white for dark surfaces. */
  onDark?: boolean;
  onClick?: () => void;
}

function LogoMark({
  className = '',
  invert = false,
}: {
  className?: string;
  invert?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const page = `rp-page-${uid}`;
  const handle = `rp-handle-${uid}`;

  const stroke = invert ? '#ffffff' : '#2563eb';
  const ink = invert ? '#ffffff' : '#1d4ed8';
  const pageFill = invert ? 'rgba(255,255,255,0.12)' : `url(#${page})`;
  const glassFill = invert ? 'rgba(255,255,255,0.08)' : 'rgba(219,234,254,0.55)';
  const handleStroke = invert ? '#ffffff' : `url(#${handle})`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="50 30 295 195"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={page} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e8f0fe" />
        </linearGradient>
        <linearGradient id={handle} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>

      <path d="M180 36 L180 210" stroke={ink} strokeWidth="4" strokeLinecap="round" />
      <path
        d="M180 36 Q112 28 56 48 L56 198 Q112 184 180 210 Z"
        fill={pageFill}
        stroke={stroke}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M180 36 Q248 28 304 48 L304 198 Q248 184 180 210 Z"
        fill={pageFill}
        stroke={stroke}
        strokeWidth="3"
        strokeLinejoin="round"
      />

      <path
        fill={ink}
        d="M98 92h38c16 0 28 10 28 26 0 12-7 21-18 24l22 36h-22l-20-34h-12v34H98V92zm22 18v24h14c7 0 12-4 12-12s-5-12-12-12h-14z"
      />
      <path
        fill={ink}
        d="M222 92h36c18 0 32 12 32 30s-14 30-32 30h-14v26h-22V92zm22 18v24h12c8 0 14-5 14-12s-6-12-14-12h-12z"
      />

      <circle cx="262" cy="118" r="48" fill={glassFill} stroke={stroke} strokeWidth="5" />
      <path d="M298 154 L336 212" stroke={handleStroke} strokeWidth="14" strokeLinecap="round" />
    </svg>
  );
}

/** Crisp ResearchPadi mark + HTML wordmark (vector, no blurry raster text). */
export default function BrandLogo({
  className = '',
  markClassName = 'h-9 w-auto',
  wordmark = true,
  invert = false,
  onDark = false,
  onClick,
}: BrandLogoProps) {
  const researchColor = invert || onDark ? 'text-white' : 'text-[#0f172a]';
  const padiColor = invert ? 'text-white/85' : 'text-[#2563eb]';

  const content = (
    <>
      <LogoMark className={`${markClassName} shrink-0`} invert={invert} />
      {wordmark && (
        <span className={`text-[15px] sm:text-lg font-extrabold tracking-tight leading-none ${researchColor}`}>
          Research<span className={padiColor}>Padi</span>
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-2.5 ${className}`}
        aria-label="ResearchPadi home"
      >
        {content}
      </button>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} role="img" aria-label="ResearchPadi">
      {content}
    </span>
  );
}

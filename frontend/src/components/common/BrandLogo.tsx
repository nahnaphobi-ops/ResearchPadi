interface BrandLogoProps {
  className?: string;
  markClassName?: string;
  wordmark?: boolean;
  invert?: boolean;
  onDark?: boolean;
  stacked?: boolean;
  onClick?: () => void;
}

function LogoMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`${className} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand shadow-sm`}
      aria-hidden="true"
    >
      <img
        src="/brand-mark-white.png"
        alt=""
        draggable={false}
        className="h-[118%] w-[118%] max-w-none object-contain"
      />
    </span>
  );
}

export default function BrandLogo({
  className = '',
  markClassName = 'h-9 w-9',
  wordmark = true,
  invert = false,
  onDark = false,
  stacked = false,
  onClick,
}: BrandLogoProps) {
  const researchColor = invert || onDark ? 'text-white' : 'text-navy';

  const content = (
    <>
      <LogoMark className={markClassName} />
      {wordmark && (
        <span className={`font-extrabold tracking-tight leading-none uppercase ${researchColor} ${stacked ? 'text-[13px] sm:text-sm' : 'text-[15px] sm:text-[17px]'}`}>
          ResearchPadi
        </span>
      )}
    </>
  );

  const layout = stacked
    ? 'inline-flex flex-col items-center gap-1 text-center'
    : 'inline-flex items-center gap-2.5';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${layout} ${className}`}
        aria-label="ResearchPadi home"
      >
        {content}
      </button>
    );
  }

  return (
    <span className={`${layout} ${className}`} role="img" aria-label="ResearchPadi">
      {content}
    </span>
  );
}

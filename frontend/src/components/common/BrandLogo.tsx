interface BrandLogoProps {
  className?: string;
  markClassName?: string;
  wordmark?: boolean;
  invert?: boolean;
  onDark?: boolean;
  stacked?: boolean;
  onClick?: () => void;
}

function LogoMark({
  className = '',
  invert = false,
}: {
  className?: string;
  invert?: boolean;
}) {
  const fill = invert ? '#ffffff' : '#3B6EFF';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="24" cy="24" r="24" fill={fill} />
      <path d="M24 10 L40 18 L24 26 L8 18 Z" fill={invert ? '#3B6EFF' : '#fff'} />
      <path d="M14 20 V30 c0 5.5 20 5.5 20 0 V20" fill={invert ? '#3B6EFF' : '#fff'} />
      <circle cx="24" cy="18" r="2" fill={invert ? '#fff' : '#3B6EFF'} />
    </svg>
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
      <LogoMark className={`${markClassName} shrink-0 rounded-full`} invert={invert || onDark} />
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

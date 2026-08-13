export default function WaveDivider({ className = '', fill = '#F5F9FC' }: { className?: string; fill?: string }) {
  return (
    <div className={`pointer-events-none leading-none ${className}`} aria-hidden>
      <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="block w-full h-12 sm:h-16 md:h-20">
        <path
          d="M0,40 C180,80 360,0 540,40 C720,80 900,10 1080,40 C1200,58 1320,48 1440,36 L1440,80 L0,80 Z"
          fill={fill}
        />
      </svg>
    </div>
  );
}

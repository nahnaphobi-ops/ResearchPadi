export default function HeroStudent({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute -left-6 top-8 h-40 w-40 rounded-full bg-brand/10" />
      <div className="absolute right-4 top-4 grid grid-cols-5 gap-2 opacity-60">
        {Array.from({ length: 20 }).map((_, i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-brand/50" />
        ))}
      </div>
      <div className="absolute bottom-8 right-0 h-24 w-24 rounded-full border-[6px] border-gold/80" />

      <div className="relative z-10 hero-float">
        <img
          src="/hero-student.png?v=8"
          alt="Student with a laptop giving a thumbs up"
          draggable={false}
          className="relative z-10 mx-auto w-full max-w-[420px] object-contain select-none drop-shadow-[0_18px_24px_rgba(14,27,77,0.16)]"
        />
      </div>

      <div className="absolute left-0 top-[30%] z-20 flex items-center gap-3 rounded-full bg-white px-4 py-2.5 shadow-card">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-white text-xs font-bold">10k</span>
        <p className="text-xs font-bold text-navy leading-tight">10k+ Active<br />Students</p>
      </div>
      <div className="absolute right-0 bottom-[18%] z-20 flex items-center gap-3 rounded-full bg-white px-4 py-2.5 shadow-card">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-alert text-white text-xs font-bold">4+</span>
        <p className="text-xs font-bold text-navy leading-tight">University<br />templates</p>
      </div>
    </div>
  );
}

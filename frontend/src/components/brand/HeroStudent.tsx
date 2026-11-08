export default function HeroStudent({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute -left-6 top-8 h-40 w-40 rounded-full bg-brand/10" />
      <div className="absolute bottom-8 right-0 h-24 w-24 rounded-full border-[6px] border-gold/80" />

      <div className="relative z-10">
        <img
          src="/hero-student.webp?v=10"
          alt="Smiling student carrying books and a backpack"
          width={840}
          height={1329}
          fetchPriority="high"
          decoding="async"
          draggable={false}
          className="relative z-10 mx-auto w-full max-w-[420px] object-contain select-none [-webkit-mask-image:linear-gradient(to_bottom,#000_82%,transparent)] [mask-image:linear-gradient(to_bottom,#000_82%,transparent)]"
        />
      </div>

      <div className="absolute left-0 top-[30%] z-20 flex items-center gap-3 rounded-full bg-white px-4 py-2.5 shadow-card">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-white text-xs font-semibold">4</span>
        <p className="text-xs font-semibold text-navy leading-tight">Citation<br />styles</p>
      </div>
      <div className="absolute right-0 bottom-[18%] z-20 flex items-center gap-3 rounded-full bg-white px-4 py-2.5 shadow-card">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-alert text-white text-xs font-semibold">GH</span>
        <p className="text-xs font-semibold text-navy leading-tight">Ghanaian<br />sources</p>
      </div>
    </div>
  );
}

export default function HeroIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 520 460"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="270" cy="430" rx="170" ry="18" fill="#004077" opacity="0.06" />

      {/* Bottom book — orange */}
      <path d="M90 300 L250 250 L430 300 L270 352 Z" fill="#E98A3A" />
      <path d="M90 300 L270 352 L270 378 L90 326 Z" fill="#C46B24" />
      <path d="M430 300 L270 352 L270 378 L430 326 Z" fill="#A85A1E" />
      <path d="M250 250 L430 300 L430 314 L250 264 Z" fill="#F3A45E" />
      <path d="M108 308 L252 264 L412 308" stroke="#F8D2A8" strokeWidth="3" fill="none" opacity=".55" />

      {/* Green book */}
      <path d="M108 262 L258 214 L418 262 L268 312 Z" fill="#3BA55C" />
      <path d="M108 262 L268 312 L268 336 L108 286 Z" fill="#2D8448" />
      <path d="M418 262 L268 312 L268 336 L418 286 Z" fill="#246B3A" />
      <path d="M258 214 L418 262 L418 276 L258 228 Z" fill="#5CBC78" />
      <path d="M124 270 L260 228 L400 270" stroke="#C8EBD3" strokeWidth="3" fill="none" opacity=".5" />

      {/* Sky book */}
      <path d="M122 226 L262 180 L408 226 L268 274 Z" fill="#4BA8D8" />
      <path d="M122 226 L268 274 L268 296 L122 248 Z" fill="#2F8BB8" />
      <path d="M408 226 L268 274 L268 296 L408 248 Z" fill="#26739A" />
      <path d="M262 180 L408 226 L408 240 L262 194 Z" fill="#73C0E8" />
      <path d="M138 234 L264 194 L392 234" stroke="#D6F0FB" strokeWidth="3" fill="none" opacity=".5" />

      {/* Red book */}
      <path d="M138 192 L268 148 L398 192 L268 238 Z" fill="#E45B5B" />
      <path d="M138 192 L268 238 L268 258 L138 212 Z" fill="#C44545" />
      <path d="M398 192 L268 238 L268 258 L398 212 Z" fill="#A33636" />
      <path d="M268 148 L398 192 L398 206 L268 162 Z" fill="#F07A7A" />
      <path d="M154 200 L268 162 L382 200" stroke="#FAD1D1" strokeWidth="3" fill="none" opacity=".5" />

      {/* Mortarboard */}
      <path d="M188 128 L332 92 L402 128 L258 168 Z" fill="#1A1A1A" />
      <path d="M188 128 L258 168 L258 176 L188 136 Z" fill="#111" />
      <path d="M402 128 L258 168 L258 176 L402 136 Z" fill="#000" />
      <path d="M210 136 L332 104 L382 128 L258 160 Z" fill="#2A2A2A" />
      <ellipse cx="292" cy="132" rx="10" ry="5" fill="#111" />
      <circle cx="292" cy="132" r="5" fill="#3A3A3A" />

      {/* Tassel */}
      <path d="M300 132 C 330 138, 352 158, 348 196" stroke="#F0C14A" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M348 196 C 344 210, 352 222, 346 236" stroke="#E2B93B" strokeWidth="5" fill="none" strokeLinecap="round" />
      <ellipse cx="346" cy="242" rx="10" ry="16" fill="#F0C14A" />
      <ellipse cx="346" cy="248" rx="7" ry="10" fill="#E2B93B" />
    </svg>
  );
}

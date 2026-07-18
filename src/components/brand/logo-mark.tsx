// What2Sing brand mark: a handheld karaoke microphone leaning into a swipe (V3).
// Transparent background; inherits size from `className`.
export function LogoMark({className}: {className?: string}) {
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="What2Sing" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="w2sMicGrad" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#ff3d8b" />
          <stop offset="1" stopColor="#55e6ff" />
        </linearGradient>
      </defs>
      <g stroke="#55e6ff" strokeWidth="8" strokeLinecap="round" opacity="0.75">
        <path d="M40 66 q-10 22 0 44" />
        <path d="M56 60 q-12 28 0 56" />
      </g>
      <g transform="rotate(14 100 104)">
        <rect x="64" y="24" width="72" height="86" rx="36" fill="url(#w2sMicGrad)" />
        <path d="M82 106 L118 106 L112 170 Q112 178 104 178 L96 178 Q88 178 88 170 Z" fill="url(#w2sMicGrad)" />
        <rect x="76" y="103" width="48" height="6" rx="3" fill="#050507" fillOpacity="0.35" />
        <g stroke="#050507" strokeOpacity="0.45" strokeWidth="5" strokeLinecap="round">
          <line x1="80" y1="48" x2="120" y2="48" />
          <line x1="80" y1="62" x2="120" y2="62" />
          <line x1="80" y1="76" x2="120" y2="76" />
          <line x1="80" y1="90" x2="120" y2="90" />
        </g>
      </g>
    </svg>
  );
}

/* Hand-built brand illustrations. Pure SVG/CSS so they stay crisp, theme with
   the brand tokens and animate via the `occ-*` keyframes in index.css (all of
   which are disabled under prefers-reduced-motion). */

const INK = "#0d0d0d";
const YELLOW = "hsl(var(--primary))";
const PAPER = "#ffffff";

const arc = (cx: number, cy: number, r: number) =>
  `M ${cx - r * 0.8} ${cy - r * 0.6} A ${r} ${r} 0 0 1 ${cx + r * 0.8} ${cy - r * 0.6}`;

export const RouterArt = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 240 170" className={className} role="img" aria-label="Illustration of a broadband router sending Wi-Fi">
    {[20, 38, 56].map((r, i) => (
      <path
        key={r}
        d={arc(120, 92, r)}
        fill="none"
        stroke={INK}
        strokeWidth={7}
        strokeLinecap="square"
        className="occ-wave"
        style={{ animationDelay: `${i * 220}ms` }}
      />
    ))}
    <line x1="64" y1="104" x2="52" y2="58" stroke={INK} strokeWidth={6} strokeLinecap="square" />
    <line x1="176" y1="104" x2="188" y2="58" stroke={INK} strokeWidth={6} strokeLinecap="square" />
    <rect x="34" y="104" width="172" height="46" fill={INK} />
    <rect x="34" y="104" width="172" height="46" fill="none" stroke={INK} strokeWidth={4} />
    {[0, 1, 2, 3].map((i) => (
      <rect
        key={i}
        x={54 + i * 18}
        y={124}
        width={9}
        height={6}
        fill={YELLOW}
        className="occ-blink"
        style={{ animationDelay: `${i * 300}ms` }}
      />
    ))}
    <rect x="150" y="122" width="38" height="10" fill="none" stroke={YELLOW} strokeWidth={2} />
    <rect x="44" y="150" width="20" height="8" fill={INK} />
    <rect x="176" y="150" width="20" height="8" fill={INK} />
  </svg>
);

export const SimArt = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 240 170" className={className} role="img" aria-label="Illustration of a SIM card with signal bars">
    <g className="occ-float">
      <path d="M58 14 H156 L188 46 V156 H58 Z" fill={PAPER} stroke={INK} strokeWidth={5} strokeLinejoin="miter" />
      <rect x="84" y="62" width="62" height="50" fill={YELLOW} stroke={INK} strokeWidth={4} />
      <path d="M84 79 H104 M126 79 H146 M84 95 H104 M126 95 H146 M115 62 V112" stroke={INK} strokeWidth={3} />
      <rect x="104" y="74" width="22" height="26" fill="none" stroke={INK} strokeWidth={3} />
    </g>
    {[10, 20, 30, 40].map((h, i) => (
      <rect
        key={h}
        x={196 + i * 10}
        y={156 - h}
        width={7}
        height={h}
        fill={INK}
        className="occ-signal"
        style={{ animationDelay: `${i * 180}ms` }}
      />
    ))}
  </svg>
);

export const VoiceArt = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 240 170" className={className} role="img" aria-label="Illustration of a home phone handset ringing">
    {[18, 34, 50].map((r, i) => (
      <path
        key={r}
        d={`M 150 ${64 - r} A ${r} ${r} 0 0 1 ${150 + r} 64`}
        fill="none"
        stroke={INK}
        strokeWidth={7}
        strokeLinecap="square"
        className="occ-wave"
        style={{ animationDelay: `${i * 220}ms` }}
      />
    ))}
    <g className="occ-ring" style={{ transformOrigin: "100px 104px" }}>
      <path
        d="M66 44 L92 38 L104 70 L88 82 Q100 108 124 120 L136 104 L168 116 L162 142 Q156 154 140 152 Q72 142 54 66 Q52 50 66 44 Z"
        fill={YELLOW}
        stroke={INK}
        strokeWidth={5}
        strokeLinejoin="round"
      />
    </g>
  </svg>
);

/** A small mock of the account chat — used to show UK-based support. */
export const SupportChatArt = () => (
  <div className="space-y-2 text-[12px] leading-snug" aria-hidden>
    <div className="occ-pop ml-auto w-fit max-w-[85%] bg-primary px-3 py-2 font-medium text-black" style={{ animationDelay: "0ms" }}>
      My router lights are flashing orange
    </div>
    <div className="occ-pop w-fit max-w-[85%] border-2 border-black bg-white px-3 py-2 text-black" style={{ animationDelay: "350ms" }}>
      Let's sort that. Is it the WAN light or all of them?
    </div>
    <div className="occ-pop flex w-fit items-center gap-1 border-2 border-black bg-white px-3 py-2.5" style={{ animationDelay: "700ms" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="occ-typing h-1.5 w-1.5 bg-black" style={{ animationDelay: `${i * 160}ms` }} />
      ))}
    </div>
  </div>
);

/** One Touch Switch, drawn as a toggle that flips across. */
export const SwitchArt = () => (
  <div className="flex items-center justify-center gap-4" aria-hidden>
    <span className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-black/50">Old provider</span>
    {/* Track 96px, 3px border, 3px inset, 34px thumb → 50px of travel */}
    <span className="relative inline-flex h-[46px] w-24 flex-shrink-0 border-[3px] border-black bg-white" style={{ ["--occ-switch-x" as string]: "50px" }}>
      <span className="occ-switch absolute top-[3px] left-[3px] h-[34px] w-[34px] bg-black" />
    </span>
    <span className="font-display text-3xl leading-none text-black">OCCTA</span>
  </div>
);

/** A postcode pin dropping onto a street grid. */
export const AddressPinArt = () => (
  <svg viewBox="0 0 200 110" className="w-full h-auto" aria-hidden>
    <rect x="0" y="0" width="200" height="110" fill={PAPER} />
    {[18, 46, 74, 102].map((y) => (
      <line key={y} x1="0" y1={y} x2="200" y2={y} stroke={INK} strokeOpacity={0.12} strokeWidth={6} />
    ))}
    {[30, 80, 130, 180].map((x) => (
      <line key={x} x1={x} y1="0" x2={x} y2="110" stroke={INK} strokeOpacity={0.12} strokeWidth={6} />
    ))}
    <rect x="96" y="56" width="28" height="12" fill={INK} opacity={0.15} className="occ-shadow" />
    <g className="occ-drop">
      <path d="M110 64 L96 40 A16 16 0 1 1 124 40 Z" fill={YELLOW} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      <circle cx="110" cy="32" r="5" fill={INK} />
    </g>
  </svg>
);

/** A mini Contract Summary document with its rows ticking in. */
export const ContractDocArt = () => (
  <div className="border-[3px] border-black bg-white p-3" aria-hidden>
    <div className="flex items-center justify-between border-b-2 border-black pb-2">
      <span className="font-display text-base leading-none text-black">Contract Summary</span>
      <span className="bg-primary px-1.5 py-0.5 font-sans text-[9px] font-bold uppercase tracking-wider text-black">Before you pay</span>
    </div>
    {["Monthly price", "Minimum term", "Setup and equipment", "Speed information"].map((row, i) => (
      <div key={row} className="flex items-center justify-between gap-2 border-b border-black/10 py-1.5 last:border-b-0">
        <span className="font-sans text-[11px] text-black/70">{row}</span>
        <span className="occ-tick inline-flex h-4 w-4 items-center justify-center bg-black text-[10px] font-bold text-primary" style={{ animationDelay: `${300 + i * 220}ms` }}>
          ✓
        </span>
      </div>
    ))}
  </div>
);

/** A business premises with lit windows and a rooftop antenna — used for business services. */
export const BuildingArt = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 240 170" className={className} role="img" aria-label="Illustration of a business premises connected to the network">
    {[14, 26, 38].map((r, i) => (
      <path
        key={r}
        d={`M ${172 - r} ${30 - r * 0.2} A ${r} ${r} 0 0 1 ${172 + r} ${30 - r * 0.2}`}
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="square"
        className="occ-wave"
        style={{ animationDelay: `${i * 220}ms` }}
      />
    ))}
    <line x1="172" y1="30" x2="172" y2="56" stroke={INK} strokeWidth={5} />
    <rect x="120" y="56" width="92" height="104" fill={PAPER} stroke={INK} strokeWidth={5} />
    <rect x="28" y="84" width="92" height="76" fill={INK} />
    {[0, 1, 2].map((row) =>
      [0, 1, 2].map((col) => (
        <rect
          key={`r${row}c${col}`}
          x={134 + col * 24}
          y={70 + row * 22}
          width={14}
          height={12}
          fill={YELLOW}
          stroke={INK}
          strokeWidth={2}
          className="occ-blink"
          style={{ animationDelay: `${(row * 3 + col) * 170}ms` }}
        />
      )),
    )}
    {[0, 1, 2].map((col) => (
      <rect key={col} x={42 + col * 24} y={98} width={14} height={12} fill={YELLOW} opacity={0.85} />
    ))}
    <rect x="54" y="126" width="40" height="34" fill={YELLOW} stroke={INK} strokeWidth={3} />
    <rect x="154" y="134" width="24" height="26" fill={INK} />
    <line x1="10" y1="160" x2="230" y2="160" stroke={INK} strokeWidth={5} strokeLinecap="square" />
  </svg>
);

/** A 30-day dial with a rolling arrow — used for Flex 30 / rolling terms. */
export const RollingDialArt = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Illustration of a rolling 30-day term">
    <circle cx="100" cy="100" r="78" fill={PAPER} stroke={INK} strokeWidth={6} />
    {Array.from({ length: 30 }, (_, i) => {
      const a = (i / 30) * Math.PI * 2 - Math.PI / 2;
      const r1 = i % 5 === 0 ? 58 : 64;
      return (
        <line
          key={i}
          x1={100 + Math.cos(a) * r1}
          y1={100 + Math.sin(a) * r1}
          x2={100 + Math.cos(a) * 70}
          y2={100 + Math.sin(a) * 70}
          stroke={INK}
          strokeWidth={i % 5 === 0 ? 4 : 2}
        />
      );
    })}
    <g className="occ-spin" style={{ transformOrigin: "100px 100px" }}>
      <path d="M 100 14 A 86 86 0 0 1 186 100" fill="none" stroke={YELLOW} strokeWidth={12} strokeLinecap="square" />
      <path d="M 176 92 L 186 108 L 196 92 Z" fill={INK} />
    </g>
    <text x="100" y="114" textAnchor="middle" fontFamily="'Bebas Neue', sans-serif" fontSize="52" fill={INK}>30</text>
    <text x="100" y="134" textAnchor="middle" fontFamily="sans-serif" fontWeight="700" fontSize="11" letterSpacing="2" fill={INK}>DAYS</text>
  </svg>
);

/** A 24-month strip of equal bars under a padlock — a fixed price for the term. */
export const LockStripArt = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 240 150" className={className} role="img" aria-label="Illustration of a monthly price fixed for 24 months">
    <g className="occ-float">
      <rect x="98" y="30" width="44" height="34" fill={YELLOW} stroke={INK} strokeWidth={5} />
      <path d="M 106 30 V 18 A 14 14 0 0 1 134 18 V 30" fill="none" stroke={INK} strokeWidth={5} />
      <rect x="117" y="40" width="6" height="12" fill={INK} />
    </g>
    <line x1="10" y1="84" x2="230" y2="84" stroke={INK} strokeWidth={2} strokeDasharray="6 5" />
    {Array.from({ length: 24 }, (_, i) => (
      <rect
        key={i}
        x={12 + i * 9.1}
        y={92}
        width={6.5}
        height={44}
        fill={INK}
        className="occ-signal"
        style={{ animationDelay: `${i * 60}ms` }}
      />
    ))}
  </svg>
);

/** A gift box held shut by a padlock — rewards that are coming but not live yet. */
export const GiftLockArt = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 220 180" className={className} role="img" aria-label="Illustration of a locked gift box">
    <g className="occ-float">
      <rect x="40" y="70" width="140" height="94" fill={YELLOW} stroke={INK} strokeWidth={5} />
      <rect x="32" y="52" width="156" height="26" fill={PAPER} stroke={INK} strokeWidth={5} />
      <rect x="100" y="52" width="20" height="112" fill={INK} />
      <path d="M110 52 C 90 20, 60 30, 74 52 Z" fill={PAPER} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      <path d="M110 52 C 130 20, 160 30, 146 52 Z" fill={PAPER} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
    </g>
    <g className="occ-ring" style={{ transformOrigin: "110px 104px" }}>
      <path d="M 96 104 V 92 A 14 14 0 0 1 124 92 V 104" fill="none" stroke={INK} strokeWidth={5} />
      <rect x="88" y="102" width="44" height="34" fill={PAPER} stroke={INK} strokeWidth={5} />
      <rect x="107" y="112" width="6" height="12" fill={INK} />
    </g>
  </svg>
);

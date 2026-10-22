import { useId } from 'react';
import { fxLevel, tierOf } from '../lib/tiers.js';
import { IcDriver } from './Icons.jsx';

const SHIELD = 'M40 4 L64 13 V34 C64 50 54 61 40 67 C26 61 16 50 16 34 V13 Z';
const star = (cx, cy, R, r, pts = 5) => Array.from({ length: pts * 2 }, (_, i) => {
  const a = (Math.PI / pts) * i - Math.PI / 2; const k = i % 2 ? r : R;
  return `${(cx + k * Math.cos(a)).toFixed(1)},${(cy + k * Math.sin(a)).toFixed(1)}`;
}).join(' ');

/** Lambang di tengah perisai — berbeda untuk tiap tier. Digambar warna gelap tier + garis tepi putih agar selalu terbaca. */
function Glyph({ n, ink }) {
  const halo = { stroke: '#fff', strokeWidth: 1.4, paintOrder: 'stroke', strokeLinejoin: 'round' };
  const solid = { fill: ink, ...halo };
  const line = { fill: 'none', stroke: ink, strokeWidth: 4.5, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const under = { ...line, stroke: '#fff', strokeWidth: 7.5 };
  if (n <= 3) {
    const ys = Array.from({ length: n }, (_, k) => 36 + (k - (n - 1) / 2) * 9);
    return <g>{ys.map((y) => <path key={`u${y}`} d={`M27 ${y - 5} L40 ${y + 4} L53 ${y - 5}`} {...under} />)}{ys.map((y) => <path key={y} d={`M27 ${y - 5} L40 ${y + 4} L53 ${y - 5}`} {...line} />)}</g>;
  }
  switch (n) {
    case 4: return <polygon points={star(40, 38, 17, 7)} {...solid} />;
    case 5: return <g {...halo} fill={ink}><polygon points="40,21 55,32 40,55 25,32" /><path d="M25 32H55M40 21L33 32L40 55L47 32Z" fill="none" stroke="#fff" strokeWidth="1.6" /></g>;
    case 6: return <g><path d="M25 51 L23 28 L33 38 L40 23 L47 38 L57 28 L55 51 Z" {...solid} />{[23, 40, 57].map((x, i) => <circle key={x} cx={x} cy={i === 1 ? 22 : 27} r="3" {...solid} />)}</g>;
    case 7: return <text x="40" y="49" textAnchor="middle" fontSize="32" fontWeight="900" fontFamily="Calibri, Carlito, Arial, sans-serif" {...solid}>A</text>;
    case 8: return <g><text x="40" y="52" textAnchor="middle" fontSize="28" fontWeight="900" fontFamily="Calibri, Carlito, Arial, sans-serif" {...solid}>A</text><polygon points={star(40, 22, 7, 3)} {...solid} /></g>;
    case 9: return <g><text x="40" y="52" textAnchor="middle" fontSize="28" fontWeight="900" fontFamily="Calibri, Carlito, Arial, sans-serif" {...solid}>A</text><path d="M29 25 L32 15 L36 25 Z M36 23 L40 11 L44 23 Z M44 25 L48 15 L51 25 Z" {...solid} /></g>;
    case 10: return <g><path d="M28 26 L52 52 M52 26 L28 52" {...under} /><path d="M28 26 L52 52 M52 26 L28 52" {...line} /><path d="M31 46 L37 40 M49 46 L43 40" {...line} strokeWidth="3.5" /><circle cx="27" cy="25" r="3" {...solid} /><circle cx="53" cy="25" r="3" {...solid} /></g>;
    case 11: return <g><path d="M40 20 L44.5 32.5 L57 37 L44.5 41.5 L40 54 L35.5 41.5 L23 37 L35.5 32.5 Z" {...solid} /><circle cx="53" cy="24" r="2.6" {...solid} /><circle cx="27" cy="50" r="2.2" {...solid} /></g>;
    default: return <g><path d="M40 38 C34 28 23 28 23 38 C23 48 34 48 40 38 C46 28 57 28 57 38 C57 48 46 48 40 38 Z" {...under} /><path d="M40 38 C34 28 23 28 23 38 C23 48 34 48 40 38 C46 28 57 28 57 38 C57 48 46 48 40 38 Z" {...line} /><circle cx="40" cy="21" r="3.4" {...solid} /></g>;
  }
}

/** Lencana tier: perisai logam + lambang unik; tier ≥4 bersayap, ≥7 bermahkota duri, ≥10 bersinar. */
export function TierBadge({ n = 1, size = 56, className = '', title }) {
  const T = tierOf(n); const id = useId().replace(/:/g, '');
  const wings = n >= 10 ? 3 : n >= 7 ? 2 : n >= 4 ? 1 : 0;
  const rainbow = n === 11 || n === 12;
  const feather = (i) => `M16 ${17 + i * 9} C${8 - i * 2} ${13 + i * 9} ${1 - i} ${22 + i * 9} ${3 - i} ${35 + i * 9} C9 ${31 + i * 9} 13 ${31 + i * 9} 16 ${33 + i * 9} Z`;
  return (
    <svg className={'tbadge ' + className} width={size} height={size * 0.87} viewBox="-8 -8 96 84" role="img" aria-label={title || `Tier ${n} ${T.name}`}
      style={n >= 10 ? { filter: `drop-shadow(0 0 6px ${T.g})` } : undefined}>
      <title>{title || `TIER ${n} · ${T.name}`}</title>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          {rainbow ? <><stop offset="0" stopColor={T.a} /><stop offset=".45" stopColor={T.b} /><stop offset="1" stopColor={T.c} /></>
            : <><stop offset="0" stopColor={T.a} /><stop offset=".5" stopColor={T.b} /><stop offset="1" stopColor={T.c} /></>}
        </linearGradient>
        <linearGradient id={`w${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={T.b} /><stop offset="1" stopColor={T.c} /></linearGradient>
      </defs>
      {wings > 0 && Array.from({ length: wings }, (_, i) => (
        <g key={i} fill={`url(#w${id})`} stroke="rgba(0,0,0,.25)" strokeWidth=".8">
          <path d={feather(i)} /><path d={feather(i)} transform="translate(80 0) scale(-1 1)" />
        </g>
      ))}
      {n >= 7 && <path d="M29 9 L33 -3 L37 8 L40 -6 L43 8 L47 -3 L51 9 Z" fill={`url(#g${id})`} stroke="rgba(0,0,0,.3)" strokeWidth=".8" />}
      <path d={SHIELD} fill={`url(#g${id})`} stroke={T.c} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M40 9 L60 16.5 V34 C60 47 51.5 56.5 40 62 C28.5 56.5 20 47 20 34 V16.5 Z" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.2" />
      <Glyph n={n} ink={T.c} />
    </svg>
  );
}

/** Lencana "PALING EFISIEN" (rank 1 KM/L dalam sebulan). */
export function EffBadge({ size = 64, ym, provisional }) {
  const id = useId().replace(/:/g, '');
  return (
    <span className={'effb' + (provisional ? ' prov' : '')} title={provisional ? 'Sementara — bulan masih berjalan' : 'Peringkat 1 efisiensi'}>
      <svg width={size} height={size * 1.15} viewBox="0 0 64 74" aria-hidden="true">
        <defs>
          <linearGradient id={`m${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff3b0" /><stop offset=".5" stopColor="#f5b800" /><stop offset="1" stopColor="#b86e00" /></linearGradient>
          <linearGradient id={`d${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5eead4" /><stop offset="1" stopColor="#047857" /></linearGradient>
        </defs>
        <path d="M18 46 L10 72 L21 67 L27 73 L32 50 Z" fill="#0f766e" /><path d="M46 46 L54 72 L43 67 L37 73 L32 50 Z" fill="#115e59" />
        <circle cx="32" cy="30" r="27" fill={`url(#m${id})`} stroke="#8a5a00" strokeWidth="2" />
        <circle cx="32" cy="30" r="21.5" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.4" strokeDasharray="2 3" />
        <path d="M32 11 C32 11 20 25 20 33 a12 12 0 0 0 24 0 C44 25 32 11 32 11 Z" fill={`url(#d${id})`} stroke="#fff" strokeWidth="1.6" />
        <path d="M32 24 C27 28 26 34 30 40 M32 24 L32 41" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="1.6" strokeLinecap="round" />
        <text x="32" y="53" textAnchor="middle" fontSize="8" fontWeight="900" fill="#5a3a00" fontFamily="Calibri, Carlito, Arial, sans-serif">KM/L #1</text>
      </svg>
      {ym && <small>{ymLabel(ym)}{provisional ? ' · SEMENTARA' : ''}</small>}
    </span>
  );
}

export const ymLabel = (ym) => new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${ym}-01T00:00:00Z`)).toUpperCase();

/** Foto driver di dalam border tier (otomatis ganti sesuai tier). */
export function Avatar({ driver, tier = 1, size = 56, className = '' }) {
  const fx = fxLevel(tier);
  return (
    <span className={`ring tier-${tier} fx${fx} ${className}`} style={{ width: size, height: size }}>
      <span className="ph">{driver?.foto ? <img src={driver.foto} alt={driver.nama_lengkap || driver.nama || 'Foto driver'} /> : <IcDriver />}</span>
    </span>
  );
}

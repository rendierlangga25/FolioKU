import { useEffect, useRef, useState } from 'react';

/** Palet kategorikal berurutan tetap (slot 1…8) — warna mengikuti entitas, bukan peringkat. */
export const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];

/** 1.250.000 → "1,25 jt" · 45.000 → "45 rb" (untuk sumbu & ringkasan). */
export function compact(n) {
  const a = Math.abs(+n || 0);
  const f = (x, d = 1) => x.toLocaleString('id-ID', { maximumFractionDigits: d });
  if (a >= 1e9) return f(n / 1e9) + ' M';
  if (a >= 1e6) return f(n / 1e6) + ' jt';
  if (a >= 1e3) return f(n / 1e3, 0) + ' rb';
  return f(n, a < 10 && a % 1 ? 1 : 0);
}

function niceMax(max) {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max)); const m = max / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

function useWidth() {
  const ref = useRef(null); const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const set = () => setW(Math.max(260, Math.floor(el.clientWidth)));
    set();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(set); ro.observe(el); return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function Legend({ items }) {
  return (
    <ul className="legend" aria-label="Keterangan warna">
      {items.map((i) => <li key={i.label}><i style={{ background: i.color }} />{i.label}</li>)}
    </ul>
  );
}

/** Kartu grafik: judul, keterangan, legenda, dan tombol GRAFIK / TABEL (tampilan tabel selalu tersedia). */
export function ChartCard({ title, sub, legend, table, children, wide }) {
  const [view, setView] = useState('chart');
  return (
    <section className={'card chart-card' + (wide ? ' wide' : '')}>
      <div className="chart-h">
        <div><h3 className="card-t">{title}</h3>{sub && <p className="muted small">{sub}</p>}</div>
        {table && (
          <div className="seg" role="group" aria-label="Tampilan">
            <button className={view === 'chart' ? 'on' : ''} onClick={() => setView('chart')}>GRAFIK</button>
            <button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>TABEL</button>
          </div>
        )}
      </div>
      {view === 'table' && table ? <div className="chart-table">{table}</div> : (<>{legend && legend.length > 1 && <Legend items={legend} />}{children}</>)}
    </section>
  );
}

/** Batang horizontal sederhana (peringkat). rows: [{ label, value, sub, color }] */
export function HBars({ rows, fmt, color = SERIES[0], empty = 'Belum ada data.' }) {
  if (!rows.length) return <p className="muted empty-line">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hb" key={r.label} title={`${r.label}: ${fmt(r.value)}`}>
          <span className="hb-l">{r.label}</span>
          <span className="hb-t"><i style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: r.color || color }} /></span>
          <b className="hb-v mono">{fmt(r.value)}</b>
          {r.sub && <small className="hb-s">{r.sub}</small>}
        </div>
      ))}
    </div>
  );
}

/** Batang horizontal bertumpuk (komposisi per kategori). rows: [{ label, parts:[{label,value,color}] }] */
export function StackedHBars({ rows, fmt, empty = 'Belum ada data.' }) {
  const [tip, setTip] = useState(null);
  if (!rows.length) return <p className="muted empty-line">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.parts.reduce((a, p) => a + p.value, 0)), 0) || 1;
  return (
    <div className="shbars" onMouseLeave={() => setTip(null)}>
      {rows.map((r) => {
        const tot = r.parts.reduce((a, p) => a + p.value, 0);
        return (
          <div className="shb" key={r.label}>
            <span className="hb-l">{r.label}</span>
            <span className="shb-t" style={{ width: `${(tot / max) * 100}%` }}>
              {r.parts.filter((p) => p.value > 0).map((p) => (
                <i key={p.label} style={{ flexGrow: p.value, background: p.color }} tabIndex={0}
                  onMouseEnter={() => setTip(`${r.label} · ${p.label}: ${fmt(p.value)} (${Math.round((p.value / tot) * 100)}%)`)}
                  onFocus={() => setTip(`${r.label} · ${p.label}: ${fmt(p.value)}`)} aria-label={`${r.label} ${p.label} ${fmt(p.value)}`} />
              ))}
            </span>
            <b className="hb-v mono">{fmt(tot)}</b>
          </div>
        );
      })}
      <div className="tip-line" aria-live="polite">{tip || 'Arahkan kursor ke bagian batang untuk rincian.'}</div>
    </div>
  );
}

/**
 * Grafik waktu (batang bertumpuk atau garis) dengan crosshair + tooltip.
 * data: [{ key, ...nilai }]  series: [{ key, label, color }]  kind: 'bars' | 'line'
 */
export function TimeChart({ data, series, kind = 'bars', fmt, tickFmt = compact, xLabel, height = 230 }) {
  const [ref, W] = useWidth();
  const [hi, setHi] = useState(null);
  const L = 46, R = 10, T = 10, B = 26;
  const iw = W - L - R, ih = height - T - B;
  const n = data.length || 1;
  const totals = data.map((d) => (kind === 'bars' ? series.reduce((a, s) => a + (+d[s.key] || 0), 0) : Math.max(...series.map((s) => +d[s.key] || 0))));
  const ymax = niceMax(Math.max(...totals, 0));
  const y = (v) => T + ih - (v / ymax) * ih;
  const band = iw / n;
  const cx = (i) => L + band * i + band / 2;
  const bw = Math.min(30, Math.max(2, band * 0.7));
  const ticks = [0, 1, 2, 3, 4].map((k) => (ymax / 4) * k);
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 58))));

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - r.left) - L) / band);
    setHi(i >= 0 && i < n ? i : null);
  };
  const h = hi != null ? data[hi] : null;

  return (
    <div className="tchart" ref={ref}>
      <svg width={W} height={height} role="img" aria-label="Grafik tren" onMouseMove={onMove} onMouseLeave={() => setHi(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" className="ax">{tickFmt(t)}</text>
          </g>
        ))}
        {data.map((d, i) => (i % every === 0 ? <text key={d.key} x={cx(i)} y={height - 8} textAnchor="middle" className="ax">{xLabel(d)}</text> : null))}
        {hi != null && <line x1={cx(hi)} x2={cx(hi)} y1={T} y2={T + ih} className="cross" />}
        {kind === 'bars' && data.map((d, i) => {
          let acc = 0;
          return series.map((s, k) => {
            const v = +d[s.key] || 0; if (v <= 0) return null;
            const y0 = y(acc), y1 = y(acc + v); acc += v;
            return <rect key={s.key} x={cx(i) - bw / 2} y={y1} width={bw} height={Math.max(1, y0 - y1 - (k ? 2 : 0))} fill={s.color} rx={1.5} opacity={hi == null || hi === i ? 1 : 0.55} />;
          });
        })}
        {kind === 'line' && series.map((s) => (
          <g key={s.key}>
            <polyline fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
              points={data.map((d, i) => `${cx(i)},${y(+d[s.key] || 0)}`).join(' ')} />
            {hi != null && <circle cx={cx(hi)} cy={y(+data[hi][s.key] || 0)} r="4.5" fill={s.color} className="dot" />}
          </g>
        ))}
      </svg>
      {h && (
        <div className="tt" style={{ left: Math.min(Math.max(cx(hi), 80), W - 90), top: 4 }}>
          <b>{xLabel(h, true)}</b>
          {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}<em className="mono">{fmt(+h[s.key] || 0, s.key)}</em></span>)}
          {kind === 'bars' && series.length > 1 && <span className="tt-tot">Total<em className="mono">{fmt(series.reduce((a, s) => a + (+h[s.key] || 0), 0), 'total')}</em></span>}
        </div>
      )}
    </div>
  );
}

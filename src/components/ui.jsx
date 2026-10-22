import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { monthRange, thisMonthRange } from '../lib/format.js';

/** Input rupiah dengan pemisah ribuan. value: number | ''. */
export function MoneyInput({ value, onChange, id, required, placeholder = '0' }) {
  const shown = value === '' || value == null ? '' : Number(value).toLocaleString('id-ID');
  return (
    <div className="money">
      <span>Rp</span>
      <input id={id} inputMode="numeric" value={shown} placeholder={placeholder} required={required}
        onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); onChange(d === '' ? '' : Number(d)); }} />
    </div>
  );
}

/** Input angka biasa (KM) dengan pemisah ribuan. */
export function NumInput({ value, onChange, id, required, placeholder }) {
  const shown = value === '' || value == null ? '' : Number(value).toLocaleString('id-ID');
  return (
    <input id={id} inputMode="numeric" className="mono" value={shown} placeholder={placeholder} required={required}
      onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); onChange(d === '' ? '' : Number(d)); }} />
  );
}

export function Modal({ title, onClose, children, wide, size }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '') + (size === 'md' ? ' md' : '') + (size === 'sm' ? ' sm' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-h"><h3>{title}</h3><button className="btn-icon" onClick={onClose} aria-label="Tutup">✕</button></div>
        <div className="modal-b">{children}</div>
      </div>
    </div>
  );
}

export function Toast({ msg, kind = 'ok', onDone }) {
  useEffect(() => { if (!msg) return; const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [msg, onDone]);
  if (!msg) return null;
  return <div className={'toast ' + kind} role="status">{msg}</div>;
}

export function useToast() {
  const [t, setT] = useState({ msg: '', kind: 'ok' });
  return [t, (msg, kind = 'ok') => setT({ msg, kind }), () => setT({ msg: '', kind: 'ok' })];
}

export function Stat({ label, value, sub, accent }) {
  return (
    <div className={'stat' + (accent ? ' accent' : '')}>
      <small>{label}</small>
      <b className="mono">{value}</b>
      {sub && <span>{sub}</span>}
    </div>
  );
}

export const PageHead = ({ title, sub, children }) => (
  <div className="page-head">
    <div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>
    <div className="page-actions">{children}</div>
  </div>
);

/**
 * Kolom isian + dropdown pilihan. Bisa diketik bebas ATAU dipilih dari daftar.
 * options: string[]  ·  onChange(string)
 */
export function ComboInput({ value, onChange, options, placeholder, ariaLabel, id, noun = 'tujuan' }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const wrap = useRef(null);
  const q = (value || '').trim().toLowerCase();
  const list = useMemo(
    () => options.filter((o) => !q || o.toLowerCase().includes(q)).slice(0, 60),
    [options, q],
  );
  useEffect(() => { setHi(-1); }, [q, open]);

  const pick = (o) => { onChange(o); setOpen(false); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(list.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === 'Enter' && open && hi >= 0 && list[hi]) { e.preventDefault(); pick(list[hi]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="combo" ref={wrap}>
      <input id={id} value={value} placeholder={placeholder} aria-label={ariaLabel} autoComplete="off"
        role="combobox" aria-expanded={open} aria-autocomplete="list"
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKey} />
      <button type="button" className="combo-btn" tabIndex={-1} aria-label={`Buka daftar ${noun}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => { setOpen((o) => !o); wrap.current?.querySelector('input')?.focus(); }}>▾</button>
      {open && (
        <ul className="combo-list" role="listbox" onMouseDown={(e) => e.preventDefault()}>
          {list.length === 0
            ? <li className="combo-empty">{options.length ? `Tidak ada yang cocok — ${noun} baru akan disimpan sesuai ketikan` : `Belum ada daftar ${noun} — ketik manual`}</li>
            : list.map((o, i) => (
              <li key={o} role="option" aria-selected={i === hi} className={i === hi ? 'on' : ''} onClick={() => pick(o)}>{o}</li>
            ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Pembungkus tabel yang menyesuaikan ukuran huruf otomatis dengan lebar tersedia (mis. saat browser di-zoom in/out
 * atau jendela diubah), sehingga scrollbar horizontal hanya muncul bila tabel benar-benar tidak muat
 * (di bawah skala minimum `min`).
 */
export function FitTable({ children, min = 0.6, className = '' }) {
  const wrap = useRef(null);
  const fit = () => {
    const w = wrap.current; if (!w) return;
    const tbl = w.querySelector('table'); if (!tbl) return;
    let s = 1;
    const floor = window.innerWidth < 760 ? 1 : min; // di HP ukuran huruf tetap terbaca → tabel yang lebar DIGESER kiri-kanan
    w.style.setProperty('--tbl-scale', '1');
    for (let i = 0; i < 4; i++) {
      const avail = w.clientWidth, need = tbl.offsetWidth;
      if (need <= avail + 0.5) break;
      s = Math.max(floor, +(s * (avail / need) * 0.995).toFixed(4));
      w.style.setProperty('--tbl-scale', String(s));
      if (s <= floor) break;
    }
  };
  useLayoutEffect(fit); // setiap render (isi/kolom berubah)
  useEffect(() => {
    const w = wrap.current; if (!w || typeof ResizeObserver === 'undefined') return undefined;
    let raf = 0;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); });
    ro.observe(w);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); window.removeEventListener('resize', fit); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={wrap} className={'tablewrap fit ' + className}>{children}</div>;
}


/** Filter waktu: pilih BULAN (cepat) atau atur TANGGAL dari–sampai. value = { from, to } (YYYY-MM-DD). */
export const useDateRange = () => useState(thisMonthRange);

export function DateRangeFields({ value, onChange }) {
  const { from, to } = value;
  const full = monthRange(from.slice(0, 7));
  const ym = full.from === from && full.to === to ? from.slice(0, 7) : '';
  return (
    <>
      <div><label>Bulan</label>
        <input type="month" value={ym} onChange={(e) => e.target.value && onChange(monthRange(e.target.value))} /></div>
      <div><label>Dari tanggal</label>
        <input type="date" value={from} max={to} onChange={(e) => e.target.value && onChange({ from: e.target.value, to: to < e.target.value ? e.target.value : to })} /></div>
      <div><label>Sampai tanggal</label>
        <input type="date" value={to} min={from} onChange={(e) => e.target.value && onChange({ from: from > e.target.value ? e.target.value : from, to: e.target.value })} /></div>
    </>
  );
}

import { useRef, useState } from 'react';
import { Modal } from './ui.jsx';
import { COL_LABEL, COST_COL, DEFAULT_PREFS, normalizePrefs } from '../lib/tableCols.js';

const Chev = ({ down }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={down ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'} />
  </svg>
);

/** Owner mengatur urutan (seret / tombol panah) dan menyembunyikan kolom; mode total biaya. */
export default function ColumnManager({ prefs, onSave, onClose }) {
  const [p, setP] = useState(prefs);
  const [drag, setDrag] = useState(null);   // { from, over } selama baris diseret
  const dragRef = useRef(null);
  const move = (from, to) => {
    if (to < 0 || to >= p.order.length || from === to) return;
    const o = [...p.order]; const [x] = o.splice(from, 1); o.splice(to, 0, x); setP({ ...p, order: o });
  };
  // Seret dengan kursor (mouse/pen/sentuh): tekan baris, tahan, geser ke posisi baru, lepas.
  const idxAt = (x, y) => {
    const li = document.elementFromPoint(x, y)?.closest('li[data-i]');
    return li ? Number(li.dataset.i) : null;
  };
  const startDrag = (e, i) => {
    if (e.button != null && e.button !== 0) return;
    if (e.target.closest('input, button')) return;          // centang & tombol panah tetap berfungsi
    const x0 = e.clientX, y0 = e.clientY;
    const st = { from: i, over: i, on: false };
    dragRef.current = st;
    const mv = (ev) => {
      if (!st.on && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;   // klik biasa ≠ seret
      st.on = true;
      const o = idxAt(ev.clientX, ev.clientY);
      if (o != null) st.over = o;
      setDrag({ from: st.from, over: st.over });
    };
    const up = () => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      dragRef.current = null; setDrag(null);
      if (st.on) {
        const stop = (ev) => ev.stopPropagation();           // cegah klik label (centang) setelah menyeret
        window.addEventListener('click', stop, true); setTimeout(() => window.removeEventListener('click', stop, true), 0);
        if (st.over !== st.from) move(st.from, st.over);
      }
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };
  const toggle = (id) => setP({ ...p, hidden: p.hidden.includes(id) ? p.hidden.filter((x) => x !== id) : [...p.hidden, id] });
  const shown = p.order.filter((id) => !p.hidden.includes(id)).length;
  const rows = Math.ceil(p.order.length / 2);

  return (
    <Modal title="ATUR KOLOM TABEL" onClose={onClose} size="md">
      <p className="muted small colmgr-help">Tahan & geser baris dengan kursor (atau pakai tombol panah) untuk mengubah urutan. Hilangkan centang untuk menyembunyikan kolom.</p>
      <ul className="colmgr" style={{ '--rows': rows }}>
        {p.order.map((id, i) => (
          <li key={id} data-i={i} onPointerDown={(e) => startDrag(e, i)}
            className={(p.hidden.includes(id) ? 'off' : '') + (drag?.from === i ? ' dragging' : '') + (drag && drag.over === i && drag.from !== i ? ' drop' : '')}>
            <span className="grip" aria-hidden>⠿</span>
            <label className="colchk"><input type="checkbox" checked={!p.hidden.includes(id)} onChange={() => toggle(id)} />
              <span>{COL_LABEL[id]}{COST_COL[id] && <small className="muted"> · nominal</small>}</span></label>
            <span className="colbtns">
              <button type="button" className="mv" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Naikkan ${COL_LABEL[id]}`}><Chev /></button>
              <button type="button" className="mv" onClick={() => move(i, i + 1)} disabled={i === p.order.length - 1} aria-label={`Turunkan ${COL_LABEL[id]}`}><Chev down /></button>
            </span>
          </li>
        ))}
      </ul>

      <div className="totmode">
        <b>PERHITUNGAN TOTAL BEA</b>
        <div className="opts">
          <label className={'opt' + (p.totalMode === 'visible' ? ' on' : '')}>
            <input type="radio" name="tm" checked={p.totalMode === 'visible'} onChange={() => setP({ ...p, totalMode: 'visible' })} />
            <span><b>IKUT KOLOM YANG TAMPIL</b><small>Nominal yang di-hide otomatis tidak dihitung.</small></span>
          </label>
          <label className={'opt' + (p.totalMode === 'all' ? ' on' : '')}>
            <input type="radio" name="tm" checked={p.totalMode === 'all'} onChange={() => setP({ ...p, totalMode: 'all' })} />
            <span><b>SELALU SEMUA KOMPONEN BIAYA</b><small>Tidak berubah walau kolom di-hide.</small></span>
          </label>
        </div>
      </div>
      {shown === 0 && <p className="err">Minimal satu kolom harus tampil.</p>}

      <div className="form-actions sticky-foot">
        <button type="button" className="btn btn-ghost" onClick={() => setP(normalizePrefs(DEFAULT_PREFS))}>RESET KE DEFAULT</button>
        <span className="grow" />
        <button type="button" className="btn btn-ghost" onClick={onClose}>BATAL</button>
        <button type="button" className="btn btn-primary" disabled={shown === 0} onClick={() => onSave(p)}>SIMPAN</button>
      </div>
    </Modal>
  );
}

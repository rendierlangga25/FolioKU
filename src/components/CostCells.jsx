// Sel-sel tabel biaya, dipakai bersama oleh ARMADA dan BIAYA LOGISTIC
// supaya kolom, rata kiri/kanan/tengah, dan angkanya identik di kedua halaman.
import { jarak, kmPerL, ritase } from '../lib/calc.js';
import { fmtDate, int, num } from '../lib/format.js';
import { COST_COL, colAlign, colValue, totalOf } from '../lib/tableCols.js';

/** Kelas perataan kolom: judul & isi memakai kelas yang sama → selalu sejajar. */
export const colClass = colAlign;

export function Cell({ id, t, dn, master, prefs }) {
  const cls = colClass(id);
  const money = (v, extra = '') => <td className={`${cls} mono ${extra}`}>{int(v)}</td>;
  switch (id) {
    case 'tanggal': return <td className={cls}>{fmtDate(t.tanggal)}</td>;
    case 'driver1': return <td className={cls}>{dn(t.driver1_id)}</td>;
    case 'driver2': return <td className={cls}>{t.driver2_id ? dn(t.driver2_id) : <span className="muted">—</span>}</td>;
    case 'plat': return <td className={cls}>{master.vehicle[t.vehicle_id]?.plat || '—'}</td>;
    case 'tujuan': return <td className={cls + ' wrap'}>{(t.tujuan || []).join(', ')}</td>;
    case 'km_awal': case 'km_isi': case 'km_akhir': return money(colValue(id, t));
    case 'jarak': return money(jarak(t), 'b');
    case 'kml': return <td className={cls + ' mono'}>{num(kmPerL(t))}</td>;
    case 'total': return money(totalOf(t, prefs), 'b');
    case 'ritase': return <td className={cls + ' mono'}>{ritase(t)}</td>;
    case 'kartu': return <td className={cls + ' mono'}>{t.kartu4}</td>;
    default: return money(colValue(id, t));
  }
}

/** Baris total di kaki tabel. Sel pertama selalu memuat label "Total (n data)". */
export function Foot({ id, first, n, rows, prefs }) {
  const sumOf = () => rows.reduce((a, t) => a + colValue(id, t, prefs), 0);
  let v = null;
  if (COST_COL[id] || id === 'total' || id === 'ritase' || id === 'jarak') v = int(sumOf());
  else if (id === 'kml') {
    const j = rows.reduce((a, t) => a + jarak(t), 0);
    const l = rows.reduce((a, t) => a + (t.harga_liter > 0 ? t.bbm_rp / t.harga_liter : 0), 0);
    v = num(l ? j / l : 0);
  }
  if (first && v == null) return <td className="l">Total ({n} data)</td>;
  return <td className={colClass(id) + ' mono'}>{first && <span className="foot-l">Total ({n} data)</span>}{v}</td>;
}

export function csvCell(id, t, dn, master, prefs) {
  switch (id) {
    case 'tanggal': return t.tanggal;
    case 'driver1': return dn(t.driver1_id);
    case 'driver2': return t.driver2_id ? dn(t.driver2_id) : '';
    case 'plat': return master.vehicle[t.vehicle_id]?.plat || '';
    case 'tujuan': return (t.tujuan || []).join(' | ');
    case 'kml': return kmPerL(t).toFixed(2);
    case 'kartu': return t.kartu4;
    default: return colValue(id, t, prefs);
  }
}

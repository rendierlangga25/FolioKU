// Definisi kolom Tabel data (Database Driver) + preferensi susunan/hide kolom oleh owner.
import { COST_FIELDS, driverIds, jarak, kmPerL, kmPerLDriver, liter, ritase, totalBea } from './calc.js';

/** id kolom → field biaya (hanya kolom bernominal yang ikut TOTAL BEA). */
export const COST_COL = { bbm: 'bbm_rp', tol: 'tol_rp', parkir: 'parkir_rp', parkir_cash: 'parkir_cash_rp', kuli: 'kuli_bongkar_rp', security: 'security_rp' };

/** Urutan default sesuai permintaan. */
export const DEFAULT_ORDER = ['tanggal', 'driver1', 'driver2', 'plat', 'tujuan', 'km_awal', 'km_isi', 'km_akhir', 'jarak', 'kml',
  'bbm', 'tol', 'parkir', 'parkir_cash', 'kuli', 'security', 'total', 'ritase', 'kartu'];

export const COL_LABEL = {
  tanggal: 'Tanggal', driver1: 'Driver 1', driver2: 'Driver 2', plat: 'No Plat', tujuan: 'Tujuan', km_awal: 'KM Awal', km_isi: 'KM Isi',
  km_akhir: 'KM Akhir', jarak: 'Jarak', kml: 'KM/L', bbm: 'BBM', tol: 'Toll', parkir: 'Parkir', parkir_cash: 'Parkir Cash',
  kuli: 'Kuli Bongkar', security: 'Security', total: 'Total Bea', ritase: 'Ritase', kartu: 'No Kartu',
};

export const DEFAULT_PREFS = { order: DEFAULT_ORDER, hidden: [], totalMode: 'visible' };

/** Rapikan preferensi tersimpan: buang id asing, tambahkan kolom baru di akhir. */
export function normalizePrefs(p) {
  const base = p && typeof p === 'object' ? p : {};
  const order = Array.isArray(base.order) ? base.order.filter((id, i, a) => DEFAULT_ORDER.includes(id) && a.indexOf(id) === i) : [];
  for (const id of DEFAULT_ORDER) if (!order.includes(id)) order.push(id);
  const hidden = Array.isArray(base.hidden) ? base.hidden.filter((id) => DEFAULT_ORDER.includes(id)) : [];
  return { order, hidden, totalMode: base.totalMode === 'all' ? 'all' : 'visible' };
}

/** Kolom yang tampil, berurutan. */
export const visibleCols = (prefs) => prefs.order.filter((id) => !prefs.hidden.includes(id));

/** Field biaya yang dihitung ke TOTAL BEA: semua bila mode 'all', selain itu hanya kolom nominal yang tampil. */
export function totalFields(prefs) {
  if (prefs.totalMode === 'all') return COST_FIELDS;
  return Object.entries(COST_COL).filter(([id]) => !prefs.hidden.includes(id)).map(([, f]) => f);
}

/** Nilai TOTAL BEA satu baris. */
export const totalOf = (t, prefs) => totalBea(t, totalFields(prefs));

/** Nilai numerik kolom (untuk total di footer & ekspor). */
export function colValue(id, t, prefs) {
  switch (id) {
    case 'km_awal': return +t.km_awal || 0;
    case 'km_isi': return +t.km_isi || 0;
    case 'km_akhir': return +t.km_akhir || 0;
    case 'jarak': return jarak(t);
    case 'kml': return kmPerL(t);
    case 'total': return totalOf(t, prefs);
    case 'ritase': return ritase(t);
    default: return COST_COL[id] ? +t[COST_COL[id]] || 0 : null;
  }
}

export { kmPerLDriver };

// Preferensi kolom disimpan per halaman (di perangkat ini), jadi hide di BIAYA LOGISTIC tidak mengubah Database Driver.
export const KEY_DB = 'raxer.dbdriver.cols.v1';
export const KEY_BIAYA = 'raxer.biayalogistic.cols.v1';
export function loadPrefs(key = KEY_DB) {
  try { return normalizePrefs(JSON.parse(localStorage.getItem(key))); } catch { return normalizePrefs(null); }
}
export function savePrefs(p, key = KEY_DB) { try { localStorage.setItem(key, JSON.stringify(p)); } catch { /* abaikan */ } }

/** Kolom bernominal yang masih tampil (urut sesuai susunan tabel) — dipakai tabel ringkasan agar ikut di-hide. */
export const visibleCostCols = (prefs) => visibleCols(prefs).filter((id) => COST_COL[id]);

/**
 * Ringkasan biaya per NO PLAT ('plat') atau per DRIVER ('driver').
 *  • plat   : semua angka utuh.
 *  • driver : jarak, biaya & total dibagi jumlah driver (2 driver → separuh), KM/L = jarak bagian ÷ liter utuh
 *             (2 driver → separuh KM/L mobil). Ritase = jumlah tujuan pengiriman yang diikuti (tidak dibagi).
 * Total Bea mengikuti pengaturan kolom (`prefs`) sama persis dengan tabel data.
 */
export function summarizeBea(trips, by, prefs) {
  const m = new Map();
  const blank = (id) => ({ id, kirim: 0, ritase: 0, jarak: 0, liter: 0, literFull: 0, total: 0, costs: Object.fromEntries(COST_FIELDS.map((f) => [f, 0])) });
  for (const t of trips) {
    const ids = by === 'plat' ? [t.vehicle_id] : driverIds(t);
    const n = by === 'plat' ? 1 : ids.length || 1;
    for (const id of ids) {
      const a = m.get(id) || blank(id);
      a.kirim += 1;
      a.ritase += ritase(t);
      a.jarak += jarak(t) / n;
      a.liter += liter(t) / n;
      a.literFull += liter(t);
      a.total += totalOf(t, prefs) / n;
      for (const f of COST_FIELDS) a.costs[f] += (+t[f] || 0) / n;
      m.set(id, a);
    }
  }
  return [...m.values()].map((a) => ({ ...a, kmL: a.literFull ? a.jarak / a.literFull : 0 }));
}

const ALIGN_RIGHT = new Set(['km_awal', 'km_isi', 'km_akhir', 'jarak', 'kml', 'bbm', 'tol', 'parkir', 'parkir_cash', 'kuli', 'security', 'total']);
const ALIGN_CENTER = new Set(['tanggal', 'plat', 'ritase', 'kartu']);
/** Perataan kolom: 'r' | 'c' | 'l' — dipakai tabel di layar DAN ekspor Excel agar identik. */
export const colAlign = (id) => (ALIGN_RIGHT.has(id) ? 'r' : ALIGN_CENTER.has(id) ? 'c' : 'l');

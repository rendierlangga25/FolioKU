// Bahan DASHBOARD › LOGISTIC: KPI, komposisi biaya, tren, per armada, per driver, tujuan terbanyak.
// Semua angka dihitung dari data pengiriman pada rentang tanggal terpilih (tanpa angka karangan).
import { COST_FIELDS, driverIds, jarak, liter, ritase, totalBiaya } from './calc.js';

export const COST_META = [
  { key: 'bbm_rp', label: 'BBM' }, { key: 'tol_rp', label: 'Toll' }, { key: 'parkir_rp', label: 'Parkir' },
  { key: 'parkir_cash_rp', label: 'Parkir cash' }, { key: 'kuli_bongkar_rp', label: 'Kuli bongkar' }, { key: 'security_rp', label: 'Security' },
];

const sumF = (rows, f) => rows.reduce((a, t) => a + (+t[f] || 0), 0);

export function kpi(trips) {
  const j = trips.reduce((a, t) => a + jarak(t), 0);
  const l = trips.reduce((a, t) => a + liter(t), 0);
  const total = trips.reduce((a, t) => a + totalBiaya(t), 0);
  const bbm = sumF(trips, 'bbm_rp');
  return {
    trips: trips.length, ritase: trips.reduce((a, t) => a + ritase(t), 0), jarak: j, liter: l, kmL: l ? j / l : 0,
    total, bbm, nonBbm: total - bbm, perKm: j ? total / j : 0, perTrip: trips.length ? total / trips.length : 0,
    kendala: trips.filter((t) => t.kendala_ket || (t.foto_kendala || []).length).length,
  };
}

/** Komposisi biaya (urut terbesar) beserta persen. */
export function composition(trips) {
  const total = trips.reduce((a, t) => a + totalBiaya(t), 0);
  return COST_META.map((m) => { const v = sumF(trips, m.key); return { ...m, value: v, pct: total ? v / total : 0 }; });
}

const iso = (d) => d.toISOString().slice(0, 10);
/** Tren: per hari (≤ 62 hari), selain itu per minggu (Senin) agar grafik tetap terbaca. */
export function trend(trips, { from, to }) {
  const d0 = new Date(from + 'T00:00:00Z'), d1 = new Date(to + 'T00:00:00Z');
  const days = Math.round((d1 - d0) / 86400000) + 1;
  const weekly = days > 62;
  const keyOf = (s) => {
    if (!weekly) return s;
    const d = new Date(s + 'T00:00:00Z'); const dow = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - dow); return iso(d);
  };
  const buckets = new Map();
  const step = weekly ? 7 : 1;
  const start = new Date(keyOf(from) + 'T00:00:00Z');
  for (let d = start; d <= d1; d = new Date(d.getTime() + step * 86400000)) {
    buckets.set(iso(d), { key: iso(d), weekly, trips: 0, jarak: 0, liter: 0, total: 0, ...Object.fromEntries(COST_FIELDS.map((f) => [f, 0])) });
  }
  for (const t of trips) {
    const b = buckets.get(keyOf(t.tanggal)); if (!b) continue;
    b.trips += 1; b.jarak += jarak(t); b.liter += liter(t); b.total += totalBiaya(t);
    for (const f of COST_FIELDS) b[f] += +t[f] || 0;
  }
  return [...buckets.values()].map((b) => ({ ...b, kmL: b.liter ? b.jarak / b.liter : 0 }));
}

/** Per armada (mobil): biaya per komponen, jarak, KM/L, biaya per km. */
export function byVehicle(trips) {
  const m = new Map();
  for (const t of trips) {
    const a = m.get(t.vehicle_id) || { id: t.vehicle_id, trips: 0, ritase: 0, jarak: 0, liter: 0, total: 0, ...Object.fromEntries(COST_FIELDS.map((f) => [f, 0])) };
    a.trips += 1; a.ritase += ritase(t); a.jarak += jarak(t); a.liter += liter(t); a.total += totalBiaya(t);
    for (const f of COST_FIELDS) a[f] += +t[f] || 0;
    m.set(t.vehicle_id, a);
  }
  return [...m.values()].map((a) => ({ ...a, kmL: a.liter ? a.jarak / a.liter : 0, perKm: a.jarak ? a.total / a.jarak : 0 }))
    .sort((a, b) => b.total - a.total);
}

/** Per driver: jarak, biaya, liter dibagi rata bila 2 driver (KM/L = jarak bagian ÷ liter bagian = KM/L perjalanan). */
export function byDriver(trips) {
  const m = new Map();
  for (const t of trips) {
    const ids = driverIds(t); const n = ids.length || 1;
    for (const id of ids) {
      const a = m.get(id) || { id, trips: 0, jarak: 0, liter: 0, total: 0 };
      a.trips += 1; a.jarak += jarak(t) / n; a.liter += liter(t) / n; a.total += totalBiaya(t) / n;
      m.set(id, a);
    }
  }
  return [...m.values()].map((a) => ({ ...a, kmL: a.liter ? a.jarak / a.liter : 0 })).sort((a, b) => b.kmL - a.kmL);
}

/** Tujuan paling sering (nama sudah huruf besar dari form). */
export function topDestinations(trips, n = 8) {
  const m = new Map();
  for (const t of trips) for (const d of (t.tujuan || [])) { const k = String(d || '').trim().toUpperCase(); if (k) m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)).slice(0, n);
}

// Semua rumus bisnis ada di sini (dipakai tabel, ringkasan, dan form).
//
//  Total jarak (per input) = KM akhir − KM awal
//  Liter                   = Rp BBM ÷ harga per liter
//  KM/Liter                = jarak ÷ liter
//  Jarak, Rp BBM, liter & KM/liter dibagi 2 bila ada 2 driver; bila hanya 1 driver tidak dibagi.
//  KM/liter per driver = KM/liter perjalanan ÷ jumlah driver (= jarak bagian driver ÷ liter penuh).

export const jarak = (t) => Math.max(0, (+t.km_akhir || 0) - (+t.km_awal || 0));
export const liter = (t) => (+t.harga_liter > 0 ? (+t.bbm_rp || 0) / +t.harga_liter : 0);
export const kmPerL = (t) => (liter(t) > 0 ? jarak(t) / liter(t) : 0);
export const driverIds = (t) => [t.driver1_id, t.driver2_id].filter(Boolean);
export const bagi = (t) => driverIds(t).length || 1;
/** KM/liter bagian satu driver: dibagi jumlah driver (2 driver → separuh). */
export const kmPerLDriver = (t) => kmPerL(t) / bagi(t);
/** Komponen biaya bernominal (urutan = urutan default kolom). */
export const COST_FIELDS = ['bbm_rp', 'tol_rp', 'parkir_rp', 'parkir_cash_rp', 'kuli_bongkar_rp', 'security_rp'];
/** Total biaya penuh = semua komponen. */
export const totalBiaya = (t) => COST_FIELDS.reduce((a, k) => a + (+t[k] || 0), 0);
/** Total BEA mengikuti komponen yang dipilih (mis. hanya kolom yang tampil). */
export const totalBea = (t, fields = COST_FIELDS) => fields.reduce((a, k) => a + (+t[k] || 0), 0);
/** Ritase = jumlah tujuan dalam 1 pengiriman. */
export const ritase = (t) => (t.tujuan || []).filter((x) => String(x || '').trim()).length;

const blank = () => ({ ritase: 0, tujuan: 0, jarak: 0, bbm: 0, tol: 0, parkir: 0, total: 0, liter: 0, literFull: 0 });

/** Ringkasan per mobil */
export function summarizeByVehicle(trips) {
  const m = new Map();
  for (const t of trips) {
    const a = m.get(t.vehicle_id) || { id: t.vehicle_id, ...blank() };
    a.ritase += 1;
    a.tujuan += (t.tujuan || []).filter(Boolean).length;
    a.jarak += jarak(t);
    a.bbm += +t.bbm_rp || 0;
    a.tol += +t.tol_rp || 0;
    a.parkir += +t.parkir_rp || 0;
    a.total += totalBiaya(t);
    a.liter += liter(t);
    m.set(t.vehicle_id, a);
  }
  return [...m.values()].map((a) => ({ ...a, kmL: a.liter ? a.jarak / a.liter : 0 }));
}

/** Ringkasan per driver — jarak/BBM/liter dibagi rata bila 2 driver */
export function summarizeByDriver(trips) {
  const m = new Map();
  for (const t of trips) {
    const ids = driverIds(t);
    const n = ids.length || 1;
    for (const id of ids) {
      const a = m.get(id) || { id, ...blank() };
      a.ritase += 1;
      a.tujuan += (t.tujuan || []).filter(Boolean).length / n;
      a.jarak += jarak(t) / n;
      a.bbm += (+t.bbm_rp || 0) / n;
      a.tol += (+t.tol_rp || 0) / n;
      a.parkir += (+t.parkir_rp || 0) / n;
      a.total += totalBiaya(t) / n;
      a.liter += liter(t) / n;
      a.literFull += liter(t); // liter utuh perjalanan → KM/L driver ikut dibagi n
      m.set(id, a);
    }
  }
  // KM/L driver = jarak bagian driver ÷ liter utuh  (2 driver → separuh dari KM/L mobil)
  return [...m.values()].map((a) => ({ ...a, kmL: a.literFull ? a.jarak / a.literFull : 0 }));
}

/** Matriks BBM: baris = driver, kolom = mobil (BBM dibagi rata bila 2 driver) */
export function bbmMatrix(trips) {
  const cell = new Map(); // `${driver}|${vehicle}` -> rp
  const rowTot = new Map();
  const colTot = new Map();
  let grand = 0;
  for (const t of trips) {
    const ids = driverIds(t);
    const n = ids.length || 1;
    const part = (+t.bbm_rp || 0) / n;
    for (const d of ids) {
      const k = `${d}|${t.vehicle_id}`;
      cell.set(k, (cell.get(k) || 0) + part);
      rowTot.set(d, (rowTot.get(d) || 0) + part);
      colTot.set(t.vehicle_id, (colTot.get(t.vehicle_id) || 0) + part);
      grand += part;
    }
  }
  return { cell, rowTot, colTot, grand };
}

/** Rekap harian per mobil: total jarak per tanggal per mobil + pembagian per driver */
export function dailyByVehicle(trips) {
  const m = new Map();
  for (const t of trips) {
    const key = `${t.tanggal}|${t.vehicle_id}`;
    const a = m.get(key) || { key, tanggal: t.tanggal, vehicle_id: t.vehicle_id, ...blank(), perDriver: new Map() };
    const ids = driverIds(t);
    const n = ids.length || 1;
    a.ritase += 1;
    a.tujuan += (t.tujuan || []).filter(Boolean).length;
    a.jarak += jarak(t);
    a.bbm += +t.bbm_rp || 0;
    a.total += totalBiaya(t);
    a.liter += liter(t);
    for (const d of ids) {
      const p = a.perDriver.get(d) || { jarak: 0, bbm: 0, literFull: 0, kmL: 0 };
      p.jarak += jarak(t) / n;
      p.bbm += (+t.bbm_rp || 0) / n;
      p.literFull += liter(t);
      p.kmL = p.literFull ? p.jarak / p.literFull : 0;
      a.perDriver.set(d, p);
    }
    m.set(key, a);
  }
  return [...m.values()]
    .map((a) => ({ ...a, kmL: a.liter ? a.jarak / a.liter : 0 }))
    .sort((x, y) => (x.tanggal < y.tanggal ? 1 : x.tanggal > y.tanggal ? -1 : 0));
}

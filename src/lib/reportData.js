// Bahan REPORT LOGISTIC: kategori laporan, periode, dan pengolahan baris untuk diekspor (semua fungsi murni → bisa dites).
// Angka memakai rumus yang SAMA dengan seluruh aplikasi (calc.js / logisticStats.js).
import { COST_FIELDS, driverIds, jarak, liter, ritase, totalBiaya } from './calc.js';
import { COST_META, byDriver, byVehicle, composition } from './logisticStats.js';
import { fmtDate, monthRange } from './format.js';

/** Kategori laporan. vehicle/driver/date = filter yang berlaku (yang lain tampil nonaktif "All"). */
export const CATEGORIES = [
  { id: 'pengiriman', label: 'Data Pengiriman', hint: 'Excel · semua kolom + biaya per komponen', vehicle: true, driver: true, date: true, file: 'xlsx' },
  { id: 'biaya', label: 'Rekap Biaya Logistic', hint: 'Excel · per armada, driver, bulan & komponen', vehicle: true, driver: true, date: true, file: 'xlsx' },
  { id: 'performa', label: 'Performa Driver & Armada', hint: 'Excel · KM/L, jarak, pengiriman, kendala', vehicle: true, driver: true, date: true, file: 'xlsx' },
  { id: 'dock', label: 'Loading Dock', hint: 'Excel · upload loading internal & eksternal', vehicle: true, driver: false, date: true, file: 'xlsx' },
  { id: 'master', label: 'Master Data', hint: 'Excel · driver, kendaraan, harga BBM, tujuan', vehicle: false, driver: false, date: false, file: 'xlsx' },
  { id: 'backup', label: 'Backup Seluruh Data', hint: 'ZIP · Excel lengkap + JSON semua tabel (tanpa foto)', vehicle: false, driver: false, date: false, file: 'zip' },
  { id: 'foto', label: 'Foto Bukti (ZIP berfolder)', hint: 'ZIP · tersusun per tahun / bulan / plat / pengiriman', vehicle: true, driver: true, date: true, file: 'zip', photos: true },
];

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** Tipe tanggal → { from, to, label, slug }. 'semua' = tanpa batas. */
export function periodOf({ type, year, month, range }) {
  if (type === 'semua') return { from: null, to: null, label: 'Semua data', slug: 'semua-data' };
  if (type === 'tahunan') return { from: `${year}-01-01`, to: `${year}-12-31`, label: `Tahun ${year}`, slug: String(year) };
  if (type === 'bulanan') {
    const r = monthRange(month);
    return { ...r, label: `${NAMA_BULAN[+month.slice(5, 7) - 1]} ${month.slice(0, 4)}`, slug: month };
  }
  const { from, to } = range;
  return { from, to, label: from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`, slug: from === to ? from : `${from}_sd_${to}` };
}

export const inPeriod = (date, p) => (!p.from || date >= p.from) && (!p.to || date <= p.to);
export const filterTrips = (trips, { vehicle, driver } = {}) =>
  trips.filter((t) => (!vehicle || t.vehicle_id === vehicle) && (!driver || t.driver1_id === driver || t.driver2_id === driver));
/** Loading dock: filter plat memakai teks plat (upload eksternal tidak punya plat → ikut tersaring bila plat dipilih). */
export const filterDock = (docks, { plat } = {}) => docks.filter((d) => !plat || String(d.plat || '').toUpperCase() === plat.toUpperCase());

const kendalaOf = (t) => Boolean(t.kendala_ket) || (t.foto_kendala || []).length > 0;
export const countTripPhotos = (t) =>
  ['foto_path', 'foto_km_isi', 'foto_km_akhir', 'foto_sisa_bbm'].filter((k) => t[k]).length
  + ['foto_serah_terima', 'foto_surat_jalan', 'foto_kendala'].reduce((a, k) => a + (t[k] || []).length, 0);

const safe = (a, b) => (b > 0 ? a / b : 0);
const round = (n, d = 2) => Math.round((+n || 0) * 10 ** d) / 10 ** d;

/* ───────── kolom ───────── */
const COST_COLS = COST_META.map((m) => ({ key: m.key, header: m.label.toUpperCase(), type: 'rp', sum: true, width: 14 }));

export const TRIP_COLS = [
  { key: 'tanggal', header: 'TANGGAL', type: 'date', width: 13 },
  { key: 'driver1', header: 'DRIVER 1', width: 16 }, { key: 'driver2', header: 'DRIVER 2', width: 16 },
  { key: 'plat', header: 'NO PLAT', width: 13 }, { key: 'jenis', header: 'JENIS MOBIL', width: 15 },
  { key: 'tujuan', header: 'TUJUAN', width: 38, wrap: true },
  { key: 'ritase', header: 'RITASE', type: 'int', sum: true, width: 9 },
  { key: 'km_awal', header: 'KM AWAL', type: 'int', width: 11 }, { key: 'km_isi', header: 'KM ISI', type: 'int', width: 11 }, { key: 'km_akhir', header: 'KM AKHIR', type: 'int', width: 11 },
  { key: 'jarak', header: 'JARAK (KM)', type: 'int', sum: true, width: 12 },
  { key: 'liter', header: 'LITER BBM', type: 'dec1', sum: true, width: 11 },
  { key: 'kml', header: 'KM/L', type: 'dec2', width: 9 },
  ...COST_COLS,
  { key: 'total', header: 'TOTAL BEA', type: 'rp', sum: true, width: 15, bold: true },
  { key: 'kartu', header: 'NO KARTU', type: 'text', width: 10 },
  { key: 'harga_liter', header: 'HARGA BBM/L', type: 'rp', width: 13 },
  { key: 'kendala', header: 'KENDALA', width: 28, wrap: true },
  { key: 'foto', header: 'JML FOTO', type: 'int', sum: true, width: 9 },
  { key: 'input_oleh', header: 'DIINPUT OLEH', width: 16 },
  { key: 'waktu_input', header: 'WAKTU INPUT', type: 'datetime', width: 18 },
];

export function tripRows(trips, { driver, vehicle, userName }) {
  return trips.map((t) => {
    const v = vehicle[t.vehicle_id];
    return {
      tanggal: t.tanggal, driver1: driver[t.driver1_id]?.nama || '', driver2: t.driver2_id ? driver[t.driver2_id]?.nama || '' : '',
      plat: v?.plat || '', jenis: v?.nama || '', tujuan: (t.tujuan || []).join(', '), ritase: ritase(t),
      km_awal: +t.km_awal || 0, km_isi: +t.km_isi || 0, km_akhir: +t.km_akhir || 0, jarak: jarak(t), liter: round(liter(t), 2),
      kml: round(safe(jarak(t), liter(t))),
      ...Object.fromEntries(COST_FIELDS.map((f) => [f, +t[f] || 0])), total: totalBiaya(t),
      kartu: String(t.kartu4 ?? ''), harga_liter: +t.harga_liter || 0, kendala: t.kendala_ket || ((t.foto_kendala || []).length ? 'Ada foto kendala' : ''),
      foto: countTripPhotos(t), input_oleh: userName(t.created_by), waktu_input: t.created_at || '',
    };
  });
}
/** Isi baris TOTAL untuk kolom yang bukan penjumlahan biasa (KM/L armada = Σ jarak ÷ Σ liter). */
export function tripFoot(trips) {
  const j = trips.reduce((a, t) => a + jarak(t), 0), l = trips.reduce((a, t) => a + liter(t), 0);
  return { kml: round(safe(j, l)) };
}

/* ───────── rekap biaya ───────── */
const REKAP_TAIL = [
  { key: 'jarak', header: 'JARAK (KM)', type: 'int', sum: true, width: 12 }, { key: 'liter', header: 'LITER BBM', type: 'dec1', sum: true, width: 11 },
  { key: 'kml', header: 'KM/L', type: 'dec2', width: 9 }, ...COST_COLS,
  { key: 'total', header: 'TOTAL BEA', type: 'rp', sum: true, width: 15, bold: true }, { key: 'per_km', header: 'BIAYA / KM', type: 'rp', width: 13 },
];
export const REKAP_ARMADA_COLS = [{ key: 'plat', header: 'NO PLAT', width: 13 }, { key: 'jenis', header: 'JENIS MOBIL', width: 15 },
  { key: 'pengiriman', header: 'PENGIRIMAN', type: 'int', sum: true, width: 12 }, { key: 'ritase', header: 'RITASE', type: 'int', sum: true, width: 9 }, ...REKAP_TAIL];
export const REKAP_DRIVER_COLS = [{ key: 'driver', header: 'DRIVER', width: 18 },
  { key: 'pengiriman', header: 'PENGIRIMAN', type: 'int', sum: true, width: 12 }, { key: 'ritase', header: 'RITASE', type: 'int', sum: true, width: 9 },
  { key: 'jarak', header: 'JARAK BAGIAN (KM)', type: 'int', sum: true, width: 17 }, { key: 'liter', header: 'LITER BAGIAN', type: 'dec1', sum: true, width: 13 },
  { key: 'kml', header: 'KM/L', type: 'dec2', width: 9 },
  { key: 'total', header: 'BIAYA BAGIAN', type: 'rp', sum: true, width: 15, bold: true }, { key: 'per_km', header: 'BIAYA / KM', type: 'rp', width: 13 }];
export const REKAP_BULAN_COLS = [{ key: 'bulan', header: 'BULAN', width: 18 },
  { key: 'pengiriman', header: 'PENGIRIMAN', type: 'int', sum: true, width: 12 }, { key: 'ritase', header: 'RITASE', type: 'int', sum: true, width: 9 }, ...REKAP_TAIL.filter((c) => c.key !== 'per_km'),
  { key: 'per_km', header: 'BIAYA / KM', type: 'rp', width: 13 }];
export const KOMPONEN_COLS = [{ key: 'komponen', header: 'KOMPONEN BIAYA', width: 20 }, { key: 'nilai', header: 'NILAI', type: 'rp', sum: true, width: 16 }, { key: 'persen', header: '% DARI TOTAL', type: 'pct', width: 14 }];

const comps = (src) => Object.fromEntries(COST_FIELDS.map((f) => [f, src[f] || 0]));

export function rekapBiaya(trips, { driver, vehicle }) {
  const armada = byVehicle(trips).map((v) => ({
    plat: vehicle[v.id]?.plat || '—', jenis: vehicle[v.id]?.nama || '', pengiriman: v.trips, ritase: v.ritase, jarak: v.jarak, liter: round(v.liter, 2),
    kml: round(v.kmL), ...comps(v), total: v.total, per_km: Math.round(v.perKm),
  }));
  const dr = byDriver(trips).map((d) => ({
    driver: driver[d.id]?.nama || '—', pengiriman: d.trips, ritase: 0, jarak: round(d.jarak, 1), liter: round(d.liter, 2), kml: round(d.kmL), total: round(d.total, 0), per_km: Math.round(safe(d.total, d.jarak)),
  }));
  // ritase per driver (bagian tidak dibagi: ritase = jumlah tujuan pengiriman yang ia ikuti)
  const rit = new Map();
  for (const t of trips) for (const id of driverIds(t)) rit.set(id, (rit.get(id) || 0) + ritase(t));
  byDriver(trips).forEach((d, i) => { dr[i].ritase = rit.get(d.id) || 0; });

  const m = new Map();
  for (const t of trips) {
    const k = t.tanggal.slice(0, 7);
    const a = m.get(k) || { ym: k, pengiriman: 0, ritase: 0, jarak: 0, liter: 0, ...Object.fromEntries(COST_FIELDS.map((f) => [f, 0])), total: 0 };
    a.pengiriman += 1; a.ritase += ritase(t); a.jarak += jarak(t); a.liter += liter(t); a.total += totalBiaya(t);
    for (const f of COST_FIELDS) a[f] += +t[f] || 0;
    m.set(k, a);
  }
  const bulan = [...m.values()].sort((a, b) => (a.ym < b.ym ? -1 : 1)).map((a) => ({
    bulan: `${NAMA_BULAN[+a.ym.slice(5, 7) - 1]} ${a.ym.slice(0, 4)}`, pengiriman: a.pengiriman, ritase: a.ritase, jarak: a.jarak, liter: round(a.liter, 2),
    kml: round(safe(a.jarak, a.liter)), ...comps(a), total: a.total, per_km: Math.round(safe(a.total, a.jarak)),
  }));
  const komponen = composition(trips).filter((c) => c.value > 0).map((c) => ({ komponen: c.label.toUpperCase(), nilai: c.value, persen: c.pct }));
  return { armada, driver: dr, bulan, komponen };
}

/* ───────── performa ───────── */
export const PERF_DRIVER_COLS = [{ key: 'driver', header: 'DRIVER', width: 18 }, { key: 'pengiriman', header: 'PENGIRIMAN', type: 'int', sum: true, width: 12 },
  { key: 'ritase', header: 'RITASE', type: 'int', sum: true, width: 9 }, { key: 'jarak', header: 'JARAK (KM)', type: 'int', sum: true, width: 12 },
  { key: 'liter', header: 'LITER BBM', type: 'dec1', sum: true, width: 11 }, { key: 'kml', header: 'KM/L', type: 'dec2', width: 9 },
  { key: 'kendala', header: 'KENDALA', type: 'int', sum: true, width: 10 }, { key: 'total', header: 'BIAYA BAGIAN', type: 'rp', sum: true, width: 15 }];
export const PERF_ARMADA_COLS = [{ key: 'plat', header: 'NO PLAT', width: 13 }, { key: 'jenis', header: 'JENIS MOBIL', width: 15 },
  { key: 'pengiriman', header: 'PENGIRIMAN', type: 'int', sum: true, width: 12 }, { key: 'jarak', header: 'JARAK (KM)', type: 'int', sum: true, width: 12 },
  { key: 'liter', header: 'LITER BBM', type: 'dec1', sum: true, width: 11 }, { key: 'kml', header: 'KM/L', type: 'dec2', width: 9 },
  { key: 'kendala', header: 'KENDALA', type: 'int', sum: true, width: 10 }, { key: 'total', header: 'TOTAL BEA', type: 'rp', sum: true, width: 15 }, { key: 'per_km', header: 'BIAYA / KM', type: 'rp', width: 13 }];

/** Basis sama dengan tab PERFORMA: jarak & liter PENUH per perjalanan (tidak dibagi bila berdua); biaya dibagi rata. */
export function performa(trips, { driver, vehicle }) {
  const d = new Map(), v = new Map();
  for (const t of trips) {
    const ids = driverIds(t);
    for (const id of ids) {
      const a = d.get(id) || { id, pengiriman: 0, ritase: 0, jarak: 0, liter: 0, kendala: 0, total: 0 };
      a.pengiriman += 1; a.ritase += ritase(t); a.jarak += jarak(t); a.liter += liter(t); a.kendala += kendalaOf(t) ? 1 : 0; a.total += totalBiaya(t) / (ids.length || 1);
      d.set(id, a);
    }
    const b = v.get(t.vehicle_id) || { id: t.vehicle_id, pengiriman: 0, jarak: 0, liter: 0, kendala: 0, total: 0 };
    b.pengiriman += 1; b.jarak += jarak(t); b.liter += liter(t); b.kendala += kendalaOf(t) ? 1 : 0; b.total += totalBiaya(t);
    v.set(t.vehicle_id, b);
  }
  return {
    driver: [...d.values()].map((a) => ({ driver: driver[a.id]?.nama || '—', pengiriman: a.pengiriman, ritase: a.ritase, jarak: a.jarak, liter: round(a.liter, 2), kml: round(safe(a.jarak, a.liter)), kendala: a.kendala, total: Math.round(a.total) }))
      .sort((x, y) => y.kml - x.kml),
    armada: [...v.values()].map((a) => ({ plat: vehicle[a.id]?.plat || '—', jenis: vehicle[a.id]?.nama || '', pengiriman: a.pengiriman, jarak: a.jarak, liter: round(a.liter, 2), kml: round(safe(a.jarak, a.liter)), kendala: a.kendala, total: a.total, per_km: Math.round(safe(a.total, a.jarak)) }))
      .sort((x, y) => y.kml - x.kml),
  };
}

/* ───────── loading dock ───────── */
export const DOCK_COLS = [
  { key: 'tanggal', header: 'TANGGAL', type: 'date', width: 13 }, { key: 'jenis', header: 'JENIS', width: 11 }, { key: 'kategori', header: 'KATEGORI', width: 12 },
  { key: 'no_so', header: 'NO SO', width: 20 }, { key: 'perusahaan', header: 'PERUSAHAAN', width: 28 }, { key: 'expedisi', header: 'EXPEDISI', width: 18 },
  { key: 'plat', header: 'NO PLAT', width: 13 },
  // jumlah foto = per UPLOAD (diulang di tiap baris SO); baris TOTAL menghitungnya sekali per upload (lihat dockFoot)
  { key: 'foto_loading', header: 'FOTO LOADING', type: 'int', width: 13 }, { key: 'foto_sj', header: 'FOTO SURAT JALAN', type: 'int', width: 16 },
  { key: 'input_oleh', header: 'DIINPUT OLEH', width: 16 }, { key: 'waktu_input', header: 'WAKTU INPUT', type: 'datetime', width: 18 },
];
/**
 * Satu baris per SO. Upload dengan 2 SO → 2 baris; data upload lain (tanggal, jenis, kategori, expedisi, plat, foto, penginput, waktu)
 * diulang di setiap baris supaya tabel bisa difilter/di-pivot per SO atau per perusahaan. `_g` = id upload (pemisah antar upload).
 */
export function dockRows(docks, userName) {
  const rows = [];
  for (const d of docks) {
    const items = (d.items || []).filter((i) => i && (i.so || i.perusahaan));
    const list = items.length ? items : [{ so: d.no_so || '', perusahaan: d.perusahaan || '' }];   // data lama tanpa rincian SO → satu baris
    const base = {
      tanggal: d.tanggal, jenis: String(d.jenis || '').toUpperCase(), kategori: String(d.kategori || '').toUpperCase(), expedisi: d.expedisi || '', plat: d.plat || '',
      foto_loading: (d.foto_loading || []).length, foto_sj: (d.foto_sj || []).length, input_oleh: userName(d.created_by), waktu_input: d.created_at || '', _g: d.id,
    };
    for (const it of list) rows.push({ ...base, no_so: it.so || '', perusahaan: it.perusahaan || '' });
  }
  return rows;
}
/** Total foto dihitung per upload (bukan per baris SO) agar tidak terhitung ganda. */
export const dockFoot = (docks) => ({
  foto_loading: docks.reduce((a, d) => a + (d.foto_loading || []).length, 0),
  foto_sj: docks.reduce((a, d) => a + (d.foto_sj || []).length, 0),
});
export const dockTotalLabel = (docks, rows) => `TOTAL (${docks.length} upload · ${rows.length} SO)`;
export const DOCK_NOTE = 'Satu baris per SO. Data upload (tanggal, jenis, foto, dst.) diulang di tiap baris; total foto dihitung per upload.';

/* ───────── master ───────── */
const yn = (v) => (v === false ? 'TIDAK' : 'YA');
export const MASTER_SHEETS = [
  { id: 'drivers', name: 'Driver', cols: [{ key: 'nama', header: 'NAMA', width: 18 }, { key: 'nama_lengkap', header: 'NAMA LENGKAP', width: 26 }, { key: 'id_karyawan', header: 'ID KARYAWAN', width: 14 }, { key: 'departemen', header: 'DEPARTEMEN', width: 16 }, { key: 'jabatan', header: 'JABATAN', width: 14 }, { key: 'aktif', header: 'AKTIF', width: 8 }], map: (r) => ({ ...r, aktif: yn(r.aktif) }) },
  { id: 'vehicles', name: 'Kendaraan', cols: [{ key: 'nama', header: 'JENIS MOBIL', width: 16 }, { key: 'plat', header: 'NO PLAT', width: 14 }, { key: 'bbm_jenis', header: 'JENIS BBM', width: 12 }, { key: 'aktif', header: 'AKTIF', width: 8 }], map: (r) => ({ ...r, aktif: yn(r.aktif) }) },
  { id: 'fuel', name: 'Harga BBM', cols: [{ key: 'jenis', header: 'JENIS BBM', width: 14 }, { key: 'harga', header: 'HARGA / LITER', type: 'rp', width: 16 }], map: (r) => ({ ...r, harga: +r.harga || 0 }) },
  { id: 'destinations', name: 'Tujuan', cols: [{ key: 'nama', header: 'TUJUAN', width: 34 }, { key: 'sumber', header: 'SUMBER', width: 10 }, { key: 'aktif', header: 'AKTIF', width: 8 }], map: (r) => ({ ...r, aktif: yn(r.aktif) }) },
  { id: 'dockOptions', name: 'Opsi Loading Dock', cols: [{ key: 'tipe', header: 'TIPE', width: 12 }, { key: 'nama', header: 'NAMA', width: 32 }, { key: 'sumber', header: 'SUMBER', width: 10 }, { key: 'aktif', header: 'AKTIF', width: 8 }], map: (r) => ({ ...r, aktif: yn(r.aktif) }) },
];
export const USER_COLS = [{ key: 'nama', header: 'NAMA', width: 22 }, { key: 'email', header: 'EMAIL', width: 30 }, { key: 'peran', header: 'PERAN', width: 10 }, { key: 'jenis', header: 'JENIS USER', width: 12 }, { key: 'aktif', header: 'AKTIF', width: 8 }, { key: 'terdaftar', header: 'TERDAFTAR', type: 'datetime', width: 18 }];
export const userRows = (profiles) => profiles.map((p) => ({ nama: p.nama || '', email: p.email || '', peran: p.role === 'owner' ? 'OWNER' : 'USER', jenis: p.role === 'owner' ? '—' : p.user_type || 'DRIVER', aktif: yn(p.active), terdaftar: p.created_at || '' }));

import { compressImage } from './format.js';
import { jarak, liter } from './calc.js';
// MODE DEMO — dipakai otomatis bila VITE_SUPABASE_URL belum diisi.
// Semua data disimpan di localStorage browser (hanya untuk mencoba tampilan & alur).
// Akun demo: owner@raxer.test / owner123  ·  driver@raxer.test / driver123

const DB_KEY = 'raxer_demo_db';
const SESSION_KEY = 'raxer_demo_session';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
const normName = (s) => String(s || '').trim().replace(/\s+/g, ' ').toUpperCase();
const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

function seed() {
  const FULL = { DICKY: 'DICKY PRATAMA', AHYAR: 'AHYAR RAMADHAN', RANTA: 'RANTA SIMANJUNTAK', ARIF: 'ARIF HIDAYAT', CEPI: 'CEPI SUPRIATNA', IRFAN: 'IRFAN MAULANA' };
  const drivers = ['DICKY', 'AHYAR', 'RANTA', 'ARIF', 'CEPI', 'IRFAN'].map((nama, i) => ({
    id: uid(), nama, aktif: true, nama_lengkap: FULL[nama], id_karyawan: `RX-${String(i + 1).padStart(3, '0')}`, departemen: 'LOGISTIC', jabatan: 'DRIVER', foto: null,
  }));
  const V = [
    ['DUTRO', 'B 9073 PCR', 'Solar'], ['DUTRO', 'B 9075 PCR', 'Solar'], ['RANGER', 'B 9262 PCR', 'Solar'],
    ['RANGER', 'B 9392 PCS', 'Solar'], ['DYNA', 'B 9561 PCF', 'Solar'], ['MITSUBISHI', 'B 9481 PXE', 'Solar'],
    ['SUZUKI CARRY', 'B 1996 PZQ', 'Pertalite'], ['GRANDMAX', 'B 9522 PCJ', 'Pertalite'], ['GRANDMAX', 'B 9636 PCJ', 'Pertalite'],
  ];
  const vehicles = V.map(([nama, plat, bbm_jenis]) => ({ id: uid(), nama, plat, bbm_jenis, aktif: true }));
  const ownerId = uid(), driverId = uid();
  const d = (n) => drivers.find((x) => x.nama === n).id;
  const v = (p) => vehicles.find((x) => x.plat === p).id;
  const t = (tanggal, plat, d1, d2, tujuan, bbm, kmA, kmB, kartu, harga, tol = 0, parkir = 0) => ({
    id: uid(), tanggal, vehicle_id: v(plat), driver1_id: d(d1), driver2_id: d2 ? d(d2) : null, tujuan,
    bbm_rp: bbm, tol_rp: tol, parkir_rp: parkir, parkir_cash_rp: 0, kuli_bongkar_rp: 0, security_rp: 0, total_rp: bbm + tol + parkir, kartu4: kartu,
    km_awal: kmA, km_isi: kmA + 5, km_akhir: kmB, foto_path: null, harga_liter: harga, created_by: driverId,
    created_at: new Date().toISOString(),
  });
  const now = new Date();
  const ym = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(now).slice(0, 7);
  const destinations = [...new Set(['ADM SUNTER', 'JKM ROXY', 'MAP SUDIRMAN', 'MOVESTOCK DEPO', 'GUDANG CAKUNG', 'PELABUHAN TANJUNG PRIOK'])]
    .map((nama) => ({ id: uid(), nama, aktif: true, sumber: 'owner' }));
  return {
    destinations, dock_options: [], dock_uploads: [],
    profiles: [
      { id: ownerId, email: 'owner@raxer.test', nama: 'Owner', role: 'owner', active: true, permissions: {}, password: 'owner123', created_at: now.toISOString() },
      { id: driverId, email: 'driver@raxer.test', nama: 'Driver Demo', role: 'driver', user_type: 'DRIVER', active: true,
        permissions: { operasional_driver: true, riwayat_saya: true }, password: 'driver123', driver_id: drivers.find((x) => x.nama === 'CEPI').id, created_at: now.toISOString() },
    ],
    drivers, vehicles,
    fuel: [{ jenis: 'Pertalite', harga: 10000 }, { jenis: 'Solar', harga: 6800 }],
    trips: [
      t(`${ym}-01`, 'B 9075 PCR', 'CEPI', 'RANTA', ['ADM SUNTER'], 180000, 185559, 185701, '1234', 6800),
      t(`${ym}-02`, 'B 9075 PCR', 'CEPI', null, ['ADM SUNTER'], 180000, 185701, 185847, '1234', 6800),
      t(`${ym}-02`, 'B 1996 PZQ', 'ARIF', 'IRFAN', ['JKM ROXY', 'MAP SUDIRMAN'], 120000, 9261, 9368, '5521', 10000, 24000, 5000),
      t(`${ym}-03`, 'B 9262 PCR', 'DICKY', 'AHYAR', ['MOVESTOCK DEPO'], 400000, 220974, 221214, '9087', 6800, 36000),
    ],
  };
}

const load = () => {
  try {
    const r = localStorage.getItem(DB_KEY);
    if (r) {
      const db = JSON.parse(r);
      // migrasi data demo lama: buat daftar tujuan dari tujuan yang pernah diinput
      if (!db.destinations) {
        const names = [...new Set((db.trips || []).flatMap((t) => t.tujuan || []))];
        db.destinations = names.map((nama) => ({ id: uid(), nama, aktif: true, sumber: 'owner' }));
      }
      if (!db.dock_options) db.dock_options = [];
      if (!db.dock_uploads) db.dock_uploads = [];
      return db;
    }
  } catch {}
  const s = seed(); localStorage.setItem(DB_KEY, JSON.stringify(s)); return s;
};
const save = (db) => localStorage.setItem(DB_KEY, JSON.stringify(db));
const strip = ({ password, ...p }) => p;
const PROFILE_FIELDS = ['nama_lengkap', 'id_karyawan', 'departemen', 'jabatan', 'foto'];

const listeners = new Set();
const getSess = () => {
  for (const s of [localStorage, sessionStorage]) { try { const v = s.getItem(SESSION_KEY); if (v) return JSON.parse(v); } catch {} }
  return null;
};
const emit = (event) => listeners.forEach((cb) => cb(event, getSess()));

export const api = {
  mode: 'demo',

  async getSession() { return getSess(); },
  onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
  async signUp({ nama, email, password }) {
    await delay();
    const db = load();
    if (db.profiles.some((p) => p.email === email.toLowerCase())) throw new Error('Email sudah terdaftar');
    db.profiles.push({ id: uid(), email: email.toLowerCase(), nama, role: 'driver', user_type: 'DRIVER', active: true, permissions: {}, password, created_at: new Date().toISOString() });
    save(db);
    return { needsConfirm: false, demo: true };
  },
  async signIn({ email, password, remember }) {
    await delay();
    const p = load().profiles.find((x) => x.email === email.trim().toLowerCase() && x.password === password);
    if (!p) throw new Error('Email atau password salah');
    sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY);
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify({ user: { id: p.id, email: p.email } }));
    emit('SIGNED_IN');
  },
  async signOut() { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); emit('SIGNED_OUT'); },
  async resetPassword(email) {
    await delay();
    if (!load().profiles.some((p) => p.email === email.trim().toLowerCase())) return; // tidak bocorkan email terdaftar
    sessionStorage.setItem('raxer_demo_reset', email.trim().toLowerCase());
  },
  async updatePassword(password) {
    const email = sessionStorage.getItem('raxer_demo_reset');
    const db = load();
    const p = db.profiles.find((x) => x.email === email);
    if (!p) throw new Error('Tautan reset tidak valid');
    p.password = password; save(db); sessionStorage.removeItem('raxer_demo_reset');
  },
  async getProfile(id) { const p = load().profiles.find((x) => x.id === id); return p ? strip(p) : null; },

  async listProfiles() { return load().profiles.map(strip); },
  async updateProfile(id, patch) {
    const db = load(); const p = db.profiles.find((x) => x.id === id); Object.assign(p, patch); save(db); emit('USER_UPDATED'); return strip(p);
  },
  async deleteProfile(id) { const db = load(); db.profiles = db.profiles.filter((x) => x.id !== id); save(db); },

  async listDrivers() { return [...load().drivers].sort((a, b) => a.nama.localeCompare(b.nama)); },
  async saveDriver(d) {
    const db = load(); const row = { nama: d.nama.trim().toUpperCase(), aktif: d.aktif ?? true };
    for (const k of PROFILE_FIELDS) if (d[k] !== undefined) row[k] = d[k] || null;
    if (d.id) Object.assign(db.drivers.find((x) => x.id === d.id), row); else db.drivers.push({ id: uid(), ...row });
    save(db);
  },
  /** Foto profil milik sendiri (akun harus terhubung ke data driver). */
  async setMyPhoto(foto) {
    const db = load(); const me = db.profiles.find((x) => x.id === getSess()?.user?.id);
    const drv = db.drivers.find((x) => x.id === me?.driver_id);
    if (!drv) throw new Error('Akun belum terhubung ke data driver. Minta developer menghubungkannya di menu USER.');
    drv.foto = foto || null; save(db);
  },
  /** Statistik bulanan tiap driver (bahan XP, tier & peringkat efisiensi) — terbuka untuk semua user. */
  async driverRangeStats(from, to) {
    const m = new Map();
    for (const t of load().trips) {
      if ((from && t.tanggal < from) || (to && t.tanggal > to)) continue;
      for (const id of [t.driver1_id, t.driver2_id].filter(Boolean)) {
        const a = m.get(id) || { driver_id: id, trips: 0, jarak: 0, liter: 0 };
        a.trips += 1; a.jarak += jarak(t); a.liter += liter(t); m.set(id, a);
      }
    }
    return [...m.values()];
  },
  async driverMonthlyStats() {
    const m = new Map();
    for (const t of load().trips) {
      for (const id of [t.driver1_id, t.driver2_id].filter(Boolean)) {
        const key = `${id}|${t.tanggal.slice(0, 7)}`;
        const a = m.get(key) || { driver_id: id, ym: t.tanggal.slice(0, 7), trips: 0, jarak: 0, liter: 0 };
        a.trips += 1; a.jarak += jarak(t); a.liter += liter(t); m.set(key, a);
      }
    }
    return [...m.values()];
  },
  async deleteDriver(id) {
    const db = load();
    if (db.trips.some((t) => t.driver1_id === id || t.driver2_id === id)) throw new Error('Tidak bisa dihapus: driver ini sudah dipakai di data pengiriman. Nonaktifkan saja agar data lama tetap utuh.');
    db.drivers = db.drivers.filter((x) => x.id !== id); db.profiles.forEach((p) => { if (p.driver_id === id) p.driver_id = null; }); save(db);
  },
  async listDestinations() { return [...load().destinations].sort((a, b) => a.nama.localeCompare(b.nama)); },
  async saveDestination(d) {
    const db = load(); const nama = normName(d.nama);
    if (!nama) throw new Error('Nama tujuan kosong');
    if (db.destinations.some((x) => x.nama === nama && x.id !== d.id)) throw new Error('Tujuan sudah ada di daftar');
    if (d.id) { const x = db.destinations.find((y) => y.id === d.id); Object.assign(x, { nama, aktif: d.aktif ?? x.aktif }); }
    else db.destinations.push({ id: uid(), nama, aktif: true, sumber: 'owner' });
    save(db);
  },
  async deleteDestination(id) { const db = load(); db.destinations = db.destinations.filter((x) => x.id !== id); save(db); },
  /** Tujuan baru yang diketik driver masuk ke daftar pilihan (yang sudah ada dilewati). */
  async addDestinations(names) {
    const db = load(); let changed = false;
    for (const raw of names) {
      const nama = normName(raw);
      if (nama && !db.destinations.some((x) => x.nama === nama)) { db.destinations.push({ id: uid(), nama, aktif: true, sumber: 'driver' }); changed = true; }
    }
    if (changed) save(db);
  },
  async listFuel() { return load().fuel; },
  async saveFuel({ jenis, harga, oldJenis }) {
    const db = load(); const f = db.fuel.find((x) => x.jenis === (oldJenis || jenis));
    if (f) { f.jenis = jenis.trim(); f.harga = harga; if (oldJenis) db.vehicles.forEach((v) => { if (v.bbm_jenis === oldJenis) v.bbm_jenis = jenis.trim(); }); }
    else db.fuel.push({ jenis: jenis.trim(), harga });
    save(db);
  },
  async deleteFuel(jenis) {
    const db = load();
    if (db.vehicles.some((v) => v.bbm_jenis === jenis)) throw new Error('Tidak bisa dihapus: jenis BBM ini masih dipakai oleh mobil. Nonaktifkan saja agar data lama tetap utuh.');
    db.fuel = db.fuel.filter((f) => f.jenis !== jenis); save(db);
  },
  async deleteVehicle(id) {
    const db = load();
    if (db.trips.some((t) => t.vehicle_id === id)) throw new Error('Tidak bisa dihapus: mobil ini sudah dipakai di data pengiriman. Nonaktifkan saja agar data lama tetap utuh.');
    db.vehicles = db.vehicles.filter((x) => x.id !== id); save(db);
  },
  async listVehicles() { return [...load().vehicles].sort((a, b) => a.nama.localeCompare(b.nama) || a.plat.localeCompare(b.plat)); },
  async saveVehicle(v) {
    const db = load(); const row = { nama: v.nama.trim().toUpperCase(), plat: v.plat.trim().toUpperCase(), bbm_jenis: v.bbm_jenis, aktif: v.aktif ?? true };
    if (db.vehicles.some((x) => x.plat === row.plat && x.id !== v.id)) throw new Error('Plat sudah terdaftar');
    if (v.id) Object.assign(db.vehicles.find((x) => x.id === v.id), row); else db.vehicles.push({ id: uid(), ...row });
    save(db);
  },

  async listTrips({ from, to, mine, uid: u } = {}) {
    await delay(60);
    return load().trips
      .filter((t) => (!from || t.tanggal >= from) && (!to || t.tanggal <= to) && (!mine || t.created_by === u))
      .sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : b.created_at.localeCompare(a.created_at)));
  },
  // Mode demo: foto disimpan sebagai data-URL di localStorage (kuota ±5 MB) → diperkecil agar muat.
  async uploadPhoto(blob) {
    const small = await compressImage(blob, 640, 0.6).catch(() => blob);
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(small); });
  },
  async photoUrl(path) { return path || null; },
  async createTrip(row) {
    await delay(); const db = load(); const t = { id: uid(), created_at: new Date().toISOString(), ...row }; db.trips.push(t); save(db); return t;
  },
  async updateTrip(id, row) { const db = load(); Object.assign(db.trips.find((x) => x.id === id), row); save(db); },
  async deleteTrip(id) { const db = load(); db.trips = db.trips.filter((x) => x.id !== id); save(db); },
  async setTripSisaBbm(id, path) {
    const db = load(); const t = db.trips.find((x) => x.id === id); if (!t) throw new Error('Data tidak ditemukan');
    const me = getSess()?.user?.id; const prof = db.profiles.find((x) => x.id === me);
    const tp = prof?.user_type || 'DRIVER';
    const ok = prof?.role === 'owner' || ['DRIVER', 'LEADER', 'SPV', 'ADMIN'].includes(tp);
    if (!ok) throw new Error('Anda tidak berhak mengubah data ini');
    t.foto_sisa_bbm = path || null; save(db);
  },
  // ── LOADING DOCK ──
  async listDockOptions() { return [...load().dock_options].sort((a, b) => a.nama.localeCompare(b.nama)); },
  async saveDockOption(o) {
    const db = load(); const nama = normName(o.nama);
    if (!nama) throw new Error('Nama kosong');
    if (db.dock_options.some((x) => x.tipe === (o.tipe || db.dock_options.find((y) => y.id === o.id)?.tipe) && x.nama === nama && x.id !== o.id)) throw new Error('Nama sudah ada di daftar');
    if (o.id) { const x = db.dock_options.find((y) => y.id === o.id); Object.assign(x, { nama, aktif: o.aktif ?? x.aktif }); }
    else db.dock_options.push({ id: uid(), tipe: o.tipe, nama, aktif: true, sumber: 'owner' });
    save(db);
  },
  async deleteDockOption(id) { const db = load(); db.dock_options = db.dock_options.filter((x) => x.id !== id); save(db); },
  /** Nama perusahaan / expedisi baru yang diketik user masuk ke daftar pilihan (yang sudah ada dilewati). */
  async addDockOptions(tipe, names) {
    const db = load(); let changed = false;
    for (const raw of names) {
      const nama = normName(raw);
      if (nama && !db.dock_options.some((x) => x.tipe === tipe && x.nama === nama)) { db.dock_options.push({ id: uid(), tipe, nama, aktif: true, sumber: 'user' }); changed = true; }
    }
    if (changed) save(db);
  },
  async listDock({ from, to } = {}) {
    await delay(60);
    return load().dock_uploads
      .filter((r) => (!from || r.tanggal >= from) && (!to || r.tanggal <= to))
      .sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : b.created_at.localeCompare(a.created_at)));
  },
  async createDock(row) {
    await delay(); const db = load(); const r = { id: uid(), created_at: new Date().toISOString(), ...row }; db.dock_uploads.push(r); save(db); return r;
  },
  async deleteDock(id) { const db = load(); db.dock_uploads = db.dock_uploads.filter((x) => x.id !== id); save(db); },

  async listTripsAll({ from, to } = {}) { return load().trips.filter((t) => (!from || t.tanggal >= from) && (!to || t.tanggal <= to)); },
  async listDockAll({ from, to } = {}) { return load().dock_uploads.filter((r) => (!from || r.tanggal >= from) && (!to || r.tanggal <= to)); },
  async listTable(name) {
    const db = load();
    const map = { profiles: db.profiles.map(({ password, ...p }) => p), drivers: db.drivers, vehicles: db.vehicles, fuel_prices: db.fuel, destinations: db.destinations,
      trips: db.trips, dock_options: db.dock_options, dock_uploads: db.dock_uploads, app_settings: Object.entries(db.settings || {}).map(([key, value]) => ({ key, value })) };
    return map[name] || null;
  },
  async downloadPhoto(path) {
    if (!path || !/^data:|^blob:|^https?:/.test(path)) throw new Error('Foto tidak tersedia');
    return (await fetch(path)).blob();
  },
  // ── BERSIHKAN DATABASE (mode demo) ──
  async cleanupRows(kind, before) { const db = load(); return (kind === 'dock' ? db.dock_uploads : db.trips).filter((r) => r.tanggal < before); },
  async deletePhotos() { return { failed: [] }; },
  async cleanupApply(kind, ids) {
    const db = load(); const set = new Set(ids);
    if (kind === 'dock') db.dock_uploads = db.dock_uploads.filter((r) => !set.has(r.id));
    else if (kind === 'pengiriman') db.trips = db.trips.filter((r) => !set.has(r.id));
    else db.trips.forEach((t) => { if (set.has(t.id)) Object.assign(t, { foto_path: null, foto_km_isi: null, foto_km_akhir: null, foto_sisa_bbm: null, foto_serah_terima: [], foto_surat_jalan: [], foto_kendala: [] }); });
    save(db);
  },
  async logCleanup(e) { const db = load(); db.cleanup_log = [{ id: uid(), at: new Date().toISOString(), ...e }, ...(db.cleanup_log || [])]; save(db); },
  async listCleanupLog() { return (load().cleanup_log || []).slice(0, 10); },
  /** Mode demo: ukuran dihitung dari data di browser (foto = data URL). */
  async storageUsage() {
    const db = load(); let photos = 0, bytes = 0;
    const isUrl = (s) => typeof s === 'string' && s.startsWith('data:');
    for (const r of [...db.trips, ...db.dock_uploads]) for (const v of Object.values(r)) for (const x of [].concat(v || [])) if (isUrl(x)) { photos += 1; bytes += Math.round(x.length * 0.75); }
    const dbBytes = JSON.stringify(db, (k, v) => (isUrl(v) ? '' : v)).length;
    return { db_bytes: dbBytes, storage_bytes: bytes, photo_count: photos, tables: [{ name: 'trips', bytes: JSON.stringify(db.trips).length, rows: db.trips.length }], monthly: [], limits: (db.settings || {}).storage_limits ?? null, checked_at: new Date().toISOString() };
  },
  async saveStorageLimits(l) { const db = load(); db.settings = { ...(db.settings || {}), storage_limits: l }; save(db); },
  async getSettings() { return { ...(load().settings || {}) }; },
  async saveSetting(key, value) { const db = load(); db.settings = { ...(db.settings || {}), [key]: value }; save(db); },
};

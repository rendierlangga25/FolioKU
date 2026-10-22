import { createClient } from '@supabase/supabase-js';

const REMEMBER_KEY = 'raxer_remember';
const both = [() => window.localStorage, () => window.sessionStorage];

// "Ingat saya": sesi disimpan di localStorage (tetap login setelah browser ditutup).
// Tanpa "ingat saya": sessionStorage (logout otomatis saat tab/browser ditutup).
const authStorage = {
  getItem: (k) => {
    for (const s of both) try { const v = s().getItem(k); if (v != null) return v; } catch {}
    return null;
  },
  setItem: (k, v) => {
    let remember = true;
    try { remember = localStorage.getItem(REMEMBER_KEY) !== '0'; } catch {}
    const [keep, drop] = remember ? both : [both[1], both[0]];
    try { keep().setItem(k, v); drop().removeItem(k); } catch {}
  },
  removeItem: (k) => both.forEach((s) => { try { s().removeItem(k); } catch {} }),
};

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { storage: authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const normName = (s) => String(s || '').trim().replace(/\s+/g, ' ').toUpperCase();

const ok = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

/** Hapus baris master; bila sudah dipakai data lain (FK) beri pesan yang jelas. */
async function del(table, col, val, pakai) {
  const { error } = await supabase.from(table).delete().eq(col, val);
  if (error) throw new Error(error.code === '23503' ? `Tidak bisa dihapus: ${pakai}. Nonaktifkan saja agar data lama tetap utuh.` : error.message);
}

export const BACKUP_TABLES = ['profiles', 'drivers', 'vehicles', 'fuel_prices', 'destinations', 'trips', 'dock_options', 'dock_uploads', 'app_settings'];

/** Baca semua halaman (PostgREST membatasi 1000 baris per permintaan). make() membuat query BARU tiap halaman. */
async function pageAll(make, size = 1000) {
  const out = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await make().range(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < size) break;
  }
  return out;
}

export const api = {
  mode: 'supabase',

  // ── Auth ──
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session ? { user: { id: data.session.user.id, email: data.session.user.email } } : null;
  },
  onAuthChange(cb) {
    const { data } = supabase.auth.onAuthStateChange((event, s) =>
      cb(event, s ? { user: { id: s.user.id, email: s.user.email } } : null)
    );
    return () => data.subscription.unsubscribe();
  },
  async signUp({ nama, email, password }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nama }, emailRedirectTo: window.location.origin + '/masuk' },
    });
    if (error) throw new Error(error.message);
    return { needsConfirm: !data.session };
  },
  async signIn({ email, password, remember }) {
    try { localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0'); } catch {}
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email atau password salah' : error.message);
  },
  async signOut() { await supabase.auth.signOut(); },
  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    });
    if (error) throw new Error(error.message);
  },
  async updatePassword(password) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  },
  async getProfile(id) {
    return ok(await supabase.from('profiles').select('*').eq('id', id).maybeSingle());
  },

  // ── Pengguna ──
  async listProfiles() {
    return ok(await supabase.from('profiles').select('*').order('created_at'));
  },
  async updateProfile(id, patch) {
    return ok(await supabase.from('profiles').update(patch).eq('id', id).select().single());
  },
  async deleteProfile(id) {
    ok(await supabase.from('profiles').delete().eq('id', id));
  },

  // ── Master ──
  async listDrivers() { return ok(await supabase.from('drivers').select('*').order('nama')); },
  async saveDriver(d) {
    const row = { nama: d.nama.trim().toUpperCase(), aktif: d.aktif ?? true };
    for (const k of ['nama_lengkap', 'id_karyawan', 'departemen', 'jabatan', 'foto']) if (d[k] !== undefined) row[k] = d[k] || null;
    return ok(d.id ? await supabase.from('drivers').update(row).eq('id', d.id).select().single()
                   : await supabase.from('drivers').insert(row).select().single());
  },
  /** Foto profil milik sendiri (RPC, tanpa perlu izin master_data). */
  async setMyPhoto(foto) { ok(await supabase.rpc('set_my_driver_photo', { p_foto: foto || null })); },
  /** Statistik bulanan tiap driver untuk XP/tier/peringkat — agregat saja, terbuka untuk semua user aktif. */
  async driverMonthlyStats() { return ok(await supabase.rpc('driver_monthly_stats')); },
  async driverRangeStats(from, to) { return ok(await supabase.rpc('driver_range_stats', { p_from: from || null, p_to: to || null })); },
  async deleteDriver(id) { await del('drivers', 'id', id, 'driver ini sudah dipakai di data pengiriman'); },
  async listDestinations() { return ok(await supabase.from('destinations').select('*').order('nama')); },
  async saveDestination(d) {
    const nama = normName(d.nama);
    if (!nama) throw new Error('Nama tujuan kosong');
    const row = { nama, ...(d.aktif !== undefined ? { aktif: d.aktif } : {}) };
    const { error } = d.id ? await supabase.from('destinations').update(row).eq('id', d.id)
                           : await supabase.from('destinations').insert({ ...row, sumber: 'owner' });
    if (error) throw new Error(error.code === '23505' ? 'Tujuan sudah ada di daftar' : error.message);
  },
  async deleteDestination(id) { ok(await supabase.from('destinations').delete().eq('id', id)); },
  /** Tujuan baru yang diketik driver masuk ke daftar pilihan; yang sudah ada dilewati. */
  async addDestinations(names) {
    const rows = [...new Set(names.map(normName).filter(Boolean))].map((nama) => ({ nama, sumber: 'driver' }));
    if (!rows.length) return;
    ok(await supabase.from('destinations').upsert(rows, { onConflict: 'nama', ignoreDuplicates: true }));
  },
  async listFuel() { return ok(await supabase.from('fuel_prices').select('*').order('jenis')); },
  async saveFuel({ jenis, harga, oldJenis }) {
    if (oldJenis && oldJenis !== jenis) ok(await supabase.from('fuel_prices').update({ jenis, harga }).eq('jenis', oldJenis));
    else ok(await supabase.from('fuel_prices').upsert({ jenis: jenis.trim(), harga }));
  },
  async deleteFuel(jenis) { await del('fuel_prices', 'jenis', jenis, 'jenis BBM ini masih dipakai oleh mobil'); },
  async deleteVehicle(id) { await del('vehicles', 'id', id, 'mobil ini sudah dipakai di data pengiriman'); },
  async listVehicles() { return ok(await supabase.from('vehicles').select('*').order('nama').order('plat')); },
  async saveVehicle(v) {
    const row = { nama: v.nama.trim().toUpperCase(), plat: v.plat.trim().toUpperCase(), bbm_jenis: v.bbm_jenis, aktif: v.aktif ?? true };
    return ok(v.id ? await supabase.from('vehicles').update(row).eq('id', v.id).select().single()
                   : await supabase.from('vehicles').insert(row).select().single());
  },

  // ── Trips ──
  async listTrips({ from, to, mine, uid } = {}) {
    let q = supabase.from('trips').select('*').order('tanggal', { ascending: false }).order('created_at', { ascending: false });
    if (from) q = q.gte('tanggal', from);
    if (to) q = q.lte('tanggal', to);
    if (mine) q = q.eq('created_by', uid);
    return ok(await q);
  },
  /** kind: km_awal | km_isi | km_akhir | serah_terima | surat_jalan | kendala */
  async uploadPhoto(blob, uid, kind = 'foto') {
    const path = `${uid}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabase.storage.from('km-photos').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw new Error('Upload foto gagal: ' + error.message);
    return path;
  },
  async photoUrl(path) {
    if (!path) return null;
    const { data } = await supabase.storage.from('km-photos').createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  },
  async createTrip(row) { return ok(await supabase.from('trips').insert(row).select().single()); },
  async updateTrip(id, row) { return ok(await supabase.from('trips').update(row).eq('id', id).select().single()); },
  async deleteTrip(id) { ok(await supabase.from('trips').delete().eq('id', id)); },
  /** Foto sisa bar bensin: pembuat input atau developer (RPC, tanpa perlu hak ubah data). path = null → hapus. */
  async setTripSisaBbm(id, path) { ok(await supabase.rpc('set_trip_sisa_bbm', { p_trip: id, p_path: path || null })); },

  // ── LOADING DOCK ──
  async listDockOptions() { return ok(await supabase.from('dock_options').select('*').order('nama')); },
  async saveDockOption(o) {
    const nama = normName(o.nama);
    if (!nama) throw new Error('Nama kosong');
    const row = { nama, ...(o.aktif !== undefined ? { aktif: o.aktif } : {}) };
    const { error } = o.id ? await supabase.from('dock_options').update(row).eq('id', o.id)
                           : await supabase.from('dock_options').insert({ ...row, tipe: o.tipe, sumber: 'owner' });
    if (error) throw new Error(error.code === '23505' ? 'Nama sudah ada di daftar' : error.message);
  },
  async deleteDockOption(id) { ok(await supabase.from('dock_options').delete().eq('id', id)); },
  /** Nama perusahaan / expedisi baru yang diketik user masuk ke daftar pilihan; yang sudah ada dilewati. */
  async addDockOptions(tipe, names) {
    const rows = [...new Set(names.map(normName).filter(Boolean))].map((nama) => ({ tipe, nama, sumber: 'user' }));
    if (!rows.length) return;
    ok(await supabase.from('dock_options').upsert(rows, { onConflict: 'tipe,nama', ignoreDuplicates: true }));
  },
  async listDock({ from, to } = {}) {
    let q = supabase.from('dock_uploads').select('*').order('tanggal', { ascending: false }).order('created_at', { ascending: false });
    if (from) q = q.gte('tanggal', from);
    if (to) q = q.lte('tanggal', to);
    return ok(await q);
  },
  async createDock(row) { return ok(await supabase.from('dock_uploads').insert(row).select().single()); },
  async deleteDock(id) { ok(await supabase.from('dock_uploads').delete().eq('id', id)); },

  // ── REPORT LOGISTIC: ekspor penuh (paginasi 1000 baris/permintaan → tidak terpotong) ──
  async listTripsAll({ from, to } = {}) {
    return pageAll(() => {
      let q = supabase.from('trips').select('*').order('tanggal', { ascending: false }).order('created_at', { ascending: false }).order('id');
      if (from) q = q.gte('tanggal', from);
      if (to) q = q.lte('tanggal', to);
      return q;
    });
  },
  async listDockAll({ from, to } = {}) {
    return pageAll(() => {
      let q = supabase.from('dock_uploads').select('*').order('tanggal', { ascending: false }).order('created_at', { ascending: false }).order('id');
      if (from) q = q.gte('tanggal', from);
      if (to) q = q.lte('tanggal', to);
      return q;
    });
  },
  /** Seluruh isi satu tabel (backup). null = tabel tidak bisa dibaca (belum dibuat / tanpa izin). */
  async listTable(name) {
    if (!BACKUP_TABLES.includes(name)) throw new Error('Tabel tidak diizinkan');
    try { return await pageAll(() => supabase.from(name).select('*').order(name === 'fuel_prices' ? 'jenis' : name === 'app_settings' ? 'key' : 'id')); } catch { return null; }
  },
  /** Unduh isi satu foto (Blob) dari penyimpanan privat. */
  async downloadPhoto(path) {
    const { data, error } = await supabase.storage.from('km-photos').download(path);
    if (error) throw new Error(error.message || 'Foto tidak dapat diunduh');
    return data;
  },
  /** Penggunaan database & penyimpanan foto (hanya developer/owner). */
  async storageUsage() { return ok(await supabase.rpc('storage_usage')); },
  async saveStorageLimits(l) { ok(await supabase.rpc('set_storage_limits', { p_db_mb: l.db_mb, p_storage_mb: l.storage_mb, p_warn: l.warn_pct, p_crit: l.crit_pct })); },

  // ── Pengaturan aplikasi ──
  async getSettings() {
    const { data, error } = await supabase.from('app_settings').select('key,value');
    if (error) return {};                       // tabel belum dibuat → pakai bawaan
    return Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  },
  async saveSetting(key, value) { ok(await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() })); },
};

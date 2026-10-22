// Daftar fitur yang bisa diberikan owner ke tiap user.
export const PERMISSIONS = [
  { key: 'dashboard', label: 'DASHBOARD', desc: 'Ringkasan & grafik LOGISTIC (biaya, armada, driver, tujuan)' },
  { key: 'operasional_driver', label: 'LOGISTIC › DRIVER', desc: 'Input pengiriman, BBM, tol, parkir, KM' },
  { key: 'biaya_logistic', label: 'LOGISTIC › BIAYA LOGISTIC', desc: 'Tabel biaya & ringkasan seluruh pengiriman' },
  { key: 'riwayat_saya', label: 'LOGISTIC › DRIVER › RIWAYAT', desc: 'Melihat input miliknya sendiri (LEADER, SPV, ADMIN, MANAGER melihat semua driver)' },
  { key: 'database_driver', label: 'LOGISTIC › ARMADA', desc: 'Tabel seluruh data + ringkasan' },
  { key: 'loading_dock', label: 'LOADING DOCK', desc: 'Upload bukti loading (internal & eksternal) + riwayat upload' },
  { key: 'master_data', label: 'MASTER DATA', desc: 'Kelola driver, mobil & harga BBM' },
];

export const DRIVER_PRESET = { operasional_driver: true, riwayat_saya: true };

/** Jenis user (selain owner). */
export const USER_TYPES = ['DRIVER', 'LEADER', 'SPV', 'ADMIN', 'MANAGER'];

/** Jenis user yang boleh melihat RIWAYAT seluruh driver (owner selalu boleh). */
/** Jenis user yang boleh mengunggah / mengganti foto sisa bar bensin di RIWAYAT (owner selalu boleh). Berlaku untuk semua pengiriman di riwayat. */
export const SISA_BBM_TYPES = ['DRIVER', 'LEADER', 'SPV', 'ADMIN'];

/** (tidak lagi dipakai untuk akses: kini RIWAYAT terbuka untuk semua user aktif) */
export const HISTORY_ALL_TYPES = ['LEADER', 'SPV', 'ADMIN', 'MANAGER'];

/** Paket akses cepat per jenis user (owner tetap bisa menyesuaikan satu per satu). */
export const TYPE_PRESET = {
  DRIVER: { operasional_driver: true, riwayat_saya: true },
  LEADER: { operasional_driver: true, riwayat_saya: true },
  SPV: { operasional_driver: true, riwayat_saya: true, biaya_logistic: true, database_driver: true },
  ADMIN: { operasional_driver: true, riwayat_saya: true, biaya_logistic: true, database_driver: true, master_data: true },
  MANAGER: { riwayat_saya: true, biaya_logistic: true, database_driver: true },
};

/** Cari data driver yang namanya sama dengan nama user (otomatis, tanpa dropdown). */
export function matchDriver(user, drivers, users) {
  const n = String(user.nama || '').trim().toLowerCase();
  if (!n) return null;
  const taken = new Set(users.filter((x) => x.id !== user.id && x.driver_id).map((x) => x.driver_id));
  return drivers.find((d) => !taken.has(d.id) && [d.nama, d.nama_lengkap].some((v) => String(v || '').trim().toLowerCase() === n)) || null;
}

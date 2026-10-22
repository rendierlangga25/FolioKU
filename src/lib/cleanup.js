// BERSIHKAN DATABASE (khusus developer) — rencana & eksekusi pembersihan data lama.
// Urutan aman: 1) hapus file foto (batal total bila ada yang gagal) → 2) ubah/hapus baris data → 3) catat log.
export const MIN_KEEP_DAYS = 30;   // data 30 hari terakhir tidak boleh dibersihkan

export const KINDS = {
  foto_pengiriman: { label: 'Foto pengiriman lama (data tetap)', hint: 'Hapus hanya foto KM, serah terima, surat jalan, kendala & sisa bar bensin. Angka & data pengiriman tetap ada di tabel dan laporan.', table: 'trips' },
  pengiriman: { label: 'Pengiriman lama (data + foto)', hint: 'Hapus baris pengiriman beserta semua fotonya. Tidak bisa dikembalikan — unduh backup dulu.', table: 'trips' },
  dock: { label: 'Upload Loading Dock lama (data + foto)', hint: 'Hapus upload loading dock internal & eksternal beserta fotonya. Tidak bisa dikembalikan — unduh backup dulu.', table: 'dock_uploads' },
};

export const TRIP_PHOTO_SCALAR = ['foto_path', 'foto_km_isi', 'foto_km_akhir', 'foto_sisa_bbm'];
export const TRIP_PHOTO_ARRAY = ['foto_serah_terima', 'foto_surat_jalan', 'foto_kendala'];

export const tripPaths = (t) => [...TRIP_PHOTO_SCALAR.map((k) => t[k]), ...TRIP_PHOTO_ARRAY.flatMap((k) => t[k] || [])].filter(Boolean);
export const dockPaths = (r) => [...(r.foto_loading || []), ...(r.foto_sj || [])].filter(Boolean);
/** Hanya path storage sungguhan (bukan data-URL mode demo) yang dihapus lewat storage API. */
const isStorage = (p) => typeof p === 'string' && !/^(data:|blob:|https?:)/.test(p);

const iso = (d) => d.toISOString().slice(0, 10);
export const addDays = (isoDate, n) => { const d = new Date(`${isoDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
/** Tanggal paling baru yang boleh dipakai sebagai batas ("sebelum tanggal ini"). */
export const maxCutoff = (today) => addDays(today, -MIN_KEEP_DAYS);
export const monthsAgo = (today, n) => { const d = new Date(`${today}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - n, 1); return iso(d); };

export function validateCutoff(before, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(before || '')) return 'Pilih tanggal batas dulu.';
  if (before > maxCutoff(today)) return `Data ${MIN_KEEP_DAYS} hari terakhir tidak boleh dibersihkan (batas terbaru: ${maxCutoff(today)}).`;
  return '';
}

/** Hitung apa yang akan dibersihkan. rows = baris tabel (sudah difilter tanggal < before). */
export function buildPlan(kind, before, rows) {
  const isDock = KINDS[kind].table === 'dock_uploads';
  const per = rows.map((r) => ({ r, paths: (isDock ? dockPaths(r) : tripPaths(r)) }));
  const picked = kind === 'foto_pengiriman' ? per.filter((x) => x.paths.length) : per;
  const paths = [...new Set(picked.flatMap((x) => x.paths))];
  const dates = picked.map((x) => x.r.tanggal).sort();
  return { kind, before, ids: picked.map((x) => x.r.id), rows: picked.length, photos: paths.length, paths, oldest: dates[0] || null, newest: dates[dates.length - 1] || null };
}

export const CONFIRM_WORD = 'BERSIHKAN';

/**
 * Jalankan. api harus punya: deletePhotos(paths) → {failed:[]}, cleanupApply(kind, ids), logCleanup(entry).
 * Bila ada foto gagal dihapus → berhenti SEBELUM data diubah (tidak ada yang setengah jalan).
 */
export async function runCleanup(api, plan, { onProgress = () => {}, by = '' } = {}) {
  const storagePaths = plan.paths.filter(isStorage);
  onProgress({ step: 'files', done: 0, total: storagePaths.length });
  const res = storagePaths.length ? await api.deletePhotos(storagePaths, (done) => onProgress({ step: 'files', done, total: storagePaths.length })) : { failed: [] };
  if (res.failed.length) throw new Error(`${res.failed.length} foto gagal dihapus dari penyimpanan — data belum diubah. Coba lagi.`);
  onProgress({ step: 'rows', done: 0, total: plan.rows });
  await api.cleanupApply(plan.kind, plan.ids, (done) => onProgress({ step: 'rows', done, total: plan.rows }));
  try { await api.logCleanup({ kind: plan.kind, before_date: plan.before, rows: plan.rows, photos: plan.photos, by_name: by }); } catch { /* log opsional */ }
  return { rows: plan.rows, photos: plan.photos };
}

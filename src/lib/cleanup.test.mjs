import assert from 'node:assert/strict';
import { addDays, buildPlan, maxCutoff, monthsAgo, runCleanup, tripPaths, validateCutoff } from './cleanup.js';

const trips = [
  { id: 't1', tanggal: '2025-01-05', foto_path: 'u/a.jpg', foto_km_isi: 'u/b.jpg', foto_km_akhir: null, foto_serah_terima: ['u/c.jpg'], foto_surat_jalan: [], foto_kendala: [], foto_sisa_bbm: 'u/d.jpg' },
  { id: 't2', tanggal: '2025-02-01', foto_path: null, foto_serah_terima: [], foto_surat_jalan: [], foto_kendala: [] },
  { id: 't3', tanggal: '2025-03-01', foto_path: 'u/a.jpg', foto_serah_terima: [], foto_surat_jalan: ['u/e.jpg'], foto_kendala: [] },
];
assert.equal(tripPaths(trips[0]).length, 4);
let p = buildPlan('foto_pengiriman', '2025-06-01', trips);
assert.deepEqual([p.rows, p.photos, p.oldest, p.newest], [2, 5, '2025-01-05', '2025-03-01'], 'baris tanpa foto dilewati, path kembar dihitung sekali');
p = buildPlan('pengiriman', '2025-06-01', trips);
assert.equal(p.rows, 3);
const dock = [{ id: 'k1', tanggal: '2025-01-02', foto_loading: ['u/x.jpg'], foto_sj: ['u/y.jpg'] }];
assert.equal(buildPlan('dock', '2025-06-01', dock).photos, 2);

assert.equal(addDays('2026-03-01', -1), '2026-02-28');
assert.equal(maxCutoff('2026-10-22'), '2026-09-22');
assert.equal(monthsAgo('2026-10-22', 12), '2025-10-01');
assert.match(validateCutoff('2026-10-01', '2026-10-22'), /30 hari/);
assert.equal(validateCutoff('2026-09-01', '2026-10-22'), '');
assert.ok(validateCutoff('', '2026-10-22'));

// urutan aman: file dulu, data setelahnya; gagal hapus file → data tidak disentuh
const calls = [];
const okApi = { deletePhotos: async (ps) => { calls.push(['files', ps.length]); return { failed: [] }; }, cleanupApply: async (k, ids) => { calls.push(['rows', ids.length]); }, logCleanup: async (e) => { calls.push(['log', e.rows]); } };
await runCleanup(okApi, buildPlan('pengiriman', '2025-06-01', trips));
assert.deepEqual(calls, [['files', 5], ['rows', 3], ['log', 3]]);
const bad = { ...okApi, deletePhotos: async () => ({ failed: ['u/a.jpg'] }), cleanupApply: async () => { throw new Error('tidak boleh dipanggil'); } };
await assert.rejects(runCleanup(bad, buildPlan('pengiriman', '2025-06-01', trips)), /belum diubah/);
// foto data-URL (mode demo) tidak dikirim ke storage API
const demo = [{ id: 'd1', tanggal: '2025-01-01', foto_path: 'data:image/jpeg;base64,AAA', foto_serah_terima: [], foto_surat_jalan: [], foto_kendala: [] }];
const c2 = []; await runCleanup({ deletePhotos: async (ps) => { c2.push(ps.length); return { failed: [] }; }, cleanupApply: async () => {}, logCleanup: async () => {} }, buildPlan('pengiriman', '2025-06-01', demo));
assert.deepEqual(c2, [], 'tanpa path storage → tidak memanggil deletePhotos');
console.log('cleanup OK');

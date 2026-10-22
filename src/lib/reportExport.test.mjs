// Tes REPORT LOGISTIC: periode, baris ekspor, workbook Excel (dibaca ulang), rencana & ZIP foto (dibaca ulang).
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { CATEGORIES, dockFoot, dockRows, dockTotalLabel, filterDock, filterTrips, inPeriod, periodOf, performa, rekapBiaya, tripFoot, tripRows } from './reportData.js';
import { buildBackupZip, buildReportWorkbook } from './exportReports.js';
import { MB, planDockPhotos, planTripPhotos, runPhotoZip, sanitize, summarizePlan } from './photoZip.js';

const driver = { d1: { nama: 'CEPI' }, d2: { nama: 'RANTA' }, d3: { nama: 'ARIF' } };
const vehicle = { v1: { plat: 'B 9075 PCR', nama: 'DUTRO' }, v2: { plat: 'B 1996 PZQ', nama: 'SUZUKI CARRY' } };
const maps = { driver, vehicle, userName: (id) => (id === 'u1' ? 'Driver Demo' : '') };
const T = (o) => ({ id: 'aaaaaa11-0000-0000-0000-000000000001', tanggal: '2026-10-05', vehicle_id: 'v1', driver1_id: 'd1', driver2_id: null, tujuan: ['ADM SUNTER'], bbm_rp: 68000, harga_liter: 6800,
  tol_rp: 10000, parkir_rp: 0, parkir_cash_rp: 0, kuli_bongkar_rp: 5000, security_rp: 0, km_awal: 1000, km_isi: 1005, km_akhir: 1100, kartu4: '1234', created_by: 'u1', created_at: '2026-10-05T03:00:00Z',
  foto_path: 'u1/a.jpg', foto_km_isi: 'u1/b.jpg', foto_km_akhir: 'u1/c.jpg', foto_sisa_bbm: null, foto_serah_terima: ['u1/s1.jpg', 'u1/s2.jpg'], foto_surat_jalan: ['u1/sj.jpg'], foto_kendala: [], ...o });
const trips = [
  T({}),                                                                                                                        // 100 km / 10 L, total 83.000
  T({ id: 'bbbbbb22-0000-0000-0000-000000000002', tanggal: '2026-10-20', driver2_id: 'd2', tujuan: ['JKM ROXY', 'MAP SUDIRMAN', 'GUDANG CAKUNG'], vehicle_id: 'v2', bbm_rp: 20000, harga_liter: 10000, km_awal: 0, km_isi: 5, km_akhir: 30, tol_rp: 0, kuli_bongkar_rp: 0, kendala_ket: 'Ban bocor', foto_kendala: ['u1/k.jpg'] }), // 30 km / 2 L
  T({ id: 'cccccc33-0000-0000-0000-000000000003', tanggal: '2026-09-15', driver1_id: 'd3' }),                                     // September
];

// ── periode & filter
assert.deepEqual(periodOf({ type: 'bulanan', month: '2026-10' }), { from: '2026-10-01', to: '2026-10-31', label: 'Oktober 2026', slug: '2026-10' });
assert.deepEqual(periodOf({ type: 'tahunan', year: 2026 }), { from: '2026-01-01', to: '2026-12-31', label: 'Tahun 2026', slug: '2026' });
assert.equal(periodOf({ type: 'semua' }).from, null);
assert.match(periodOf({ type: 'rentang', range: { from: '2026-10-05', to: '2026-10-10' } }).slug, /2026-10-05_sd_2026-10-10/);
assert.equal(inPeriod('2026-10-31', periodOf({ type: 'bulanan', month: '2026-10' })), true); assert.equal(inPeriod('2026-11-01', periodOf({ type: 'bulanan', month: '2026-10' })), false);
assert.equal(inPeriod('1999-01-01', periodOf({ type: 'semua' })), true);
assert.equal(filterTrips(trips, { vehicle: 'v2' }).length, 1); assert.equal(filterTrips(trips, { driver: 'd2' }).length, 1); assert.equal(filterTrips(trips, {}).length, 3);
assert.equal(filterTrips(trips, { vehicle: 'v1', driver: 'd2' }).length, 0);
assert.equal(filterDock([{ plat: 'b 1 x' }, { plat: '' }], { plat: 'B 1 X' }).length, 1);
assert.ok(CATEGORIES.every((c) => c.id && c.label && c.file) && new Set(CATEGORIES.map((c) => c.id)).size === CATEGORIES.length);
assert.deepEqual(CATEGORIES.find((c) => c.id === 'backup'), { id: 'backup', label: 'Backup Seluruh Data', hint: 'ZIP · Excel lengkap + JSON semua tabel (tanpa foto)', vehicle: false, driver: false, date: false, file: 'zip' });

// ── baris pengiriman: rumus sama dengan aplikasi
const rows = tripRows(trips, maps);
assert.equal(rows[0].jarak, 100); assert.equal(rows[0].liter, 10); assert.equal(rows[0].kml, 10); assert.equal(rows[0].total, 83000); assert.equal(rows[0].foto, 6);
assert.equal(rows[1].ritase, 3); assert.equal(rows[1].driver2, 'RANTA'); assert.equal(rows[1].kendala, 'Ban bocor'); assert.equal(rows[1].input_oleh, 'Driver Demo');
assert.equal(tripFoot(trips.slice(0, 2)).kml, round2(130 / 12));
function round2(n) { return Math.round(n * 100) / 100; }

// ── rekap
const rk = rekapBiaya(trips.slice(0, 2), maps);
assert.equal(rk.armada.length, 2); assert.equal(rk.armada.reduce((a, r) => a + r.total, 0), 83000 + 20000);
assert.equal(rk.driver.reduce((a, r) => a + r.total, 0), 103000);                                                              // biaya berdua dibagi → total tetap
assert.equal(rk.driver.find((d) => d.driver === 'CEPI').ritase, 4); assert.equal(rk.driver.find((d) => d.driver === 'RANTA').ritase, 3);
assert.equal(rekapBiaya(trips, maps).bulan.map((b) => b.bulan).join(), 'September 2026,Oktober 2026');                            // urut kronologis
assert.ok(Math.abs(rk.komponen.reduce((a, k) => a + k.persen, 0) - 1) < 1e-9);
const pf = performa(trips.slice(0, 2), maps);
assert.equal(pf.driver.find((d) => d.driver === 'RANTA').jarak, 30);                                                            // jarak PENUH (basis tab PERFORMA)
assert.equal(pf.driver.find((d) => d.driver === 'RANTA').kendala, 1);

// ── workbook Excel dibaca ulang
async function reread(wb) { const w = new ExcelJS.Workbook(); await w.xlsx.load(await wb.xlsx.writeBuffer()); return w; }
const info = ['Periode: Oktober 2026'];
let wb = await reread(buildReportWorkbook(ExcelJS, 'pengiriman', { trips: trips.slice(0, 2), maps, info }));
let ws = wb.getWorksheet('Pengiriman');
assert.ok(ws && ws.getCell(1, 1).value === 'DATA PENGIRIMAN');
const hr = 3 + info.length + 1;                                                                                                    // info + catatan total bea
const headers = ws.getRow(hr).values.slice(1);
assert.equal(headers[0], 'TANGGAL'); assert.ok(headers.includes('TOTAL BEA') && headers.includes('KM/L') && headers.includes('SECURITY'));
const iTotal = headers.indexOf('TOTAL BEA') + 1;
assert.equal(ws.getCell(hr + 1, iTotal).value, 83000); assert.ok(ws.getCell(hr + 1, 1).value instanceof Date);
const foot = ws.getCell(hr + 3, iTotal).value; assert.match(foot.formula, /^SUM\(/); assert.equal(foot.result, 103000);       // baris TOTAL berumus SUM
assert.equal(ws.autoFilter != null, true);
assert.deepEqual((await reread(buildReportWorkbook(ExcelJS, 'biaya', { trips, maps, info }))).worksheets.map((s) => s.name), ['Rekap Armada', 'Rekap Driver', 'Rekap Bulanan', 'Komponen Biaya']);
assert.deepEqual((await reread(buildReportWorkbook(ExcelJS, 'performa', { trips, maps, info }))).worksheets.map((s) => s.name), ['Performa Driver', 'Performa Armada']);
const dock = [
  { id: 'dd1', jenis: 'internal', kategori: 'reguler', tanggal: '2026-10-18', no_so: '132105654, 515131556320', perusahaan: 'PT AWSP, PT JKM', plat: 'B 9075 PCR', items: [{ so: '132105654', perusahaan: 'PT AWSP' }, { so: '515131556320', perusahaan: 'PT JKM' }], foto_loading: ['l1'], foto_sj: [], created_by: 'u1', created_at: '2026-10-18T04:20:00Z' },
  { id: 'dd2', jenis: 'eksternal', kategori: '', expedisi: 'CARGO X', tanggal: '2026-10-19', no_so: 'SO9', perusahaan: 'PT Z', plat: '', items: [{ so: 'SO9', perusahaan: 'PT Z' }], foto_loading: ['a', 'b'], foto_sj: ['c'], created_by: 'u1', created_at: '2026-10-19T02:00:00Z' },
  { id: 'dd3', jenis: 'internal', kategori: 'retur', tanggal: '2026-10-20', no_so: 'LAMA1', perusahaan: 'PT LAMA', plat: 'B 1 X', foto_loading: [], foto_sj: [], created_by: 'u1', created_at: '2026-10-20T02:00:00Z' },   // data lama tanpa rincian SO
];
// satu baris per SO; data upload lain diulang di tiap baris
const dr = dockRows(dock, maps.userName);
assert.equal(dr.length, 4);
assert.deepEqual(dr.slice(0, 2).map((r) => [r.no_so, r.perusahaan]), [['132105654', 'PT AWSP'], ['515131556320', 'PT JKM']]);
for (const k of ['tanggal', 'jenis', 'kategori', 'plat', 'expedisi', 'foto_loading', 'foto_sj', 'input_oleh', 'waktu_input']) assert.equal(dr[0][k], dr[1][k], `kolom ${k} harus diulang di baris SO ke-2`);
assert.equal(dr[0].jenis, 'INTERNAL'); assert.equal(dr[0].kategori, 'REGULER'); assert.equal(dr[0].input_oleh, 'Driver Demo');
assert.equal(dr[3].no_so, 'LAMA1'); assert.equal(dr[3].perusahaan, 'PT LAMA');                                                       // fallback data lama: satu baris
assert.deepEqual(dockFoot(dock), { foto_loading: 3, foto_sj: 1 });                                                                // dihitung per upload, bukan per baris (bukan 4 & 1)
assert.equal(dockTotalLabel(dock, dr), 'TOTAL (3 upload · 4 SO)');
wb = await reread(buildReportWorkbook(ExcelJS, 'dock', { docks: dock, maps, info }));
ws = wb.getWorksheet('Loading Dock');
const dh = 3 + info.length + 1;                                                                                                    // judul + (info + catatan) → header
assert.deepEqual(ws.getRow(dh).values.slice(1, 8), ['TANGGAL', 'JENIS', 'KATEGORI', 'NO SO', 'PERUSAHAAN', 'EXPEDISI', 'NO PLAT']);
assert.ok(!ws.getRow(dh).values.includes('DETAIL SO → PERUSAHAAN'));                                                              // kolom penumpuk dihapus
assert.equal(ws.getCell(dh + 1, 4).value, '132105654'); assert.equal(ws.getCell(dh + 2, 4).value, '515131556320');               // SO di baris terpisah
assert.equal(ws.getCell(dh + 1, 1).value.getTime(), ws.getCell(dh + 2, 1).value.getTime());                                      // tanggal sama di kedua baris
assert.equal(ws.getCell(dh + 1, 2).value, 'INTERNAL'); assert.equal(ws.getCell(dh + 2, 2).value, 'INTERNAL'); assert.equal(ws.getCell(dh + 2, 3).value, 'REGULER');
assert.equal(ws.getCell(dh + 4 + 1, 1).value, 'TOTAL (3 upload · 4 SO)');
assert.equal(ws.getCell(dh + 5, 8).value, 3); assert.equal(ws.getCell(dh + 5, 9).value, 1);                                       // total foto per upload
assert.equal(ws.getCell(dh + 3, 7).value, '');                                                                                    // eksternal tanpa plat tetap kosong
const master = { drivers: [{ nama: 'CEPI', aktif: true }], vehicles: [{ nama: 'DUTRO', plat: 'B 1', bbm_jenis: 'Solar', aktif: false }], fuel: [{ jenis: 'Solar', harga: 6800 }], destinations: [], dockOptions: [] };
wb = await reread(buildReportWorkbook(ExcelJS, 'master', { master, maps, info }));
assert.equal(wb.worksheets.length, 5); assert.equal(wb.getWorksheet('Kendaraan').getCell(5, 4).value, 'TIDAK');
assert.throws(() => buildReportWorkbook(ExcelJS, 'xx', { maps }), /tidak dikenal/);
assert.equal(buildReportWorkbook(ExcelJS, 'pengiriman', { trips: [], maps, info }).getWorksheet('Pengiriman').rowCount >= 4, true);  // data kosong tidak error

// ── backup ZIP
const bz = await JSZip.loadAsync(await (await buildBackupZip({ JSZip, ExcelJS }, {
  tables: { trips, drivers: master.drivers, dock_uploads: dock, profiles: null }, trips, docks: dock, master: { ...master, profiles: [{ nama: 'Owner', email: 'o@x', role: 'owner', active: true }] }, maps, info, stamp: '18 Okt 2026 10:00 WIB', skipped: ['profiles'] })).arrayBuffer());
assert.deepEqual(Object.keys(bz.files).filter((f) => !f.endsWith('/')).sort(), ['BACA-DULU.txt', 'excel/RAXER-DATA-LENGKAP.xlsx', 'json/drivers.json', 'json/dock_uploads.json', 'json/trips.json'].sort());
assert.equal(JSON.parse(await bz.file('json/trips.json').async('string')).length, 3);                                              // semua baris, tanpa pemotongan
assert.match(await bz.file('BACA-DULU.txt').async('string'), /dilewati.*profiles/);
const bwb = await reread({ xlsx: { writeBuffer: () => bz.file('excel/RAXER-DATA-LENGKAP.xlsx').async('nodebuffer') } });
assert.equal(bwb.worksheets.length, 8);

// ── foto: nama aman
assert.equal(sanitize('PT A/B: "X"?*'), 'PT A B X'); assert.equal(sanitize('  ...hidden. '), 'hidden'); assert.equal(sanitize(''), 'TANPA NAMA'); assert.equal(sanitize('x'.repeat(200)).length, 80);
// ── rencana foto
const plan = planTripPhotos(trips.slice(0, 2), maps);
assert.equal(plan.length, 6 + 7);                                                                                                  // trip1: 3 km + 2 serah + 1 SJ ; trip2 sama + kendala (fotonya: a,b,c, s1,s2, sj + k)
const p0 = plan[0];
assert.equal(p0.dir, 'PENGIRIMAN/2026/10 OKTOBER/B 9075 PCR - DUTRO/2026-10-05 - CEPI - ADM SUNTER (aaaaaa)'); assert.equal(p0.name, '1 KM AWAL');
assert.ok(plan.some((p) => p.name === '5 SERAH TERIMA 2') && plan.some((p) => p.name === '7 KENDALA 1'));
assert.ok(plan.some((p) => p.dir.includes('CEPI & RANTA - JKM ROXY, MAP SUDIRMAN dst')));                                         // tujuan >2 dipersingkat
const dplan = planDockPhotos([{ ...dock[0], foto_sj: ['s1'] }, { id: 'ee2', jenis: 'eksternal', expedisi: 'Cargo X', tanggal: '2026-09-02', perusahaan: 'PT Z', foto_loading: ['x'], foto_sj: ['y'] }]);
assert.equal(dplan.length, 4); assert.ok(dplan[0].dir.startsWith('LOADING DOCK/2026/10 OKTOBER/INTERNAL - REGULER/')); assert.ok(dplan[2].dir.startsWith('LOADING DOCK/2026/09 SEPTEMBER/EKSTERNAL - CARGO X/'));
assert.deepEqual(summarizePlan(plan), { files: 13, folders: 2 });

// ── ZIP foto: struktur, pecah bagian, kegagalan, batal
const jpg = (n) => new Blob([new Uint8Array(n)], { type: 'image/jpeg' });
const saved = [];
let r = await runPhotoZip({ entries: plan, JSZip, baseName: 'RAXER FOTO 2026-10', save: async (b, n) => saved.push({ b, n }), fetchBlob: async () => jpg(2000), onProgress: () => {} });
assert.equal(r.ok, 13); assert.equal(r.parts, 1); assert.equal(saved[0].n, 'RAXER FOTO 2026-10.zip');                           // satu bagian → tanpa "bagian"
let z = await JSZip.loadAsync(await saved[0].b.arrayBuffer());
const names = Object.keys(z.files).filter((f) => !f.endsWith('/'));
assert.ok(names.includes('PENGIRIMAN/2026/10 OKTOBER/B 9075 PCR - DUTRO/2026-10-05 - CEPI - ADM SUNTER (aaaaaa)/1 KM AWAL.jpg'));
assert.ok(names.includes('_DAFTAR FOTO.csv')); assert.equal(names.filter((n) => n.endsWith('.jpg')).length, 13);
assert.match(await z.file('_DAFTAR FOTO.csv').async('string'), /ADM SUNTER[\s\S]*2/);
// pecah bagian + kegagalan dicatat, sisanya tetap terunduh
saved.length = 0;
let calls = 0;
r = await runPhotoZip({ entries: plan, JSZip, baseName: 'F', partBytes: 6000, concurrency: 2, retries: 1, save: async (b, n) => saved.push({ b, n }),
  fetchBlob: async (src) => { calls++; if (src === 'u1/b.jpg') throw new Error('404'); return jpg(2000); } });
assert.equal(r.failed.length, 2); assert.equal(r.ok, 11); assert.ok(r.parts >= 2); assert.deepEqual(saved.map((s) => s.n), saved.map((_, i) => `F - bagian ${i + 1}.zip`));
const allNames = []; for (const s of saved) { const zz = await JSZip.loadAsync(await s.b.arrayBuffer()); allNames.push(...Object.keys(zz.files).filter((f) => f.endsWith('.jpg'))); }
assert.equal(allNames.length, 11); assert.equal(new Set(allNames).size, 11);                                                          // tidak ada foto hilang / dobel
const lastZ = await JSZip.loadAsync(await saved.at(-1).b.arrayBuffer()); const firstZ = await JSZip.loadAsync(await saved[0].b.arrayBuffer());
assert.ok(firstZ.file('_GAGAL.txt') || lastZ.file('_GAGAL.txt'));
assert.ok(calls > 13);                                                                                                              // ada percobaan ulang
// batal di tengah jalan
const ac = new AbortController(); saved.length = 0;
r = await runPhotoZip({ entries: plan, JSZip, baseName: 'F', concurrency: 1, signal: ac.signal, save: async (b, n) => saved.push(n), fetchBlob: async () => { ac.abort(); return jpg(10); } });
assert.equal(r.aborted, true); assert.equal(saved.length, 0);
// nama file kembar dalam satu folder → diberi nomor
const dup = [{ src: 'a', dir: 'D', name: 'X', meta: {} }, { src: 'b', dir: 'D', name: 'X', meta: {} }]; saved.length = 0;
r = await runPhotoZip({ entries: dup, JSZip, baseName: 'D', save: async (b) => saved.push(b), fetchBlob: async () => jpg(5) });
assert.deepEqual(Object.keys((await JSZip.loadAsync(await saved[0].arrayBuffer())).files).filter((f) => f.startsWith('D/') && !f.endsWith('/')).sort(), ['D/X (2).jpg', 'D/X.jpg']);
assert.equal(MB, 1048576);
console.log('reportExport OK');

import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { buildWorkbook } from './exportXlsx.js';
import { normalizePrefs, visibleCols } from './tableCols.js';

const master = { vehicle: { v1: { plat: 'B 9075 PCR' } } };
const dn = (id) => ({ d1: 'CEPI', d2: 'RANTA' }[id] || '');
const trips = [
  { tanggal: '2026-10-01', vehicle_id: 'v1', driver1_id: 'd1', driver2_id: 'd2', tujuan: ['ADM SUNTER', 'DEPO'], km_awal: 100, km_isi: 105, km_akhir: 200, bbm_rp: 68000, harga_liter: 6800, tol_rp: 10000, parkir_rp: 0, parkir_cash_rp: 0, kuli_bongkar_rp: 20000, security_rp: 5000, kartu4: '0447' },
  { tanggal: '2026-10-02', vehicle_id: 'v1', driver1_id: 'd1', driver2_id: null, tujuan: ['SUNTER'], km_awal: 200, km_isi: 205, km_akhir: 260, bbm_rp: 34000, harga_liter: 6800, kartu4: '0447' },
];
async function run(prefsIn) {
  const prefs = normalizePrefs(prefsIn);
  const wb = buildWorkbook(ExcelJS, { title: 'ARMADA', info: ['Periode: x'], cols: visibleCols(prefs), rows: trips, dn, master, prefs });
  const buf = await wb.xlsx.writeBuffer();
  const rd = new ExcelJS.Workbook(); await rd.xlsx.load(buf);
  return { ws: rd.getWorksheet('Data'), prefs };
}
// default: semua kolom, urutan sesuai tabel
let { ws } = await run(null);
const header = ws.getRow(3 + 1).values.slice(1);
assert.deepEqual(header.slice(0, 5), ['TANGGAL', 'DRIVER 1', 'DRIVER 2', 'NO PLAT', 'TUJUAN']);
assert.equal(header.at(-1), 'NO KARTU');
assert.equal(header.indexOf('TOTAL BEA') > header.indexOf('SECURITY'), true);
const r1 = ws.getRow(5).values.slice(1);
assert.equal(r1[header.indexOf('TOTAL BEA')], 68000 + 10000 + 20000 + 5000);
assert.equal(r1[header.indexOf('RITASE')], 2);
assert.equal(r1[header.indexOf('NO KARTU')], '0447');
const tot = ws.getRow(7).values.slice(1);
assert.equal(tot[0], 'TOTAL (2 data)');
assert.equal(tot[header.indexOf('RITASE')].result, 3);
// kolom di-hide: tidak ada di Excel, TOTAL BEA menyesuaikan
({ ws } = await run({ hidden: ['kuli', 'security', 'tol', 'driver2', 'kartu'] }));
const h2 = ws.getRow(4).values.slice(1);
for (const x of ['KULI BONGKAR', 'SECURITY', 'TOLL', 'DRIVER 2', 'NO KARTU']) assert.ok(!h2.includes(x), x);
assert.equal(ws.getRow(5).values.slice(1)[h2.indexOf('TOTAL BEA')], 68000);
assert.equal(ws.getRow(7).values.slice(1)[h2.indexOf('TOTAL BEA')].result, 68000 + 34000);
console.log('exportXlsx OK');

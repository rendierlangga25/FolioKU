import assert from 'node:assert/strict';
import { normalizePrefs, visibleCols, totalOf, DEFAULT_ORDER, summarizeBea, visibleCostCols } from './tableCols.js';
const t = { bbm_rp: 100000, tol_rp: 20000, parkir_rp: 5000, parkir_cash_rp: 3000, kuli_bongkar_rp: 50000, security_rp: 10000 };
const p0 = normalizePrefs(null);
assert.deepEqual(visibleCols(p0), DEFAULT_ORDER);
assert.equal(totalOf(t, p0), 188000);
const p1 = normalizePrefs({ order: ['kartu', 'tanggal', 'zzz'], hidden: ['kuli', 'security'] });
assert.equal(p1.order[0], 'kartu'); assert.equal(p1.order.length, DEFAULT_ORDER.length); assert.ok(!p1.order.includes('zzz'));
assert.equal(totalOf(t, p1), 128000);                       // kuli+security di-hide → total menyesuaikan
assert.equal(totalOf(t, { ...p1, totalMode: 'all' }), 188000); // mode tetap

// ── Ringkasan BIAYA LOGISTIC ──
const base = { harga_liter: 6800, km_awal: 1000, tujuan: ['A', 'B'], tol_rp: 0, parkir_rp: 0, parkir_cash_rp: 0, kuli_bongkar_rp: 0, security_rp: 0 };
const trips = [
  { ...base, vehicle_id: 'V1', driver1_id: 'x', driver2_id: 'y', km_akhir: 1142, bbm_rp: 180000, kuli_bongkar_rp: 40000 },   // berdua, 2 tujuan
  { ...base, vehicle_id: 'V1', driver1_id: 'x', driver2_id: null, km_akhir: 1146, bbm_rp: 180000, tujuan: ['C'] },          // sendiri, 1 tujuan
  { ...base, vehicle_id: 'V2', driver1_id: 'y', driver2_id: null, km_akhir: 1100, bbm_rp: 68000, security_rp: 10000 },
];
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≉ ${b}`);
const P = normalizePrefs(null);
const byPlat = Object.fromEntries(summarizeBea(trips, 'plat', P).map((r) => [r.id, r]));
assert.equal(byPlat.V1.kirim, 2); assert.equal(byPlat.V1.ritase, 3); near(byPlat.V1.jarak, 288);
assert.equal(byPlat.V1.total, 180000 + 40000 + 180000); assert.equal(byPlat.V1.costs.kuli_bongkar_rp, 40000);
near(byPlat.V1.kmL, 288 / (360000 / 6800));
const byDrv = Object.fromEntries(summarizeBea(trips, 'driver', P).map((r) => [r.id, r]));
near(byDrv.x.jarak, 142 / 2 + 146); near(byDrv.y.jarak, 142 / 2 + 100);
near(byDrv.x.total, 220000 / 2 + 180000);                               // biaya dibagi 2 untuk perjalanan berdua
near(byDrv.x.total + byDrv.y.total, byPlat.V1.total + byPlat.V2.total);   // total semua driver = total semua plat
near(byDrv.x.kmL, (142 / 2 + 146) / (2 * (180000 / 6800)));             // KM/L driver: bagian jarak ÷ liter utuh
assert.equal(byDrv.x.ritase, 3);                                         // ritase tidak dibagi
// kolom nominal di-hide → ringkasan ikut (Total Bea menyesuaikan)
const Ph = normalizePrefs({ hidden: ['kuli'] });
assert.ok(!visibleCostCols(Ph).includes('kuli')); assert.ok(visibleCostCols(P).includes('kuli'));
assert.equal(summarizeBea(trips, 'plat', Ph).find((r) => r.id === 'V1').total, 360000);
console.log('tableCols OK');

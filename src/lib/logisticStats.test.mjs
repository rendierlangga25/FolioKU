import assert from 'node:assert/strict';
import { kpi, composition, trend, byVehicle, byDriver, topDestinations } from './logisticStats.js';
const T = [
  { id: 1, tanggal: '2026-10-01', vehicle_id: 'A', driver1_id: 'X', driver2_id: 'Y', tujuan: ['SUNTER', 'DEPO'], km_awal: 100, km_akhir: 200, bbm_rp: 68000, harga_liter: 6800, tol_rp: 10000, parkir_rp: 0, parkir_cash_rp: 5000, kuli_bongkar_rp: 20000, security_rp: 0 },
  { id: 2, tanggal: '2026-10-03', vehicle_id: 'A', driver1_id: 'X', driver2_id: null, tujuan: ['SUNTER'], km_awal: 200, km_akhir: 260, bbm_rp: 34000, harga_liter: 6800 },
  { id: 3, tanggal: '2026-10-03', vehicle_id: 'B', driver1_id: 'Y', driver2_id: null, tujuan: ['DEPO'], km_awal: 10, km_akhir: 40, bbm_rp: 20000, harga_liter: 10000, tol_rp: 3000 },
];
const k = kpi(T);
assert.equal(k.trips, 3); assert.equal(k.ritase, 4); assert.equal(k.jarak, 190);
assert.equal(k.total, 68000 + 10000 + 5000 + 20000 + 34000 + 20000 + 3000);
assert.ok(Math.abs(k.liter - (10 + 5 + 2)) < 1e-9);
assert.equal(composition(T).reduce((a, c) => a + c.value, 0), k.total);
assert.ok(Math.abs(composition(T).reduce((a, c) => a + c.pct, 0) - 1) < 1e-9);
const tr = trend(T, { from: '2026-10-01', to: '2026-10-05' });
assert.equal(tr.length, 5); assert.equal(tr[2].trips, 2); assert.equal(tr[1].trips, 0);
const trw = trend(T, { from: '2026-08-01', to: '2026-10-31' }); // > 62 hari → mingguan
assert.ok(trw[0].weekly && trw.length < 20); assert.equal(trw.reduce((a, b) => a + b.trips, 0), 3);
const v = byVehicle(T); assert.equal(v[0].id, 'A'); assert.equal(v[0].jarak, 160);
const d = byDriver(T); assert.equal(d.find((x) => x.id === 'Y').trips, 2);
assert.ok(Math.abs(d.find((x) => x.id === 'X').jarak - (50 + 60)) < 1e-9);
assert.deepEqual(topDestinations(T, 2).map((x) => x.label), ['DEPO', 'SUNTER']);
console.log('logisticStats OK');

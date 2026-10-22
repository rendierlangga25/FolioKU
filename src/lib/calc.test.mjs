// Cek rumus terhadap angka di rekap Excel Agustus 2026 (sheet DUTRO75 & REKAP).
import assert from 'node:assert/strict';
import { jarak, liter, kmPerL, kmPerLDriver, summarizeByDriver, summarizeByVehicle, bbmMatrix, dailyByVehicle } from './calc.js';

const near = (a, b, e = 0.01) => assert.ok(Math.abs(a - b) < e, `${a} ≉ ${b}`);

// Baris 1 DUTRO75: 185559 → 185701 = 142 km, BBM 180.000 solar 6.800 → KM/L 5,3644
const t1 = { tanggal: '2026-08-03', vehicle_id: 'D75', driver1_id: 'CEPI', driver2_id: 'RANTA', tujuan: ['ADM SUNTER'], km_awal: 185559, km_akhir: 185701, bbm_rp: 180000, harga_liter: 6800, tol_rp: 0, parkir_rp: 0 };
assert.equal(jarak(t1), 142);
near(liter(t1), 26.4706, 0.001);
near(kmPerL(t1), 5.36444, 0.0001);

// Satu driver → tidak dibagi
const t3 = { ...t1, tanggal: '2026-08-05', driver2_id: null, km_awal: 185839, km_akhir: 185985 };
assert.equal(jarak(t3), 146);
near(kmPerL(t3), 5.51556, 0.0001);

// KM/L per driver ikut dibagi 2 bila 2 driver (5,3644 → 2,6822); 1 driver tidak dibagi
near(kmPerLDriver(t1), 2.68222, 0.0001);
near(kmPerLDriver(t3), 5.51556, 0.0001);

const trips = [t1, t3];
const byD = Object.fromEntries(summarizeByDriver(trips).map((d) => [d.id, d]));
near(byD.CEPI.jarak, 142 / 2 + 146);      // 217
near(byD.RANTA.jarak, 71);
near(byD.CEPI.bbm, 90000 + 180000);       // 270.000
near(byD.RANTA.bbm, 90000);
near(byD.RANTA.kmL, 2.68222, 0.0001);      // hanya ikut perjalanan berdua → separuh
// CEPI: (71 + 146) km ÷ (26,47 + 26,47) L utuh = 4,0990  (campuran berdua & sendiri)
near(byD.CEPI.kmL, 217 / (2 * 26.470588), 0.0001);

const v = summarizeByVehicle(trips)[0];
assert.equal(v.tujuan, 2);
assert.equal(v.jarak, 288);
assert.equal(v.bbm, 360000);

const mx = bbmMatrix(trips);
near(mx.grand, 360000);                    // total BBM tidak berubah setelah dibagi
near(mx.colTot.get('D75'), 360000);

const day = dailyByVehicle(trips);
assert.equal(day.length, 2);
console.log('calc OK');

// ── Ritase & Total Bea (kolom bisa di-hide) ──
import { ritase, totalBea, totalBiaya, COST_FIELDS } from './calc.js';
const tb = { tujuan: ['A', ' ', 'B', 'C'], bbm_rp: 100000, tol_rp: 20000, parkir_rp: 5000, parkir_cash_rp: 3000, kuli_bongkar_rp: 50000, security_rp: 10000 };
assert.equal(ritase(tb), 3);
assert.equal(totalBiaya(tb), 188000);
assert.equal(totalBea(tb), 188000);
assert.equal(totalBea(tb, COST_FIELDS.filter((f) => f !== 'kuli_bongkar_rp')), 138000); // kuli di-hide
assert.equal(totalBiaya({ bbm_rp: 1000 }), 1000); // data lama tanpa kolom baru
console.log('ritase/totalBea OK');

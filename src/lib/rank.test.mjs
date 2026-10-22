import assert from 'node:assert/strict';
import { xpState, TRIPS_PER_TIER } from './tiers.js';
import { driverYear, tierHistory, leaderboard, effBadges } from './rank.js';

assert.equal(TRIPS_PER_TIER, 20);
assert.deepEqual([xpState(0).tier, xpState(95).tier, xpState(100).tier, xpState(1099).tier, xpState(1100).tier, xpState(5000).tier], [1, 1, 2, 11, 12, 12]);
assert.equal(xpState(45).pct, 45); assert.equal(xpState(45).tripsToNext, 11); assert.equal(xpState(1150).top, true);

const rows = [
  { driver_id: 'a', ym: '2025-12', trips: 30, jarak: 3000, liter: 500 },
  { driver_id: 'a', ym: '2026-01', trips: 4, jarak: 400, liter: 60 },
  { driver_id: 'b', ym: '2026-01', trips: 6, jarak: 600, liter: 80 },
  { driver_id: 'c', ym: '2026-01', trips: 2, jarak: 900, liter: 10 },   // < minimal → tidak diranking
  { driver_id: 'a', ym: '2026-02', trips: 5, jarak: 500, liter: 50 },
  { driver_id: 'b', ym: '2026-02', trips: 5, jarak: 500, liter: 50 },   // seri
];
// tier reset per tahun, riwayat tetap
assert.equal(driverYear(rows, 'a', 2025).xp, 150); assert.equal(driverYear(rows, 'a', 2025).tier, 2);
assert.equal(driverYear(rows, 'a', 2026).xp, 45); assert.equal(driverYear(rows, 'a', 2026).tier, 1);
assert.deepEqual(tierHistory(rows, 'a', 2026).map((y) => y.year), ['2026', '2025']);
// ranking
const lb = leaderboard(rows, '2026-01');
assert.deepEqual(lb.ranked.map((x) => x.driver_id), ['b', 'a']); assert.equal(lb.unranked[0].driver_id, 'c');
assert.deepEqual(leaderboard(rows, '2026-02').ranked.map((x) => x.rank), [1, 1]);
// lencana: bulan berjalan = sementara
assert.deepEqual(effBadges(rows, 'b', '2026-02').map((x) => [x.ym, x.provisional]), [['2026-02', true], ['2026-01', false]]);
assert.deepEqual(effBadges(rows, 'a', '2026-02').map((x) => x.ym), ['2026-02', '2025-12']);
console.log('rank/xp OK');

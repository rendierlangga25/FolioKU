// Peringkat efisiensi, lencana bulanan, dan riwayat tier — semua dihitung dari statistik bulanan per driver.
// Baris statistik: { driver_id, ym: 'YYYY-MM', trips, jarak, liter }   (jarak & liter = penuh, tidak dibagi 2 driver)
import { MIN_TRIPS_RANK, XP_PER_TRIP, xpState } from './tiers.js';

const r2 = (n) => Math.round(n * 100) / 100;

/** Total pengiriman / jarak / liter satu driver pada satu tahun, + XP & tier. */
export function driverYear(rows, driverId, year) {
  const a = { year: String(year), trips: 0, jarak: 0, liter: 0 };
  for (const r of rows) if (r.driver_id === driverId && r.ym.startsWith(String(year))) { a.trips += +r.trips; a.jarak += +r.jarak; a.liter += +r.liter; }
  a.xp = a.trips * XP_PER_TRIP;
  return { ...a, ...xpState(a.xp) };
}

/** Riwayat tier per tahun (terbaru di atas). Tahun berjalan selalu ikut walau belum ada data. */
export function tierHistory(rows, driverId, nowYear) {
  const years = new Set([String(nowYear)]);
  for (const r of rows) if (r.driver_id === driverId) years.add(r.ym.slice(0, 4));
  return [...years].sort().reverse().map((y) => driverYear(rows, driverId, y));
}

/** Peringkat KM/L satu bulan. ranked = memenuhi minimal pengiriman; sisanya unranked. Nilai KM/L sama → peringkat sama. */
export function leaderboard(rows, ym) {
  return rankList(rows.filter((r) => r.ym === ym));
}

/** Peringkat dari daftar { driver_id, trips, jarak, liter } (satu bulan ATAU rentang tanggal bebas). minTrips bawaan = MIN_TRIPS_RANK. */
export function rankList(rows, minTrips = MIN_TRIPS_RANK) {
  const list = rows.map((r) => ({
    driver_id: r.driver_id, trips: +r.trips, jarak: +r.jarak, liter: +r.liter, kmL: +r.liter > 0 ? +r.jarak / +r.liter : 0,
  }));
  const ok = (x) => x.trips >= minTrips && x.liter > 0;
  const ranked = list.filter(ok).sort((a, b) => r2(b.kmL) - r2(a.kmL) || b.trips - a.trips);
  ranked.forEach((x, i) => { x.rank = i > 0 && r2(x.kmL) === r2(ranked[i - 1].kmL) ? ranked[i - 1].rank : i + 1; });
  const unranked = list.filter((x) => !ok(x)).sort((a, b) => b.trips - a.trips);
  return { ranked, unranked };
}

const months = (rows) => [...new Set(rows.map((r) => r.ym))].sort().reverse();

/** Juara efisiensi tiap bulan (bisa lebih dari satu bila seri). Bulan berjalan = sementara. */
export function hallOfFame(rows, nowYm) {
  return months(rows).map((ym) => {
    const winners = leaderboard(rows, ym).ranked.filter((x) => x.rank === 1);
    return { ym, winners, provisional: ym >= nowYm };
  }).filter((m) => m.winners.length);
}

/** Lencana "paling efisien" milik satu driver (bulan ke-1 KM/L). */
export function effBadges(rows, driverId, nowYm) {
  return hallOfFame(rows, nowYm).filter((m) => m.winners.some((w) => w.driver_id === driverId))
    .map((m) => ({ ym: m.ym, kmL: m.winners.find((w) => w.driver_id === driverId).kmL, provisional: m.provisional }));
}

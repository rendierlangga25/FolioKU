// Sistem XP & Tier. Semua angka ada di sini (ubah di satu tempat).
//
//  • Tiap pengiriman selesai  = 5 XP (untuk setiap driver yang ikut di pengiriman itu)
//  • 100 XP                   = naik 1 tier  (5 XP × 20 pengiriman)
//  • Target ritme             = 1 tier per 23 hari  → ±1 pengiriman per hari kerja
//  • 12 tier / tahun (Bronze → Immortal), direset tiap 1 Januari; riwayat tahun lalu tetap tersimpan.

export const XP_PER_TRIP = 5;
export const XP_PER_TIER = 100;
export const TIER_DAYS = 23;
export const TRIPS_PER_TIER = XP_PER_TIER / XP_PER_TRIP; // 20
export const MIN_TRIPS_RANK = 3;                         // minimal pengiriman sebulan agar masuk peringkat efisiensi

// a = terang · b = utama · c = gelap · d = latar sangat gelap (untuk kartu profil) · g = warna glow
export const TIERS = [
  { n: 1,  name: 'BRONZE',        a: '#f6c9a0', b: '#cd7f32', c: '#7a4417', d: '#2a160a', g: 'rgba(205,127,50,.55)' },
  { n: 2,  name: 'SILVER',        a: '#ffffff', b: '#b4bdca', c: '#5f6b7c', d: '#181d27', g: 'rgba(180,189,202,.55)' },
  { n: 3,  name: 'GOLD',          a: '#fff3b0', b: '#f5b800', c: '#8a5a00', d: '#2b1e02', g: 'rgba(245,184,0,.6)' },
  { n: 4,  name: 'PLATINUM',      a: '#e9fdff', b: '#6fd6e8', c: '#23697e', d: '#07232b', g: 'rgba(111,214,232,.6)' },
  { n: 5,  name: 'DIAMOND',       a: '#dff5ff', b: '#3db8ff', c: '#1550c9', d: '#081636', g: 'rgba(61,184,255,.65)' },
  { n: 6,  name: 'CROWN',         a: '#ffd0ec', b: '#ff3fa4', c: '#8a0a55', d: '#2d0719', g: 'rgba(255,63,164,.6)' },
  { n: 7,  name: 'ACE',           a: '#ffd0d0', b: '#ff4b4b', c: '#8c0f1c', d: '#2d070b', g: 'rgba(255,75,75,.65)' },
  { n: 8,  name: 'ACE MASTER',    a: '#ffe1b3', b: '#ff7d1a', c: '#942f00', d: '#2e1100', g: 'rgba(255,125,26,.7)' },
  { n: 9,  name: 'ACE DOMINATOR', a: '#e1d4ff', b: '#8b5cf6', c: '#2f1479', d: '#120830', g: 'rgba(139,92,246,.75)' },
  { n: 10, name: 'CONQUEROR',     a: '#c9fff0', b: '#14d9a5', c: '#065f4a', d: '#04201a', g: 'rgba(20,217,165,.75)' },
  { n: 11, name: 'MYTHIC',        a: '#7df9ff', b: '#f472ff', c: '#4a0f8f', d: '#150a33', g: 'rgba(244,114,255,.8)' },
  { n: 12, name: 'IMMORTAL',      a: '#fff7d6', b: '#ffd54a', c: '#ff4d6d', d: '#1d1020', g: 'rgba(255,213,74,.85)' },
];
export const TIER_COUNT = TIERS.length;
export const tierOf = (n) => TIERS[Math.min(TIER_COUNT, Math.max(1, n)) - 1];

/** Level efek visual: 0 = logam statis · 1 = berputar pelan · 2 = berputar + berdenyut · 3 = maksimum. */
export const fxLevel = (n) => (n >= 10 ? 3 : n >= 7 ? 2 : n >= 4 ? 1 : 0);

/** Status XP dari total XP tahun berjalan. */
export function xpState(totalXp) {
  const t = Math.max(0, Math.floor(+totalXp || 0));
  const idx = Math.min(TIER_COUNT - 1, Math.floor(t / XP_PER_TIER));
  const top = idx === TIER_COUNT - 1;
  const inTier = top ? Math.min(XP_PER_TIER, t - idx * XP_PER_TIER) : t % XP_PER_TIER;
  return {
    total: t, tier: idx + 1, top,
    inTier, pct: Math.round((inTier / XP_PER_TIER) * 100),
    toNext: top ? 0 : XP_PER_TIER - inTier,
    tripsToNext: top ? 0 : Math.ceil((XP_PER_TIER - inTier) / XP_PER_TRIP),
  };
}

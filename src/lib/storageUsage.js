// Logika penggunaan penyimpanan (murni, bisa dites). Data mentah dari fungsi database storage_usage().
// Default = kuota paket gratis Supabase (500 MB database · 1 GB file). Setelah upgrade (mis. Pro 8 GB / 100 GB),
// developer mengubah batas di halaman REPORT LOGISTIC.

export const MB = 1024 * 1024;
export const DEFAULT_LIMITS = { db_mb: 500, storage_mb: 1024, warn_pct: 80, crit_pct: 95 };

const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
/** Batas tersimpan (boleh kosong/rusak) → batas valid. crit selalu > warn. */
export function normLimits(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const warn = num(r.warn_pct, DEFAULT_LIMITS.warn_pct, 50, 98);
  return {
    db_mb: num(r.db_mb, DEFAULT_LIMITS.db_mb, 50, 10_000_000),
    storage_mb: num(r.storage_mb, DEFAULT_LIMITS.storage_mb, 50, 100_000_000),
    warn_pct: warn,
    crit_pct: Math.max(warn + 1, num(r.crit_pct, DEFAULT_LIMITS.crit_pct, 51, 100)),
  };
}

const idn = (n, d) => n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
/** 1536 → "1,5 KB" · 5242880 → "5,0 MB" · 1073741824 → "1,00 GB" */
export function fmtBytes(n) {
  const b = Math.max(0, +n || 0);
  if (b < 1024) return `${Math.round(b)} B`;
  if (b < MB) return `${idn(b / 1024, 1)} KB`;
  if (b < 1024 * MB) return `${idn(b / MB, 1)} MB`;
  return `${idn(b / (1024 * MB), 2)} GB`;
}

/** Persen untuk tampilan: di bawah 10% pakai 1 desimal (0,2%) supaya penggunaan kecil tidak tampil "0%". */
export const fmtPct = (p) => { const v = Math.max(0, +p || 0); return v >= 10 ? `${Math.round(v)}%` : `${idn(v, 1)}%`; };

export const LEVEL_RANK = { ok: 0, warn: 1, crit: 2 };
export const LEVEL_TEXT = { ok: 'AMAN', warn: 'HAMPIR PENUH', crit: 'KRITIS' };
export const levelOf = (pct, lim) => (pct >= lim.crit_pct ? 'crit' : pct >= lim.warn_pct ? 'warn' : 'ok');

/** Ubah hasil storage_usage() menjadi dua meteran (database & foto) + level terburuk. */
export function evaluate(usage, rawLimits) {
  const lim = normLimits(rawLimits ?? usage?.limits);
  const mk = (key, label, used, limitMb) => {
    const limit = limitMb * MB; const pct = limit ? (used / limit) * 100 : 0;
    return { key, label, used, limit, pct, level: levelOf(pct, lim), free: Math.max(0, limit - used) };
  };
  const items = [
    mk('db', 'Database', +usage?.db_bytes || 0, lim.db_mb),
    mk('storage', 'Penyimpanan foto', +usage?.storage_bytes || 0, lim.storage_mb),
  ];
  const worst = items.reduce((a, b) => (LEVEL_RANK[b.level] > LEVEL_RANK[a.level] ? b : a));
  return { limits: lim, items, level: worst.level, worst };
}

/**
 * Perkiraan berapa bulan lagi penuh, dari rata-rata pertambahan foto per bulan.
 * monthly: [{ ym, bytes }]; bulan berjalan (belum lengkap) tidak dipakai. null bila belum cukup data.
 */
export function monthsUntilFull(monthly, used, limit, nowYm) {
  const full = (monthly || []).filter((m) => m.ym < nowYm && +m.bytes > 0).slice(-3);
  if (!full.length) return null;
  const avg = full.reduce((a, m) => a + +m.bytes, 0) / full.length;
  if (used >= limit) return 0;
  return avg > 0 ? (limit - used) / avg : null;
}

export function alertText(ev) {
  const bad = ev.items.filter((i) => i.level !== 'ok').sort((a, b) => b.pct - a.pct);
  if (!bad.length) return '';
  const parts = bad.map((i) => `${i.label} ${Math.round(i.pct)}% (${fmtBytes(i.used)} dari ${fmtBytes(i.limit)})`);
  return `${ev.level === 'crit' ? 'Penyimpanan hampir habis' : 'Penyimpanan mulai penuh'}: ${parts.join(' · ')}.`;
}

/** Banner ditutup sementara (24 jam), tetapi muncul lagi bila levelnya naik (mis. dari HAMPIR PENUH ke KRITIS). */
export function shouldShowAlert(level, dismissed, now = Date.now()) {
  if (level === 'ok') return false;
  if (!dismissed || !(dismissed.until > now)) return true;
  return LEVEL_RANK[level] > LEVEL_RANK[dismissed.level];
}

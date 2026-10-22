import assert from 'node:assert/strict';
import { DEFAULT_LIMITS, MB, fmtPct, alertText, evaluate, fmtBytes, levelOf, monthsUntilFull, normLimits, shouldShowAlert } from './storageUsage.js';

assert.deepEqual(normLimits(null), DEFAULT_LIMITS);
assert.deepEqual(normLimits({ db_mb: 8192, storage_mb: 102400, warn_pct: 70, crit_pct: 90 }), { db_mb: 8192, storage_mb: 102400, warn_pct: 70, crit_pct: 90 });
assert.equal(normLimits({ warn_pct: 90, crit_pct: 80 }).crit_pct, 91);               // crit selalu di atas warn
assert.equal(normLimits({ db_mb: 'abc' }).db_mb, 500); assert.equal(normLimits({ db_mb: 1 }).db_mb, 50); // input rusak / di luar rentang
assert.equal(fmtBytes(0), '0 B'); assert.equal(fmtBytes(1536), '1,5 KB'); assert.equal(fmtBytes(5 * MB), '5,0 MB'); assert.equal(fmtBytes(1024 * MB), '1,00 GB');

const lim = normLimits(null);
assert.equal(levelOf(79.9, lim), 'ok'); assert.equal(levelOf(80, lim), 'warn'); assert.equal(levelOf(94.9, lim), 'warn'); assert.equal(levelOf(95, lim), 'crit'); assert.equal(levelOf(120, lim), 'crit');

// database 410/500 MB = 82% → warn ; foto 100/1024 MB → ok
let ev = evaluate({ db_bytes: 410 * MB, storage_bytes: 100 * MB });
assert.equal(ev.level, 'warn'); assert.equal(ev.worst.key, 'db'); assert.equal(ev.items[0].level, 'warn'); assert.equal(ev.items[1].level, 'ok');
assert.match(alertText(ev), /Database 82%/); assert.ok(!/foto/i.test(alertText(ev)));
// foto 990/1024 = 96.7% → kritis menang
ev = evaluate({ db_bytes: 410 * MB, storage_bytes: 990 * MB });
assert.equal(ev.level, 'crit'); assert.equal(ev.worst.key, 'storage'); assert.match(alertText(ev), /hampir habis/);
// batas dari database dipakai (upgrade Pro): 410 MB dari 8 GB = aman
ev = evaluate({ db_bytes: 410 * MB, storage_bytes: 5 * 1024 * MB, limits: { db_mb: 8192, storage_mb: 102400 } });
assert.equal(ev.level, 'ok'); assert.equal(alertText(ev), '');
assert.equal(evaluate({}).level, 'ok');                                                // data kosong tidak error

// proyeksi: rata-rata 3 bulan lengkap terakhir, bulan berjalan diabaikan
const monthly = [{ ym: '2026-07', bytes: 100 * MB }, { ym: '2026-08', bytes: 200 * MB }, { ym: '2026-09', bytes: 300 * MB }, { ym: '2026-10', bytes: 999 * MB }];
assert.equal(monthsUntilFull(monthly, 400 * MB, 1000 * MB, '2026-10'), 3);              // sisa 600 / rata 200
assert.equal(monthsUntilFull(monthly, 1000 * MB, 1000 * MB, '2026-10'), 0);
assert.equal(monthsUntilFull([{ ym: '2026-10', bytes: 5 }], 1, 100, '2026-10'), null);   // belum ada bulan lengkap
assert.equal(monthsUntilFull([], 1, 100, '2026-10'), null);

// banner: aman tidak tampil; ditutup 24 jam; naik level muncul lagi
const now = 1_000_000;
assert.equal(shouldShowAlert('ok', null, now), false);
assert.equal(shouldShowAlert('warn', null, now), true);
assert.equal(shouldShowAlert('warn', { level: 'warn', until: now + 1000 }, now), false);
assert.equal(shouldShowAlert('crit', { level: 'warn', until: now + 1000 }, now), true);
assert.equal(shouldShowAlert('warn', { level: 'warn', until: now - 1 }, now), true);   // 24 jam lewat
assert.equal(fmtPct(0.2), '0,2%'); assert.equal(fmtPct(0), '0,0%'); assert.equal(fmtPct(9.96), '10,0%'); assert.equal(fmtPct(10), '10%'); assert.equal(fmtPct(82.4), '82%'); assert.equal(fmtPct(-5), '0,0%');
console.log('storageUsage OK');

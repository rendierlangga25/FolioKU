import assert from 'node:assert/strict';
import { coverSourceRect, cropSourceRect, clampRect, frameSize, FRAME_ASPECT } from './imageCrop.js';
import { pickOdometer, combineReadings, otsu } from './ocr.js';
import { checkTrip, EMPTY_FORM, EMPTY_PHOTOS, normTujuan } from './tripRules.js';

const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≉ ${b}`);

// ── frame ──
const fz = frameSize(400, 800);
near(fz.fw / fz.fh, FRAME_ASPECT); near(fz.fx, (400 - fz.fw) / 2); near(fz.fy, (800 - fz.fh) / 2);
assert.ok(frameSize(900, 300).fh <= 150 + 1e-9);   // layar landscape: tinggi frame dibatasi

// ── video cover: video 1920×1080 di layar portrait 400×800 → skala = 800/1080, sisi kiri/kanan terpotong ──
{
  const s = 800 / 1080, ox = (400 - 1920 * s) / 2;
  const r = coverSourceRect({ vw: 1920, vh: 1080, cw: 400, ch: 800, fx: 20, fy: 300, fw: 360, fh: 112.5 });
  near(r.sw, 360 / s); near(r.sh, 112.5 / s); near(r.sx, (20 - ox) / s); near(r.sy, 300 / s);
  // titik tengah frame ⇔ titik tengah video yang tampak di tengah layar (video ditengahkan)
  near(r.sx + r.sw / 2, 960, 1e-6); near(r.sy + r.sh / 2, (356.25) / s, 1e-6);
  // rasio hasil crop tetap = rasio frame
  near(r.sw / r.sh, 360 / 112.5);
}
// video persis seukuran layar → tanpa offset
{ const r = coverSourceRect({ vw: 400, vh: 800, cw: 400, ch: 800, fx: 20, fy: 100, fw: 360, fh: 100 }); near(r.sx, 20); near(r.sy, 100); near(r.sw, 360); near(r.sh, 100); }

// ── gambar galeri: skala 0.5, diletakkan di (−100, 50) ──
{
  const r = cropSourceRect({ scale: 0.5, left: -100, top: 50, fx: 20, fy: 200, fw: 300, fh: 100 });
  near(r.sx, 240); near(r.sy, 300); near(r.sw, 600); near(r.sh, 200);
}
// clamp
{ const r = clampRect({ sx: -10, sy: 950, sw: 300, sh: 100 }, 1000, 1000); assert.deepEqual(r, { sx: 0, sy: 900, sw: 300, sh: 100 }); }
{ const r = clampRect({ sx: 0, sy: 0, sw: 2000, sh: 100 }, 1000, 1000); assert.equal(r.sw, 1000); }

// ── OCR: pemilihan angka ──
assert.deepEqual(pickOdometer([{ text: '12', confidence: 90 }, { text: '185559', confidence: 80 }, { text: '88', confidence: 99 }]), { value: 185559, len: 6, conf: 80 });
assert.equal(pickOdometer([{ text: 'ab', confidence: 99 }]), null);
assert.equal(pickOdometer([{ text: '12345678', confidence: 99 }]), null); // >7 digit ditolak
// konsensus: 185559 muncul di 3 versi > 185569 yang confidence-nya sedikit lebih tinggi sendirian
{
  const r = combineReadings([
    { value: 185559, len: 6, conf: 70 }, { value: 185569, len: 6, conf: 78 },
    { value: 185559, len: 6, conf: 65 }, { value: 185559, len: 6, conf: 60 }, null,
  ]);
  assert.equal(r.value, 185559); assert.equal(r.count, 3);
}
assert.equal(combineReadings([null, null]), null);
// Otsu memisahkan dua puncak
{ const h = new Array(256).fill(0); h[30] = 500; h[220] = 500; const t = otsu(h, 1000); assert.ok(t >= 30 && t < 220); }

// ── aturan kelengkapan ──
assert.equal(normTujuan('  adm   sunter '), 'ADM SUNTER');
const item = { id: 'x', blob: {} };
const full = {
  f: { ...EMPTY_FORM, driver1_id: 'a', vehicle_id: 'v', tujuan: ['ADM SUNTER'], bbm_rp: 180000, kartu4: '1234', km_awal: 100, km_isi: 150, km_akhir: 220 },
  ph: { ...EMPTY_PHOTOS(), km_awal: item, km_isi: item, km_akhir: item, serah_terima: [item], surat_jalan: [item] },
};
assert.ok(checkTrip(full.f, full.ph).complete);
// tol, parkir, foto kendala = opsional → tidak menghalangi
assert.ok(checkTrip({ ...full.f, tol_rp: '', parkir_rp: '' }, { ...full.ph, kendala: [] }).complete);
// belum ada KM isi + foto → draft belum lengkap
{
  const c = checkTrip({ ...full.f, km_isi: '', km_akhir: '' }, { ...full.ph, km_isi: null, km_akhir: null });
  assert.equal(c.complete, false);
  assert.deepEqual(c.steps.filter((s) => !s.ok).map((s) => s.key), ['isi', 'akhir']);
}
assert.equal(checkTrip(full.f, { ...full.ph, serah_terima: [] }).complete, false);
assert.equal(checkTrip(full.f, { ...full.ph, surat_jalan: [] }).complete, false);
// urutan KM
assert.equal(checkTrip({ ...full.f, km_isi: 90 }, full.ph).complete, false);
assert.equal(checkTrip({ ...full.f, km_isi: 300 }, full.ph).complete, false);
// mode ubah data lama: foto tidak diwajibkan
assert.ok(checkTrip(full.f, EMPTY_PHOTOS(), { relaxPhotos: true }).complete);
console.log('imageCrop/ocr/tripRules OK');

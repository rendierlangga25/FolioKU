// Matematika & gambar untuk memotong foto sesuai kotak bidik (frame) KM.

/** Rasio lebar : tinggi kotak bidik — bentuk panel angka odometer. */
export const FRAME_ASPECT = 3.2;

/** Ukuran kotak bidik di dalam area (cw × ch): lebar 90% (maks 640px), tinggi mengikuti rasio. */
export function frameSize(cw, ch) {
  let fw = Math.min(cw * 0.9, 640);
  let fh = fw / FRAME_ASPECT;
  if (fh > ch * 0.5) { fh = ch * 0.5; fw = fh * FRAME_ASPECT; }
  return { fw, fh, fx: (cw - fw) / 2, fy: (ch - fh) / 2 };
}

/**
 * Video ditampilkan `object-fit: cover` di kotak (cw × ch). Hitung persegi sumber (piksel video)
 * yang tepat berada di bawah kotak bidik (fx, fy, fw, fh — koordinat kotak).
 */
export function coverSourceRect({ vw, vh, cw, ch, fx, fy, fw, fh }) {
  const scale = Math.max(cw / vw, ch / vh);
  const ox = (cw - vw * scale) / 2;
  const oy = (ch - vh * scale) / 2;
  return { sx: (fx - ox) / scale, sy: (fy - oy) / scale, sw: fw / scale, sh: fh / scale };
}

/** Gambar diletakkan di (left, top) dengan skala `scale` — persegi sumber di bawah kotak bidik. */
export function cropSourceRect({ scale, left, top, fx, fy, fw, fh }) {
  return { sx: (fx - left) / scale, sy: (fy - top) / scale, sw: fw / scale, sh: fh / scale };
}

/** Jaga persegi tetap di dalam gambar sumber. */
export function clampRect(r, W, H) {
  const sw = Math.min(r.sw, W), sh = Math.min(r.sh, H);
  return { sx: Math.max(0, Math.min(r.sx, W - sw)), sy: Math.max(0, Math.min(r.sy, H - sh)), sw, sh };
}

/** Potong `source` (video/img/bitmap) ke persegi `rect`, kecilkan bila lebih lebar dari maxW. */
export function drawCrop(source, rect, W, H, { maxW = 1200, quality = 0.92 } = {}) {
  const r = clampRect(rect, W, H);
  const ow = Math.max(1, Math.round(Math.min(r.sw, maxW)));
  const oh = Math.max(1, Math.round((ow * r.sh) / r.sw));
  const c = document.createElement('canvas');
  c.width = ow; c.height = oh;
  c.getContext('2d').drawImage(source, r.sx, r.sy, r.sw, r.sh, 0, 0, ow, oh);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Gagal memotong foto'))), 'image/jpeg', quality));
}

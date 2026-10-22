// Watermark tanggal & jam pengambilan foto (kanan bawah). Dipakai semua foto operasional:
// KM, sisa bar bensin, serah terima, surat jalan, kendala, dan foto loading dock.
const P = (n) => String(n).padStart(2, '0');

/** "18/10/2026 17:59" — dari waktu foto diambil (file.lastModified bila ada, kalau tidak: sekarang). */
export function stampText(ms) {
  const d = new Date(Number.isFinite(ms) && ms > 946684800000 ? ms : Date.now());
  return `${P(d.getDate())}/${P(d.getMonth() + 1)}/${d.getFullYear()} ${P(d.getHours())}:${P(d.getMinutes())}`;
}

/** Gambar teks tanggal di atas kanvas yang sudah berisi foto. */
export function drawStamp(ctx, w, h, text) {
  const fs = Math.max(14, Math.round(Math.min(w, h) * 0.045));
  ctx.font = `700 ${fs}px Calibri, Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  const padX = fs * 0.6, padY = fs * 0.4, tw = ctx.measureText(text).width;
  const bw = tw + padX * 2, bh = fs + padY * 2, m = Math.round(fs * 0.5);
  const x = w - bw - m, y = h - bh - m;
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, bw, bh, fs * 0.3); else ctx.rect(x, y, bw, bh);
  ctx.fill();
  ctx.fillStyle = '#ffb347';
  ctx.fillText(text, x + padX, y + bh / 2 + 1);
}

const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Foto tidak valid')); i.src = src; });

async function render(src, ms, mime, q) {
  const img = await load(src);
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  drawStamp(ctx, c.width, c.height, stampText(ms));
  return c.toDataURL(mime, q);
}

/** Blob → Blob JPEG ber-watermark. Bila gagal, foto asli dikembalikan (tidak menghambat input). */
export async function stampBlob(blob, ms) {
  const url = URL.createObjectURL(blob);
  try {
    const d = await render(url, ms, 'image/jpeg', 0.85);
    return await (await fetch(d)).blob();
  } catch { return blob; } finally { URL.revokeObjectURL(url); }
}

/** data-URL → data-URL JPEG ber-watermark. */
export async function stampDataUrl(dataUrl, ms) {
  try { return await render(dataUrl, ms, 'image/jpeg', 0.85); } catch { return dataUrl; }
}

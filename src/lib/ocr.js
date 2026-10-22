// OCR angka odometer (KM) dari foto yang SUDAH dipotong ke kotak bidik, jalan di browser (Tesseract.js).
// Hasil SELALU bisa dikoreksi manual oleh driver — OCR hanya mengisi otomatis.
//
// Supaya tidak "ngaco": foto sudah berisi angka saja (hasil crop), dibaca sebagai satu baris,
// dicoba dalam 4 versi (normal / terbalik × abu-abu / hitam-putih) dan dipilih yang paling konsisten.

let workerPromise;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const w = await createWorker('eng');
      await w.setParameters({
        tessedit_char_whitelist: '0123456789',
        tessedit_pageseg_mode: '7', // satu baris teks — foto sudah di-crop ke panel angka
        classify_bln_numeric_mode: '1',
        user_defined_dpi: '300',
      });
      return w;
    })();
  }
  return workerPromise;
}

/** Ambang Otsu dari histogram abu-abu 0..255. */
export function otsu(hist, total) {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; thr = i; }
  }
  return thr;
}

/** Siapkan 4 kanvas: [abu-abu, abu-abu terbalik, hitam-putih, hitam-putih terbalik]. */
async function variants(blob) {
  const bmp = await createImageBitmap(blob);
  const scale = Math.max(0.5, Math.min(3, 300 / bmp.height));
  const pad = 24;
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const base = document.createElement('canvas');
  base.width = w + pad * 2; base.height = h + pad * 2;
  const ctx = base.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, base.width, base.height);
  ctx.drawImage(bmp, pad, pad, w, h);
  const img = ctx.getImageData(0, 0, base.width, base.height);
  const d = img.data, n = d.length / 4;

  const gray = new Uint8ClampedArray(n);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < n; i++) {
    const g = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
    gray[i] = g; hist[g]++;
  }
  // regangkan kontras: persentil 2%–98%
  let acc = 0, lo = 0, hi = 255;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= n * 0.02) { lo = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc >= n * 0.02) { hi = i; break; } }
  const span = Math.max(30, hi - lo);
  const stretched = gray.map((g) => Math.max(0, Math.min(255, ((g - lo) / span) * 255)));
  const sh = new Array(256).fill(0);
  stretched.forEach((g) => { sh[g | 0]++; });
  const thr = otsu(sh, n);

  const make = (fn) => {
    const c = document.createElement('canvas');
    c.width = base.width; c.height = base.height;
    const cx = c.getContext('2d');
    const out = cx.createImageData(c.width, c.height);
    for (let i = 0; i < n; i++) { const v = fn(stretched[i]); out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = v; out.data[i * 4 + 3] = 255; }
    cx.putImageData(out, 0, 0);
    return c;
  };
  return [
    make((g) => g),
    make((g) => 255 - g),
    make((g) => (g > thr ? 255 : 0)),
    make((g) => (g > thr ? 0 : 255)),
  ];
}

/** Pilih angka paling mungkin sebagai KM: deret 4–7 digit terpanjang dengan confidence terbaik. */
export function pickOdometer(words) {
  const cands = [];
  for (const w of words || []) {
    const digits = (w.text || '').replace(/\D/g, '');
    if (digits.length >= 4 && digits.length <= 7) {
      cands.push({ value: parseInt(digits, 10), len: digits.length, conf: w.confidence || 0 });
    }
  }
  cands.sort((a, b) => b.len - a.len || b.conf - a.conf);
  return cands[0] || null;
}

/** Gabungkan hasil beberapa versi gambar: angka yang sama dari banyak versi lebih dipercaya. */
export function combineReadings(readings) {
  const by = new Map();
  for (const r of readings.filter(Boolean)) {
    const e = by.get(r.value) || { value: r.value, len: r.len, conf: 0, count: 0 };
    e.count += 1; e.conf = Math.max(e.conf, r.conf);
    by.set(r.value, e);
  }
  let best = null, bestScore = -1;
  for (const e of by.values()) {
    const score = e.conf + 20 * (e.count - 1) + (e.len >= 5 ? 8 : 0);
    if (score > bestScore) { best = e; bestScore = score; }
  }
  return best ? { value: best.value, conf: Math.min(100, best.conf + (best.count > 1 ? 10 : 0)), count: best.count } : null;
}

const wordsOf = (data) => {
  if (data?.words?.length) return data.words;
  return String(data?.text || '').split(/\s+/).filter(Boolean).map((t) => ({ text: t, confidence: data?.confidence || 0 }));
};

export async function readOdometer(blob, onProgress) {
  onProgress?.('Menyiapkan OCR…');
  // Batas waktu agar UI tidak menggantung bila internet putus / CDN worker gagal dimuat.
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('OCR timeout')), 45000));
  const run = (async () => {
    const worker = await getWorker();
    const canvases = await variants(blob);
    const readings = [];
    for (let i = 0; i < canvases.length; i++) {
      onProgress?.(`Membaca angka KM… (${i + 1}/${canvases.length})`);
      const { data } = await worker.recognize(canvases[i]);
      readings.push(pickOdometer(wordsOf(data)));
    }
    return combineReadings(readings);
  })();
  try {
    const best = await Promise.race([run, timeout]);
    return best ? { value: best.value, confidence: Math.round(best.conf), agree: best.count } : null;
  } catch (e) {
    workerPromise = undefined; // coba lagi dari awal pada foto berikutnya
    throw e;
  }
}

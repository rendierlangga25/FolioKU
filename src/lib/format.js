export const rp = (n) => 'Rp ' + Math.round(+n || 0).toLocaleString('id-ID');
export const num = (n, d = 2) =>
  (+n || 0).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
export const int = (n) => Math.round(+n || 0).toLocaleString('id-ID');

const TZ = 'Asia/Jakarta';
export const todayISO = () => new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(new Date());
export const monthISO = () => todayISO().slice(0, 7);

export const fmtDate = (iso) =>
  iso
    ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
        new Date(iso + 'T00:00:00Z')
      )
    : '';
export const fmtLongDate = (d = new Date()) =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }).format(d);
export const fmtClock = (d = new Date()) =>
  new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: TZ })
    .format(d)
    .replace(/\./g, ':');

export const monthRange = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
};

/** Rentang tanggal bawaan = satu bulan berjalan. */
export const thisMonthRange = () => monthRange(monthISO());
export const rangeLabel = (r) => (r.from === r.to ? fmtDate(r.from) : `${fmtDate(r.from)} – ${fmtDate(r.to)}`);
export const rangeSlug = (r) => `${r.from}_${r.to}`;

export const csvDownload = (filename, rows) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = '﻿' + rows.map((r) => r.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
};

/** Perkecil foto (maks 1280px, JPEG) agar hemat storage & OCR cepat. */
export function compressImage(file, max = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal memproses foto'))), 'image/jpeg', quality);
    };
    img.onerror = () => reject(new Error('File bukan gambar yang valid'));
    img.src = url;
  });
}

export const blobToDataURL = (blob) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });

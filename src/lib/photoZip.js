// Unduh foto bukti sebagai ZIP dengan folder rapi:
//   PENGIRIMAN / 2026 / 10 OKTOBER / B 9075 PCR - DUTRO / 2026-10-05 - CEPI & RANTA - ADM SUNTER (a1b2c3) / 1 KM AWAL.jpg
//   LOADING DOCK / 2026 / 10 OKTOBER / INTERNAL - REGULER / 2026-10-05 - SO 123 - PT X - B 1234 CD (a1b2c3) / 1 LOADING 1.jpg
// File besar dipecah jadi beberapa ZIP (bagian 1, 2, …) agar tidak menghabiskan memori browser.
import { ritase } from './calc.js';

export const MB = 1024 * 1024;
const BULAN = ['01 JANUARI', '02 FEBRUARI', '03 MARET', '04 APRIL', '05 MEI', '06 JUNI', '07 JULI', '08 AGUSTUS', '09 SEPTEMBER', '10 OKTOBER', '11 NOVEMBER', '12 DESEMBER'];

/** Nama aman untuk folder/file di Windows, macOS, Linux (tanpa / \ : * ? " < > |, tanpa titik/spasi di ujung). */
export function sanitize(s, max = 80) {
  const t = String(s ?? '').normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^\.+/, '').slice(0, max).replace(/[. ]+$/, '').trim();
  return t || 'TANPA NAMA';
}
const monthDir = (iso) => `${iso.slice(0, 4)}/${BULAN[+iso.slice(5, 7) - 1]}`;
const short = (id) => String(id || '').replace(/-/g, '').slice(0, 6);

const TRIP_KINDS = [
  ['foto_path', '1 KM AWAL', false], ['foto_km_isi', '2 KM ISI BBM', false], ['foto_sisa_bbm', '3 SISA BBM', false], ['foto_km_akhir', '4 KM AKHIR', false],
  ['foto_serah_terima', '5 SERAH TERIMA', true], ['foto_surat_jalan', '6 SURAT JALAN', true], ['foto_kendala', '7 KENDALA', true],
];
/** Daftar foto pengiriman → entri { src, dir, name, meta }. */
export function planTripPhotos(trips, { driver, vehicle }) {
  const out = [];
  for (const t of trips) {
    const v = vehicle[t.vehicle_id];
    const names = [t.driver1_id, t.driver2_id].filter(Boolean).map((id) => driver[id]?.nama || '?').join(' & ');
    const tujuan = (t.tujuan || []).filter(Boolean);
    const tj = tujuan.length > 2 ? `${tujuan.slice(0, 2).join(', ')} dst` : tujuan.join(', ');
    const dir = [
      'PENGIRIMAN', monthDir(t.tanggal), sanitize(`${v?.plat || 'TANPA PLAT'}${v?.nama ? ` - ${v.nama}` : ''}`),
      sanitize(`${t.tanggal} - ${names} - ${tj} (${short(t.id)})`, 110),
    ].join('/');
    const meta = { tanggal: t.tanggal, jenis: 'Pengiriman', plat: v?.plat || '', driver: names, tujuan: tujuan.join(', '), ritase: ritase(t) };
    for (const [col, label, many] of TRIP_KINDS) {
      const val = t[col];
      if (many) (val || []).filter(Boolean).forEach((p, i) => out.push({ src: p, dir, name: `${label} ${i + 1}`, meta }));
      else if (val) out.push({ src: val, dir, name: label, meta });
    }
  }
  return out;
}

/** Daftar foto loading dock (INTERNAL per kategori, EKSTERNAL per expedisi). */
export function planDockPhotos(docks) {
  const out = [];
  for (const d of docks) {
    const internal = d.jenis === 'internal';
    const grp = internal ? `INTERNAL - ${String(d.kategori || '').toUpperCase()}` : `EKSTERNAL - ${String(d.expedisi || 'TANPA EXPEDISI').toUpperCase()}`;
    const bits = [d.tanggal, d.no_so ? `SO ${d.no_so}` : '', d.perusahaan, d.plat].filter(Boolean).join(' - ');
    const dir = ['LOADING DOCK', monthDir(d.tanggal), sanitize(grp), sanitize(`${bits} (${short(d.id)})`, 110)].join('/');
    const meta = { tanggal: d.tanggal, jenis: `Loading dock ${internal ? 'internal' : 'eksternal'}`, plat: d.plat || '', driver: '', tujuan: d.perusahaan || '', ritase: '' };
    (d.foto_loading || []).filter(Boolean).forEach((p, i) => out.push({ src: p, dir, name: `1 LOADING ${i + 1}`, meta }));
    (d.foto_sj || []).filter(Boolean).forEach((p, i) => out.push({ src: p, dir, name: `2 SURAT JALAN ${i + 1}`, meta }));
  }
  return out;
}

export function summarizePlan(entries) {
  return { files: entries.length, folders: new Set(entries.map((e) => e.dir)).size };
}

const extOf = (blob, src) => {
  const t = (blob?.type || '').toLowerCase();
  if (t.includes('png')) return 'png';
  if (t.includes('webp')) return 'webp';
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
  const m = /\.(jpe?g|png|webp)(\?|$)/i.exec(String(src));
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
};
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/**
 * Jalankan unduhan → ZIP bertahap.
 * fetchBlob(src) → Blob · save(blob, filename) · onProgress({ done, total, bytes, parts, failed })
 * Foto yang gagal diunduh dilewati & dicatat (_GAGAL.txt); proses tetap berjalan. signal.abort() menghentikan (bagian yang belum lengkap tidak disimpan).
 */
export async function runPhotoZip({ entries, JSZip, fetchBlob, save, baseName, onProgress, signal, partBytes = 200 * MB, maxFilesPerPart = 1500, concurrency = 4, retries = 2 }) {
  const res = { ok: 0, failed: [], parts: 0, bytes: 0, files: [], aborted: false };
  let zip = new JSZip(), used = 0, count = 0, rows = [], fails = [], names = new Set(), flushedBefore = 0, done = 0;
  const name = (n) => `${sanitize(baseName, 100)}${n ? ` - bagian ${n}` : ''}.zip`;

  const flush = async (partNo) => {
    if (!count && !fails.length) return;
    zip.file('_DAFTAR FOTO.csv', '\uFEFF' + ['Folder', 'File', 'Tanggal', 'Jenis', 'Plat', 'Driver', 'Tujuan / Perusahaan', 'Ukuran (KB)'].map(csvCell).join(',') + '\r\n'
      + rows.map((r) => r.map(csvCell).join(',')).join('\r\n'));
    if (fails.length) zip.file('_GAGAL.txt', `Foto berikut gagal diunduh (${fails.length}):\r\n\r\n${fails.map((f) => `${f.zipPath}\r\n  sumber: ${f.src}\r\n  sebab : ${f.reason}`).join('\r\n\r\n')}\r\n`);
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE', streamFiles: true }); // JPEG sudah terkompres → tanpa kompres ulang
    const fn = name(partNo);
    await save(blob, fn);
    res.parts += 1; res.files.push(fn);
    zip = new JSZip(); used = 0; count = 0; rows = []; fails = []; names = new Set();
  };

  const getWithRetry = async (src) => {
    let last;
    for (let a = 0; a <= retries; a++) {
      if (signal?.aborted) throw new DOMException('Dibatalkan', 'AbortError');
      try { return await fetchBlob(src); } catch (e) { last = e; if (a < retries) await new Promise((r) => setTimeout(r, 250 * (a + 1))); }
    }
    throw last;
  };

  try {
    for (let i = 0; i < entries.length; i += concurrency) {
      if (signal?.aborted) throw new DOMException('Dibatalkan', 'AbortError');
      const batch = entries.slice(i, i + concurrency);
      const got = await Promise.all(batch.map((e) => getWithRetry(e.src).then((b) => ({ e, b }), (err) => ({ e, err }))));
      for (const { e, b, err } of got) {
        done += 1;
        let path = `${e.dir}/${sanitize(e.name, 60)}.${b ? extOf(b, e.src) : 'jpg'}`;
        for (let n = 2; names.has(path.toLowerCase()); n++) path = path.replace(/( \(\d+\))?(\.\w+)$/, ` (${n})$2`);
        if (err || !b || !b.size) {
          const reason = err?.message || 'file kosong';
          fails.push({ zipPath: path, src: e.src, reason }); res.failed.push({ path, src: e.src, reason });
        } else {
          names.add(path.toLowerCase());
          zip.file(path, b);
          used += b.size; count += 1; res.ok += 1; res.bytes += b.size;
          rows.push([e.dir, path.slice(e.dir.length + 1), e.meta.tanggal, e.meta.jenis, e.meta.plat, e.meta.driver, e.meta.tujuan, Math.round(b.size / 1024)]);
        }
      }
      onProgress?.({ done, total: entries.length, bytes: res.bytes, parts: res.parts, failed: res.failed.length });
      // Bagian penuh dan masih ada foto tersisa → simpan sekarang sebagai "bagian N"
      if ((used >= partBytes || count >= maxFilesPerPart) && i + concurrency < entries.length) { flushedBefore += 1; await flush(flushedBefore); }
    }
    await flush(flushedBefore ? flushedBefore + 1 : 0); // tanpa pecahan → nama file tanpa "bagian"
  } catch (e) {
    if (e?.name === 'AbortError') res.aborted = true; else throw e;
  }
  return res;
}

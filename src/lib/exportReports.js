// Pembuat file REPORT LOGISTIC: Excel (.xlsx) bergaya sama dengan ekspor tabel + ZIP backup.
// ExcelJS / JSZip dikirim sebagai argumen (dimuat hanya saat tombol Unduh ditekan; juga memudahkan pengujian).
import { DOCK_NOTE, MASTER_SHEETS, DOCK_COLS, dockFoot, dockTotalLabel, KOMPONEN_COLS, PERF_ARMADA_COLS, PERF_DRIVER_COLS, REKAP_ARMADA_COLS, REKAP_BULAN_COLS, REKAP_DRIVER_COLS, TRIP_COLS,
  USER_COLS, dockRows, performa, rekapBiaya, tripFoot, tripRows, userRows } from './reportData.js';

const NAVY = 'FF0F1B2D', LINE = 'FFD5DBE5', SOFT = 'FFF3F4F7';
const FMT = { int: '#,##0', dec1: '#,##0.0', dec2: '0.00', rp: '"Rp" #,##0', date: 'dd mmm yyyy', datetime: 'dd mmm yyyy hh:mm', pct: '0.0%', text: '@' };
const colLetter = (n) => { let s = ''; for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s; return s; };
const toDate = (s) => { if (!s) return null; const d = new Date(String(s).length === 10 ? `${s}T00:00:00Z` : s); return Number.isNaN(+d) ? null : d; };
const safeSheetName = (n) => String(n).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
const NUMERIC = new Set(['int', 'dec1', 'dec2', 'rp', 'pct']);

/**
 * Satu sheet: judul, baris keterangan, header navy, data, baris TOTAL (rumus SUM supaya tetap hidup bila diedit).
 * cols: [{ key, header, type, width, wrap, sum, bold }] · foot: nilai baris total untuk kolom non-penjumlahan (mis. KM/L).
 */
export function addSheet(wb, { name, title, info = [], cols, rows, foot = {}, totalLabel, groupBy }) {
  const ws = wb.addWorksheet(safeSheetName(name), { views: [{ state: 'frozen', ySplit: 3 + info.length }] });
  ws.getCell(1, 1).value = title; ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: NAVY } };
  info.forEach((line, i) => { const c = ws.getCell(2 + i, 1); c.value = line; c.font = { size: 10, color: { argb: 'FF627086' } }; });

  const hr = 3 + info.length, first = hr + 1, last = hr + rows.length;
  const head = ws.getRow(hr); head.height = 24;
  cols.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: NUMERIC.has(c.type) ? 'right' : 'left', vertical: 'middle', wrapText: true };
  });
  const widths = cols.map((c) => Math.max(c.width || 12, c.header.length + 3));

  rows.forEach((r, ri) => {
    const row = ws.getRow(first + ri);
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      let v = r[c.key];
      if (c.type === 'date' || c.type === 'datetime') v = toDate(v);
      else if (NUMERIC.has(c.type)) v = v === '' || v == null ? null : +v;
      else v = v == null ? '' : String(v);
      cell.value = v;
      if (FMT[c.type]) cell.numFmt = FMT[c.type];
      cell.alignment = { horizontal: NUMERIC.has(c.type) ? 'right' : 'left', vertical: 'top', wrapText: Boolean(c.wrap) };
      if (c.bold) cell.font = { bold: true };
      // garis tipis di awal setiap kelompok (mis. tiap upload loading dock) agar baris yang berulang tetap mudah dibaca
      const newGroup = groupBy && ri > 0 && groupBy(r) !== groupBy(rows[ri - 1]);
      cell.border = { top: newGroup ? { style: 'thin', color: { argb: 'FF9AA7BA' } } : undefined, bottom: { style: 'hair', color: { argb: LINE } } };
      if (typeof v === 'string' && !c.wrap) widths[i] = Math.max(widths[i], Math.min(48, v.length + 3));
    });
  });

  if (rows.length && cols.some((c) => c.sum || foot[c.key] !== undefined)) {
    const tr = ws.getRow(last + 1);
    cols.forEach((c, i) => {
      const cell = tr.getCell(i + 1), L = colLetter(i + 1);
      if (c.sum) cell.value = { formula: `SUM(${L}${first}:${L}${last})`, result: rows.reduce((a, r) => a + (+r[c.key] || 0), 0) };
      else if (foot[c.key] !== undefined) cell.value = foot[c.key];
      else if (i === 0) cell.value = totalLabel || `TOTAL (${rows.length} data)`;
      if (FMT[c.type]) cell.numFmt = FMT[c.type];
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT } };
      cell.border = { top: { style: 'medium', color: { argb: NAVY } } };
      cell.alignment = { horizontal: NUMERIC.has(c.type) ? 'right' : 'left' };
    });
  }
  if (rows.length) ws.autoFilter = { from: { row: hr, column: 1 }, to: { row: hr, column: cols.length } };
  cols.forEach((c, i) => { ws.getColumn(i + 1).width = Math.min(48, widths[i]); });
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  return ws;
}

const newWb = (ExcelJS) => { const wb = new ExcelJS.Workbook(); wb.creator = 'RAXER ERP'; wb.created = new Date(); return wb; };
function addDockSheet(wb, docks, maps, info) {
  const rows = dockRows(docks, maps.userName);
  return addSheet(wb, { name: 'Loading Dock', title: 'UPLOAD LOADING DOCK', info: [...info, DOCK_NOTE], cols: DOCK_COLS, rows, foot: dockFoot(docks), totalLabel: dockTotalLabel(docks, rows), groupBy: (r) => r._g });
}
const TOTAL_NOTE = 'TOTAL BEA = BBM + Toll + Parkir + Parkir Cash + Kuli Bongkar + Security.';

/**
 * Susun workbook sesuai kategori.
 * ctx: { trips, docks, master: { drivers, vehicles, fuel, destinations, dockOptions, profiles }, maps: { driver, vehicle, userName },
 *        info: string[] (periode, filter, pembuat) }
 */
export function buildReportWorkbook(ExcelJS, kind, ctx) {
  const wb = newWb(ExcelJS);
  const { trips = [], docks = [], master = {}, maps, info = [] } = ctx;
  if (kind === 'pengiriman') {
    addSheet(wb, { name: 'Pengiriman', title: 'DATA PENGIRIMAN', info: [...info, TOTAL_NOTE], cols: TRIP_COLS, rows: tripRows(trips, maps), foot: tripFoot(trips) });
  } else if (kind === 'biaya') {
    const r = rekapBiaya(trips, maps), foot = tripFoot(trips);
    addSheet(wb, { name: 'Rekap Armada', title: 'REKAP BIAYA LOGISTIC PER ARMADA', info: [...info, TOTAL_NOTE], cols: REKAP_ARMADA_COLS, rows: r.armada, foot });
    addSheet(wb, { name: 'Rekap Driver', title: 'REKAP BIAYA LOGISTIC PER DRIVER', info: [...info, 'Perjalanan berdua: jarak, liter, dan biaya dibagi rata ke kedua driver.'], cols: REKAP_DRIVER_COLS, rows: r.driver });
    addSheet(wb, { name: 'Rekap Bulanan', title: 'REKAP BIAYA LOGISTIC PER BULAN', info: [...info, TOTAL_NOTE], cols: REKAP_BULAN_COLS, rows: r.bulan, foot });
    addSheet(wb, { name: 'Komponen Biaya', title: 'KOMPOSISI BIAYA LOGISTIC', info, cols: KOMPONEN_COLS, rows: r.komponen });
  } else if (kind === 'performa') {
    const p = performa(trips, maps);
    addSheet(wb, { name: 'Performa Driver', title: 'PERFORMA DRIVER', info: [...info, 'KM/L = total jarak ÷ total liter (jarak & liter penuh per perjalanan, sama dengan tab PERFORMA). Biaya dibagi rata bila berdua.'], cols: PERF_DRIVER_COLS, rows: p.driver });
    addSheet(wb, { name: 'Performa Armada', title: 'PERFORMA ARMADA', info, cols: PERF_ARMADA_COLS, rows: p.armada, foot: tripFoot(trips) });
  } else if (kind === 'dock') {
    addDockSheet(wb, docks, maps, info);
  } else if (kind === 'master') {
    for (const s of MASTER_SHEETS) addSheet(wb, { name: s.name, title: s.name.toUpperCase(), info, cols: s.cols, rows: (master[s.id] || []).map(s.map) });
  } else {
    throw new Error(`Kategori laporan tidak dikenal: ${kind}`);
  }
  return wb;
}

/** Workbook "semua data" untuk dibaca manusia (isi sama dengan JSON di backup). */
export function buildFullWorkbook(ExcelJS, { trips, docks, master, maps, info = [] }) {
  const wb = newWb(ExcelJS);
  addSheet(wb, { name: 'Pengiriman', title: 'DATA PENGIRIMAN', info: [...info, TOTAL_NOTE], cols: TRIP_COLS, rows: tripRows(trips, maps), foot: tripFoot(trips) });
  addDockSheet(wb, docks, maps, info);
  for (const s of MASTER_SHEETS) addSheet(wb, { name: s.name, title: s.name.toUpperCase(), info, cols: s.cols, rows: (master[s.id] || []).map(s.map) });
  addSheet(wb, { name: 'User', title: 'USER', info, cols: USER_COLS, rows: userRows(master.profiles || []) });
  return wb;
}

export const xlsxBlob = async (wb) => new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

/**
 * ZIP backup: BACA-DULU.txt · excel/RAXER-DATA-LENGKAP.xlsx · json/<tabel>.json (isi mentah, termasuk path foto).
 * tables: { nama_tabel: rows[] | null } — null = tabel tidak bisa dibaca (dicatat di BACA-DULU).
 */
export async function buildBackupZip({ JSZip, ExcelJS }, { tables, trips, docks, master, maps, info, stamp, skipped = [] }) {
  const zip = new JSZip();
  const wb = buildFullWorkbook(ExcelJS, { trips, docks, master, maps, info });
  zip.file('excel/RAXER-DATA-LENGKAP.xlsx', await wb.xlsx.writeBuffer());
  const counts = [];
  for (const [name, rows] of Object.entries(tables)) {
    if (!rows) continue;
    zip.file(`json/${name}.json`, JSON.stringify(rows, null, 1));
    counts.push(`  - ${name}.json : ${rows.length} baris`);
  }
  zip.file('BACA-DULU.txt', [
    'BACKUP DATA RAXER ERP', `Dibuat : ${stamp}`, '',
    'ISI', '  excel/RAXER-DATA-LENGKAP.xlsx : seluruh data dalam satu file Excel (mudah dibaca & dianalisis).',
    '  json/*.json : salinan mentah tiap tabel — dipakai bila data perlu dipulihkan ke database.', ...counts, '',
    'CATATAN', '  - Foto TIDAK ikut di backup ini (ukurannya besar). Unduh foto lewat kategori "Foto Bukti (ZIP berfolder)".',
    '  - Kolom foto di data hanya berisi alamat (path) file di penyimpanan.',
    ...(skipped.length ? ['  - Tabel yang dilewati (tidak bisa dibaca): ' + skipped.join(', ')] : []),
    '  - Simpan file ini di tempat aman (mis. Google Drive / harddisk eksternal): berisi data operasional & email pengguna.', '',
  ].join('\r\n'));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

/** Simpan Blob sebagai unduhan di browser. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

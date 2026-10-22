// Ekspor tabel (ARMADA / BIAYA LOGISTIC) ke Excel (.xlsx).
// Isi = tabel di layar: kolom yang di-hide TIDAK ikut, urutan kolom sama, TOTAL BEA mengikuti pengaturan kolom,
// perataan sama, dan baris total di bawah (memakai rumus SUM supaya tetap hidup bila diedit di Excel).
import { jarak, kmPerL, liter, ritase } from './calc.js';
import { COL_LABEL, COST_COL, colAlign, colValue, totalOf } from './tableCols.js';

const NAVY = 'FF0F1B2D', LINE = 'FFD5DBE5', SOFT = 'FFF3F4F7';
const SUM_COLS = new Set(['jarak', 'total', 'ritase', ...Object.keys(COST_COL)]);
const INT_COLS = new Set(['km_awal', 'km_isi', 'km_akhir', 'jarak', 'ritase', 'total', ...Object.keys(COST_COL)]);

const colLetter = (n) => { let s = ''; for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s; return s; };
const toDate = (iso) => new Date(`${iso}T00:00:00Z`);

/** Nilai sel Excel untuk satu kolom. */
export function cellValue(id, t, dn, master, prefs) {
  switch (id) {
    case 'tanggal': return toDate(t.tanggal);
    case 'driver1': return dn(t.driver1_id);
    case 'driver2': return t.driver2_id ? dn(t.driver2_id) : '';
    case 'plat': return master.vehicle[t.vehicle_id]?.plat || '';
    case 'tujuan': return (t.tujuan || []).join(', ');
    case 'jarak': return jarak(t);
    case 'kml': return Math.round(kmPerL(t) * 100) / 100;
    case 'ritase': return ritase(t);
    case 'kartu': return String(t.kartu4 ?? '');
    case 'total': return totalOf(t, prefs);
    default: return colValue(id, t, prefs);
  }
}

/** Susun workbook (tanpa unduhan) — dipisah agar bisa dites. */
export function buildWorkbook(ExcelJS, { title, info = [], cols, rows, dn, master, prefs }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'RAXER ERP'; wb.created = new Date();
  const ws = wb.addWorksheet('Data', { views: [{ state: 'frozen', ySplit: 3 + info.length, xSplit: 0 }] });
  const last = cols.length;

  ws.getCell(1, 1).value = title; ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: NAVY } };
  info.forEach((line, i) => { const c = ws.getCell(2 + i, 1); c.value = line; c.font = { size: 10, color: { argb: 'FF627086' } }; });

  const hr = 3 + info.length;               // baris judul kolom
  const first = hr + 1, lastRow = hr + rows.length;
  const head = ws.getRow(hr);
  cols.forEach((id, i) => {
    const c = head.getCell(i + 1);
    c.value = COL_LABEL[id].toUpperCase();
    const al = colAlign(id);
    c.alignment = { horizontal: al === 'r' ? 'right' : al === 'c' ? 'center' : 'left', vertical: 'middle', wrapText: true };
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    c.border = { top: { style: 'thin', color: { argb: NAVY } }, bottom: { style: 'thin', color: { argb: NAVY } } };
  });
  head.height = 24;

  const widths = cols.map((id) => Math.max(COL_LABEL[id].length + 3, id === 'tujuan' ? 34 : id === 'tanggal' ? 13 : id === 'plat' ? 14 : 11));

  rows.forEach((t, r) => {
    const row = ws.getRow(first + r);
    cols.forEach((id, i) => {
      const c = row.getCell(i + 1);
      const v = cellValue(id, t, dn, master, prefs);
      c.value = v;
      const al = colAlign(id);
      c.alignment = { horizontal: al === 'r' ? 'right' : al === 'c' ? 'center' : 'left', vertical: 'top', wrapText: id === 'tujuan' };
      if (id === 'tanggal') c.numFmt = 'dd mmm yyyy';
      else if (id === 'kml') c.numFmt = '0.00';
      else if (id === 'kartu') c.numFmt = '@';
      else if (INT_COLS.has(id)) c.numFmt = '#,##0';
      if (id === 'jarak' || id === 'total') c.font = { bold: true };
      c.border = { bottom: { style: 'hair', color: { argb: LINE } } };
      if (typeof v === 'string' && id !== 'tujuan') widths[i] = Math.max(widths[i], v.length + 3);
    });
  });

  // baris total
  const tr = ws.getRow(lastRow + 1);
  const dist = rows.reduce((a, t) => a + jarak(t), 0), lt = rows.reduce((a, t) => a + liter(t), 0);
  cols.forEach((id, i) => {
    const c = tr.getCell(i + 1);
    const L = colLetter(i + 1);
    if (SUM_COLS.has(id) && rows.length) {
      const result = rows.reduce((a, t) => a + (+cellValue(id, t, dn, master, prefs) || 0), 0);
      c.value = { formula: `SUM(${L}${first}:${L}${lastRow})`, result };
      c.numFmt = '#,##0';
    } else if (id === 'kml') { c.value = Math.round((lt ? dist / lt : 0) * 100) / 100; c.numFmt = '0.00'; }
    else if (i === 0) c.value = `TOTAL (${rows.length} data)`;
    const al = colAlign(id);
    c.alignment = { horizontal: i === 0 && typeof c.value === 'string' ? 'left' : al === 'r' ? 'right' : al === 'c' ? 'center' : 'left' };
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SOFT } };
    c.border = { top: { style: 'medium', color: { argb: NAVY } } };
  });
  if (rows.length) ws.autoFilter = { from: { row: hr, column: 1 }, to: { row: hr, column: last } };

  cols.forEach((id, i) => { ws.getColumn(i + 1).width = Math.min(48, widths[i] + (INT_COLS.has(id) ? 2 : 0)); });
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  return wb;
}

/** Bangun + unduh .xlsx di browser (exceljs dimuat hanya saat tombol ditekan). */
export async function exportTableXlsx({ filename, ...opts }) {
  const ExcelJS = (await import('exceljs')).default;
  const buf = await buildWorkbook(ExcelJS, opts).xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

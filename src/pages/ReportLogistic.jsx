import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../auth.jsx';
import { useMaster, vehicleLabel } from '../lib/useMaster.js';
import { useStorageUsage } from '../lib/useStorageUsage.js';
import { fmtBytes } from '../lib/storageUsage.js';
import { monthISO, thisMonthRange, todayISO } from '../lib/format.js';
import { CATEGORIES, filterDock, filterTrips, periodOf } from '../lib/reportData.js';
import { buildBackupZip, buildReportWorkbook, downloadBlob, xlsxBlob } from '../lib/exportReports.js';
import { MB, planDockPhotos, planTripPhotos, runPhotoZip, sanitize, summarizePlan } from '../lib/photoZip.js';
import { PageHead, Toast, useToast } from '../components/ui.jsx';
import StoragePanel from '../components/StoragePanel.jsx';

const BACKUP_TABLES = ['profiles', 'drivers', 'vehicles', 'fuel_prices', 'destinations', 'trips', 'dock_options', 'dock_uploads', 'app_settings'];
const DATE_TYPES = [['semua', 'Semua data'], ['tahunan', 'Tahunan'], ['bulanan', 'Bulanan'], ['rentang', 'Rentang tanggal']];
const stampNow = () => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).format(new Date()).replace(/\./g, ':');
const fileStamp = () => `${todayISO()} ${new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).format(new Date()).replace(':', '')}`;

const Row = ({ label, htmlFor, children, hint }) => (
  <div className="rpt-row">
    <label htmlFor={htmlFor}>{label}</label>
    <div>{children}{hint && <small className="hint">{hint}</small>}</div>
  </div>
);

/** REPORT LOGISTIC — unduh / ekspor seluruh data (Excel, backup ZIP, foto ZIP berfolder) + pantau penyimpanan. Khusus owner (developer). */
export default function ReportLogistic() {
  const master = useMaster();
  const { profile } = useAuth();
  const storage = useStorageUsage(true);
  const [toast, say, clear] = useToast();

  const [cat, setCat] = useState('pengiriman');
  const [vehicle, setVehicle] = useState('');
  const [driver, setDriver] = useState('');
  const [photoSrc, setPhotoSrc] = useState('semua');
  const [dtype, setDtype] = useState('bulanan');
  const thisYear = +todayISO().slice(0, 4);
  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState(monthISO());
  const [range, setRange] = useState(thisMonthRange());
  const [users, setUsers] = useState([]);

  const [busy, setBusy] = useState('');                   // '' | 'build' | 'zip'
  const [msg, setMsg] = useState(null);                   // { kind: 'ok' | 'err', text }
  const [plan, setPlan] = useState(null);                 // rencana unduhan foto { entries, summary, estimate, baseName }
  const [prog, setProg] = useState(null);                 // { done, total, bytes, parts, failed }
  const [zipRes, setZipRes] = useState(null);
  const abort = useRef(null);

  useEffect(() => { api.listProfiles().then(setUsers).catch(() => {}); }, []);
  const meta = CATEGORIES.find((c) => c.id === cat);
  const uName = useMemo(() => { const m = Object.fromEntries(users.map((u) => [u.id, u.nama])); return (id) => m[id] || ''; }, [users]);
  useEffect(() => { setPlan(null); setZipRes(null); setMsg(null); }, [cat, vehicle, driver, photoSrc, dtype, year, month, range.from, range.to]);

  const period = useMemo(() => periodOf({ type: meta.date ? dtype : 'semua', year, month, range }), [meta.date, dtype, year, month, range]);
  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => thisYear - i), [thisYear]);
  const platOf = vehicle ? master.vehicle[vehicle]?.plat : '';
  const filterInfo = [
    `Periode: ${period.label}`,
    `Kendaraan: ${meta.vehicle && platOf ? platOf : 'Semua'}   ·   Driver: ${meta.driver && driver ? master.driver[driver]?.nama : 'Semua'}`,
    `Dibuat: ${stampNow()} WIB oleh ${profile?.nama || 'Owner'}`,
  ];
  const maps = { driver: master.driver, vehicle: master.vehicle, userName: uName };
  const fname = (ext) => `${sanitize(`RAXER - ${meta.label} - ${period.slug}`, 120)}.${ext}`;

  /** Ambil data sesuai kategori & filter. */
  const gather = async () => {
    const q = { from: period.from, to: period.to };
    const needTrips = ['pengiriman', 'biaya', 'performa'].includes(cat) || (cat === 'foto' && photoSrc !== 'dock');
    const needDock = cat === 'dock' || (cat === 'foto' && photoSrc !== 'pengiriman');
    const [trips, docks] = await Promise.all([needTrips ? api.listTripsAll(q) : [], needDock ? api.listDockAll(q) : []]);
    return { trips: filterTrips(trips, { vehicle: meta.vehicle ? vehicle : '', driver: meta.driver ? driver : '' }), docks: filterDock(docks, { plat: meta.vehicle ? platOf : '' }) };
  };

  const run = async () => {
    setMsg(null); setZipRes(null); setBusy('build');
    try {
      if (cat === 'foto') return await prepareFoto();
      if (cat === 'backup') return await doBackup();
      const ExcelJS = (await import('exceljs')).default;
      let data = { trips: [], docks: [], master: {} };
      let count = 0;
      if (cat === 'master') {
        const [fuel, dest, dockOpts] = await Promise.all([api.listFuel(), api.listDestinations().catch(() => []), api.listDockOptions().catch(() => [])]);
        data.master = { drivers: master.drivers, vehicles: master.vehicles, fuel, destinations: dest, dockOptions: dockOpts };
        count = master.drivers.length + master.vehicles.length + fuel.length + dest.length + dockOpts.length;
      } else {
        data = { ...data, ...(await gather()) };
        count = cat === 'dock' ? data.docks.length : data.trips.length;
      }
      if (!count) { setMsg({ kind: 'err', text: 'Tidak ada data pada periode / filter ini, jadi tidak ada file yang dibuat.' }); return; }
      const blob = await xlsxBlob(buildReportWorkbook(ExcelJS, cat, { ...data, maps, info: filterInfo }));
      downloadBlob(blob, fname('xlsx'));
      setMsg({ kind: 'ok', text: `${fname('xlsx')} — ${count.toLocaleString('id-ID')} baris (${fmtBytes(blob.size)}).` });
    } catch (e) { setMsg({ kind: 'err', text: e.message || 'Gagal membuat laporan' }); } finally { setBusy(''); }
  };

  const doBackup = async () => {
    const [ExcelJS, JSZip] = await Promise.all([import('exceljs').then((m) => m.default), import('jszip').then((m) => m.default)]);
    const tables = {}, skipped = [];
    for (const t of BACKUP_TABLES) { tables[t] = await api.listTable(t); if (!tables[t]) skipped.push(t); }
    const blob = await buildBackupZip({ JSZip, ExcelJS }, {
      tables, trips: tables.trips || [], docks: tables.dock_uploads || [], skipped, stamp: `${stampNow()} WIB`, maps,
      master: { drivers: tables.drivers || [], vehicles: tables.vehicles || [], fuel: tables.fuel_prices || [], destinations: tables.destinations || [], dockOptions: tables.dock_options || [], profiles: tables.profiles || [] },
      info: [`Backup seluruh data · dibuat ${stampNow()} WIB oleh ${profile?.nama || 'Owner'}`],
    });
    const name = `RAXER - Backup Data - ${fileStamp()}.zip`;
    downloadBlob(blob, name);
    setMsg({ kind: 'ok', text: `${name} — ${(tables.trips || []).length.toLocaleString('id-ID')} pengiriman, ${(tables.dock_uploads || []).length.toLocaleString('id-ID')} upload loading dock (${fmtBytes(blob.size)}).${skipped.length ? ` Dilewati: ${skipped.join(', ')}.` : ''}` });
  };

  const prepareFoto = async () => {
    const { trips, docks } = await gather();
    const entries = [...(photoSrc === 'dock' ? [] : planTripPhotos(trips, maps)), ...(photoSrc === 'pengiriman' ? [] : planDockPhotos(docks))];
    if (!entries.length) { setMsg({ kind: 'err', text: 'Tidak ada foto pada periode / filter ini.' }); return; }
    const avg = storage.usage?.photo_count ? storage.usage.storage_bytes / storage.usage.photo_count : 250 * 1024;
    setPlan({ entries, summary: summarizePlan(entries), estimate: avg * entries.length, trips: trips.length, docks: docks.length, baseName: `RAXER - Foto - ${period.slug}` });
  };

  const startZip = async () => {
    const JSZip = (await import('jszip')).default;
    const ac = new AbortController(); abort.current = ac;
    setBusy('zip'); setZipRes(null); setMsg(null); setProg({ done: 0, total: plan.entries.length, bytes: 0, parts: 0, failed: 0 });
    try {
      const res = await runPhotoZip({
        entries: plan.entries, JSZip, baseName: plan.baseName, signal: ac.signal, onProgress: setProg,
        fetchBlob: (src) => api.downloadPhoto(src),
        save: async (blob, name) => { downloadBlob(blob, name); await new Promise((r) => setTimeout(r, 600)); }, // jeda agar browser tidak memblokir unduhan beruntun
      });
      setZipRes(res);
    } catch (e) { setMsg({ kind: 'err', text: e.message || 'Unduhan foto gagal' }); } finally { setBusy(''); abort.current = null; }
  };

  const labelDate = dtype === 'tahunan' ? 'Pilih Tahun' : dtype === 'bulanan' ? 'Pilih Bulan' : dtype === 'rentang' ? 'Rentang Tanggal' : 'Pilih Periode';
  const disabledAll = <input value="All" disabled aria-label="Tidak berlaku" />;

  return (
    <>
      <PageHead title="REPORT LOGISTIC" />

      <section className="card rpt" aria-labelledby="rpt-title">
        <div className="rpt-h"><h2 id="rpt-title">Unduh Data Logistic</h2></div>

        <Row label="Pilih Kategori Report" htmlFor="rpt-cat" hint={meta.hint}>
          <select id="rpt-cat" value={cat} onChange={(e) => setCat(e.target.value)} disabled={Boolean(busy)}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Row>

        <Row label="Pilih Kendaraan" htmlFor="rpt-veh">
          {meta.vehicle ? (
            <select id="rpt-veh" value={vehicle} onChange={(e) => setVehicle(e.target.value)} disabled={Boolean(busy)}>
              <option value="">All</option>
              {master.vehicles.map((v) => <option key={v.id} value={v.id}>{vehicleLabel(v)}</option>)}
            </select>
          ) : disabledAll}
        </Row>

        <Row label="Pilih Driver" htmlFor="rpt-drv">
          {meta.driver ? (
            <select id="rpt-drv" value={driver} onChange={(e) => setDriver(e.target.value)} disabled={Boolean(busy)}>
              <option value="">All</option>
              {master.drivers.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
            </select>
          ) : disabledAll}
        </Row>

        <Row label="Sumber Foto" htmlFor="rpt-src" hint={meta.photos ? 'Struktur folder: Pengiriman / Tahun / Bulan / Plat / Pengiriman — Loading Dock / Tahun / Bulan / Jenis.' : undefined}>
          {meta.photos ? (
            <select id="rpt-src" value={photoSrc} onChange={(e) => setPhotoSrc(e.target.value)} disabled={Boolean(busy)}>
              <option value="semua">Semua (Pengiriman + Loading Dock)</option><option value="pengiriman">Foto Pengiriman saja</option><option value="dock">Foto Loading Dock saja</option>
            </select>
          ) : disabledAll}
        </Row>

        <Row label="Tipe Tanggal" htmlFor="rpt-dt">
          {meta.date ? (
            <select id="rpt-dt" value={dtype} onChange={(e) => setDtype(e.target.value)} disabled={Boolean(busy)}>
              {DATE_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          ) : <input value="Semua data" disabled aria-label="Tidak berlaku" />}
        </Row>

        <Row label={labelDate} htmlFor="rpt-period">
          {!meta.date || dtype === 'semua' ? <input value="All" disabled aria-label="Tidak berlaku" />
            : dtype === 'tahunan' ? <select id="rpt-period" value={year} onChange={(e) => setYear(+e.target.value)} disabled={Boolean(busy)}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
            : dtype === 'bulanan' ? <input id="rpt-period" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} disabled={Boolean(busy)} />
            : (
              <div className="rpt-range">
                <input id="rpt-period" type="date" aria-label="Dari tanggal" value={range.from} max={range.to} disabled={Boolean(busy)} onChange={(e) => e.target.value && setRange({ from: e.target.value, to: range.to < e.target.value ? e.target.value : range.to })} />
                <span>s.d.</span>
                <input type="date" aria-label="Sampai tanggal" value={range.to} min={range.from} disabled={Boolean(busy)} onChange={(e) => e.target.value && setRange({ from: range.from > e.target.value ? e.target.value : range.from, to: e.target.value })} />
              </div>
            )}
        </Row>

        <div className="rpt-actions">
          {msg && <p className={'rpt-msg ' + msg.kind} role={msg.kind === 'err' ? 'alert' : 'status'}>{msg.kind === 'ok' ? '✓ ' : ''}{msg.text}</p>}
          <button type="button" className="btn-dl" onClick={run} disabled={Boolean(busy) || master.loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 19.5h14" /></svg>
            {busy === 'build' ? 'Menyiapkan…' : meta.photos ? 'Periksa Foto' : 'Unduh'}
          </button>
        </div>

        {plan && (
          <div className="photo-plan" aria-live="polite">
            <h3>{plan.summary.files.toLocaleString('id-ID')} foto siap diunduh</h3>
            <ul>
              <li>{plan.trips.toLocaleString('id-ID')} pengiriman · {plan.docks.toLocaleString('id-ID')} upload loading dock · {plan.summary.folders.toLocaleString('id-ID')} folder</li>
              <li>Perkiraan ukuran ± {fmtBytes(plan.estimate)} {plan.estimate > 200 * MB ? `— dibagi jadi ± ${Math.ceil(plan.estimate / (200 * MB))} file ZIP (maks 200 MB per file)` : '— satu file ZIP'}</li>
              <li>Foto yang gagal diunduh dilewati dan dicatat di <code>_GAGAL.txt</code>; daftar semua foto ada di <code>_DAFTAR FOTO.csv</code>.</li>
            </ul>
            {busy === 'zip' && prog && (
              <div className="zip-prog">
                <div className="meter-t ok"><i style={{ width: `${(prog.done / prog.total) * 100}%` }} /></div>
                <small className="mono">{prog.done.toLocaleString('id-ID')} / {prog.total.toLocaleString('id-ID')} foto · {fmtBytes(prog.bytes)} · {prog.parts} file tersimpan{prog.failed ? ` · ${prog.failed} gagal` : ''}</small>
              </div>
            )}
            {zipRes && (
              <p className={'rpt-msg ' + (zipRes.aborted ? 'err' : 'ok')}>
                {zipRes.aborted ? `Dibatalkan. ${zipRes.parts} file ZIP sudah tersimpan; bagian yang belum lengkap tidak disimpan.`
                  : `✓ Selesai: ${zipRes.ok.toLocaleString('id-ID')} foto (${fmtBytes(zipRes.bytes)}) dalam ${zipRes.parts} file ZIP.${zipRes.failed.length ? ` ${zipRes.failed.length} foto gagal — lihat _GAGAL.txt.` : ''}`}
              </p>
            )}
            <div className="form-actions">
              {busy === 'zip' ? <button type="button" className="btn btn-danger" onClick={() => abort.current?.abort()}>BATALKAN</button>
                : <><button type="button" className="btn btn-ghost" onClick={() => { setPlan(null); setZipRes(null); }}>TUTUP</button>
                  <button type="button" className="btn btn-primary" onClick={startZip}>{zipRes ? 'UNDUH ULANG' : 'MULAI UNDUH ZIP'}</button></>}
            </div>
            {busy === 'zip' && <small className="muted">Biarkan tab ini tetap terbuka sampai selesai. Jika browser menanyakan izin unduh beberapa file, pilih Izinkan.</small>}
          </div>
        )}
      </section>

      <StoragePanel {...storage} say={say} />
      <Toast msg={toast.msg} kind={toast.kind} onDone={clear} />
    </>
  );
}

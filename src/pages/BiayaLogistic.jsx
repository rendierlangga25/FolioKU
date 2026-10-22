import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { jarak, liter, ritase } from '../lib/calc.js';
import { int, num, rangeLabel, rangeSlug } from '../lib/format.js';
import { exportTableXlsx } from '../lib/exportXlsx.js';
import { COL_LABEL, COST_COL, KEY_BIAYA, loadPrefs, savePrefs, summarizeBea, totalOf, visibleCols, visibleCostCols } from '../lib/tableCols.js';
import { useMaster, vehicleLabel } from '../lib/useMaster.js';
import { DateRangeFields, FitTable, PageHead, Stat, Toast, useDateRange, useToast } from '../components/ui.jsx';
import ColumnManager from '../components/ColumnManager.jsx';
import { Cell, Foot, colClass, csvCell } from '../components/CostCells.jsx';

/**
 * LOGISTIC › BIAYA LOGISTIC — tabel biaya seluruh pengiriman + tabel ringkasan.
 * Kolom bisa di-hide / diurutkan lewat "Atur kolom"; tabel ringkasan & TOTAL BEA ikut menyesuaikan.
 */
export default function BiayaLogistic() {
  const master = useMaster();
  const [range, setRange] = useDateRange();
  const [trips, setTrips] = useState(null);
  const [driverF, setDriverF] = useState('');
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('tabel');
  const [platF, setPlatF] = useState('');
  const [prefs, setPrefs] = useState(() => loadPrefs(KEY_BIAYA));
  const [colsOpen, setColsOpen] = useState(false);
  const [toast, say, clear] = useToast();

  const load = useCallback(() => {
    setTrips(null);
    api.listTrips(range).then(setTrips).catch((e) => { setTrips([]); say(e.message, 'err'); });
  }, [range]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(load, [load]);

  const dn = (id) => master.driver[id]?.nama || '—';
  const rows = useMemo(() => (trips || []).filter((t) =>
    (!platF || t.vehicle_id === platF) &&
    (!driverF || t.driver1_id === driverF || t.driver2_id === driverF) &&
    (!q || (t.tujuan || []).join(' ').toLowerCase().includes(q.toLowerCase()))), [trips, platF, driverF, q]);
  const tableRows = rows;
  const ritaseTotal = useMemo(() => rows.reduce((a, t) => a + ritase(t), 0), [rows]);
  const cols = visibleCols(prefs);
  const hiddenCost = prefs.hidden.some((id) => COST_COL[id]);

  const sum = useMemo(() => {
    const dist = tableRows.reduce((a, t) => a + jarak(t), 0);
    const lt = tableRows.reduce((a, t) => a + liter(t), 0);
    return { dist, kml: lt ? dist / lt : 0, bea: tableRows.reduce((a, t) => a + totalOf(t, prefs), 0) };
  }, [tableRows, prefs]);

  const [exporting, setExporting] = useState(false);
  const exportXlsx = async () => {
    setExporting(true);
    try {
      const plat = platF ? master.vehicle[platF]?.plat : 'Semua plat';
      await exportTableXlsx({
        filename: `biaya-logistic_${(platF ? plat : 'semua-plat').replace(/\s+/g, '-')}_${rangeSlug(range)}.xlsx`,
        title: 'BIAYA LOGISTIC',
        info: [`Periode: ${rangeLabel(range)}`, `No plat: ${plat}${driverF ? ` · Driver: ${dn(driverF)}` : ''}${q ? ` · Tujuan: ${q}` : ''}`],
        cols, rows: tableRows, dn, master, prefs,
      });
      say('File Excel dibuat');
    } catch (e) { say('Gagal membuat Excel: ' + e.message, 'err'); } finally { setExporting(false); }
  };


  return (
    <>
      <PageHead title="BIAYA LOGISTIC">
        <button className="btn btn-ghost" onClick={() => setColsOpen(true)}>ATUR KOLOM</button>
        <button className="btn btn-ghost" onClick={exportXlsx} disabled={exporting || tab === 'ringkasan' || !tableRows.length}>{exporting ? 'MEMBUAT…' : 'EKSPOR XLSX'}</button>
      </PageHead>

      <div className="filters">
        <DateRangeFields value={range} onChange={setRange} />
        <div><label>No plat</label>
          <select value={platF} onChange={(e) => setPlatF(e.target.value)}>
            <option value="">Semua plat</option>
            {master.vehicles.map((v) => <option key={v.id} value={v.id}>{v.plat}</option>)}
          </select></div>
        <div><label>Driver</label>
          <select value={driverF} onChange={(e) => setDriverF(e.target.value)}>
            <option value="">Semua driver</option>
            {master.drivers.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
          </select></div>
        <div><label>Cari tujuan</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="mis. SUNTER" /></div>
      </div>

      <div className="stats">
        <Stat label="Jumlah ritase" value={int(ritaseTotal)} sub={`${int(tableRows.length)} pengiriman`} />
        <Stat label="Total jarak" value={`${int(sum.dist)} km`} />
        <Stat label="Rata-rata KM/liter" value={num(sum.kml)} />
        <Stat label="Total Bea" value={`Rp ${int(sum.bea)}`} accent sub={hiddenCost && prefs.totalMode === 'visible' ? 'dari kolom yang tampil' : 'semua komponen biaya'} />
      </div>

      <div className="tabs" role="tablist">
        {[['tabel', 'Tabel data'], ['ringkasan', 'Ringkasan']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={'tabbtn' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {!trips || master.loading ? <div className="center"><div className="spinner" /></div> : tab === 'ringkasan' ? (
        <Ringkasan rows={rows} master={master} prefs={prefs} dn={dn} />
      ) : (
        <>
          <div className="tbl-tools">
            <small className="muted">{hiddenCost && prefs.totalMode === 'visible' ? 'Total Bea dihitung dari kolom nominal yang tampil.' : ''}</small>
          </div>
          {tableRows.length === 0 ? <p className="muted empty-line">Tidak ada data pada filter ini.</p> : (
            <FitTable>
              <table className="tbl sticky1">
                <thead><tr>{cols.map((id) => <th key={id} className={colClass(id)}>{COL_LABEL[id]}</th>)}</tr></thead>
                <tbody>
                  {tableRows.map((t) => (
                    <tr key={t.id}>{cols.map((id) => <Cell key={id} id={id} t={t} dn={dn} master={master} prefs={prefs} />)}</tr>
                  ))}
                </tbody>
                <tfoot><tr>{cols.map((id, i) => <Foot key={id} id={id} first={i === 0} n={tableRows.length} rows={tableRows} prefs={prefs} />)}</tr></tfoot>
              </table>
            </FitTable>
          )}
        </>
      )}

      {colsOpen && <ColumnManager prefs={prefs} onClose={() => setColsOpen(false)}
        onSave={(p) => { setPrefs(p); savePrefs(p, KEY_BIAYA); setColsOpen(false); say('Susunan kolom tersimpan'); }} />}
      <Toast msg={toast.msg} kind={toast.kind} onDone={clear} />
    </>
  );
}

/** Tabel ringkasan per NO PLAT dan per DRIVER. Kolom biaya yang di-hide ikut hilang dari sini. */
function Ringkasan({ rows, master, prefs, dn }) {
  const costIds = visibleCostCols(prefs);
  const byPlat = useMemo(() => summarizeBea(rows, 'plat', prefs).sort((a, b) => b.total - a.total), [rows, prefs]);
  const byDrv = useMemo(() => summarizeBea(rows, 'driver', prefs).sort((a, b) => b.total - a.total), [rows, prefs]);
  if (!rows.length) return <p className="muted empty-line">Tidak ada data untuk diringkas.</p>;

  const dist = rows.reduce((a, t) => a + jarak(t), 0);
  const lt = rows.reduce((a, t) => a + liter(t), 0);
  const overallKmL = lt ? dist / lt : 0;
  const T = (arr, pick) => arr.reduce((a, r) => a + pick(r), 0);

  // fungsi biasa (bukan komponen) agar tabel tidak dibuat ulang tiap render
  const table = ({ first, label, list, kmLTotal }) => (
    <FitTable>
      <table className="tbl sticky1">
        <thead><tr>
          <th className="l">{first}</th><th className="c">Pengiriman</th><th className="c">Ritase</th><th className="r">Jarak (km)</th><th className="r">KM/L</th>
          {costIds.map((id) => <th key={id} className="r">{COL_LABEL[id]}</th>)}
          <th className="r">Total Bea</th>
        </tr></thead>
        <tbody>{list.map((r) => (
          <tr key={r.id}>
            <td className="l">{label(r.id)}</td><td className="c mono">{int(r.kirim)}</td><td className="c mono">{int(r.ritase)}</td>
            <td className="r mono b">{num(r.jarak, 1)}</td><td className="r mono">{num(r.kmL)}</td>
            {costIds.map((id) => <td key={id} className="r mono">{int(r.costs[COST_COL[id]])}</td>)}
            <td className="r mono b">{int(r.total)}</td>
          </tr>))}
        </tbody>
        <tfoot><tr>
          <td className="l">Total</td><td className="c mono">{int(T(list, (r) => r.kirim))}</td><td className="c mono">{int(T(list, (r) => r.ritase))}</td>
          <td className="r mono">{num(T(list, (r) => r.jarak), 1)}</td><td className="r mono">{num(kmLTotal)}</td>
          {costIds.map((id) => <td key={id} className="r mono">{int(T(list, (r) => r.costs[COST_COL[id]]))}</td>)}
          <td className="r mono">{int(T(list, (r) => r.total))}</td>
        </tr></tfoot>
      </table>
    </FitTable>
  );

  return (
    <div className="summary">
      <section>
        <h3>Ringkasan per No Plat</h3>
        <p className="muted small">Pengiriman = jumlah input · Ritase = jumlah tujuan dalam pengiriman · KM/L = total jarak ÷ liter BBM.</p>
        {table({ first: 'No Plat', label: (id) => master.vehicle[id]?.plat || vehicleLabel(master.vehicle[id]), list: byPlat, kmLTotal: overallKmL })}
      </section>
      <section>
        <h3>Ringkasan per Driver</h3>
        <p className="muted small">Jarak, biaya &amp; KM/L dibagi 2 pada perjalanan berdua (KM/L berdua = separuh KM/L mobil); tidak dibagi bila jalan sendiri. Ritase = jumlah tujuan yang diikuti, tidak dibagi.</p>
        {table({ first: 'Driver', label: dn, list: byDrv, kmLTotal: overallKmL })}
      </section>
      <p className="muted small">Total Bea = {(prefs.totalMode === 'all' ? Object.keys(COST_COL) : costIds).map((id) => COL_LABEL[id]).join(' + ') || 'tidak ada kolom biaya yang tampil'}{prefs.totalMode === 'all' ? ' (mode: selalu semua komponen biaya).' : ' (mengikuti kolom yang tampil).'}</p>
    </div>
  );
}

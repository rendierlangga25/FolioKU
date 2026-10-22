import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../auth.jsx';
import { totalBiaya, bbmMatrix, dailyByVehicle, jarak, kmPerL, summarizeByDriver, summarizeByVehicle } from '../lib/calc.js';
import { fmtDate, int, num, rangeLabel, rangeSlug, rp } from '../lib/format.js';
import { exportTableXlsx } from '../lib/exportXlsx.js';
import { useMaster, vehicleLabel } from '../lib/useMaster.js';
import { DateRangeFields, FitTable, Modal, PageHead, Stat, Toast, useDateRange, useToast } from '../components/ui.jsx';
import TripForm from '../components/TripForm.jsx';
import PhotoGallery, { photoCount } from '../components/PhotoGallery.jsx';
import ColumnManager from '../components/ColumnManager.jsx';
import { COL_LABEL, COST_COL, loadPrefs, savePrefs, visibleCols } from '../lib/tableCols.js';
import { ritase } from '../lib/calc.js';
import { Cell, Foot, colClass, csvCell } from '../components/CostCells.jsx';

export default function Database() {
  const { isOwner } = useAuth();
  const master = useMaster();
  const [range, setRange] = useDateRange();
  const [trips, setTrips] = useState(null);
  const [driverF, setDriverF] = useState('');
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('tabel');
  const [platF, setPlatF] = useState('');
  const [prefs, setPrefs] = useState(loadPrefs);
  const [cols_open, setCols] = useState(false);
  const [sel, setSel] = useState(null);
  const [edit, setEdit] = useState(null);
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

  const sum = useMemo(() => tableRows.reduce((a, t) => ({
    bbm: a.bbm + (+t.bbm_rp || 0), jarak: a.jarak + jarak(t),
    liter: a.liter + (t.harga_liter > 0 ? t.bbm_rp / t.harga_liter : 0),
  }), { bbm: 0, jarak: 0, liter: 0 }), [tableRows]);

  const [exporting, setExporting] = useState(false);
  const exportXlsx = async () => {
    setExporting(true);
    try {
      const plat = platF ? master.vehicle[platF]?.plat : 'Semua plat';
      await exportTableXlsx({
        filename: `armada_${(platF ? plat : 'semua-plat').replace(/\s+/g, '-')}_${rangeSlug(range)}.xlsx`,
        title: 'ARMADA — DATA PENGIRIMAN',
        info: [`Periode: ${rangeLabel(range)}`, `No plat: ${plat}${driverF ? ` · Driver: ${dn(driverF)}` : ''}${q ? ` · Tujuan: ${q}` : ''}`],
        cols, rows: tableRows, dn, master, prefs,
      });
      say('File Excel dibuat');
    } catch (e) { say('Gagal membuat Excel: ' + e.message, 'err'); } finally { setExporting(false); }
  };

  const remove = async (t) => {
    if (!confirm('Hapus data ini? Tindakan tidak bisa dibatalkan.')) return;
    try { await api.deleteTrip(t.id); setSel(null); say('Data dihapus'); load(); } catch (e) { say(e.message, 'err'); }
  };

  return (
    <>
      <PageHead title="ARMADA">
        {isOwner && <button className="btn btn-ghost" onClick={() => setCols(true)}>ATUR KOLOM</button>}
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
        <Stat label="Total jarak" value={`${int(sum.jarak)} km`} />
        <Stat label="Total BBM" value={rp(sum.bbm)} />
        <Stat label="Rata-rata KM/liter" value={num(sum.liter ? sum.jarak / sum.liter : 0)} accent />
      </div>

      <div className="tabs" role="tablist">
        {[['tabel', 'Tabel data'], ['ringkasan', 'Ringkasan']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={'tabbtn' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {!trips ? <div className="center"><div className="spinner" /></div> : tab === 'ringkasan' ? <Summary rows={rows} master={master} /> : (
        <>
          <div className="tbl-tools">
            <small className="muted">{prefs.totalMode === 'visible' && prefs.hidden.some((id) => COST_COL[id]) ? 'Total Bea dihitung dari kolom nominal yang tampil.' : ''}</small>
          </div>
          {tableRows.length === 0 ? <p className="muted empty-line">Tidak ada data pada filter ini.</p> : (
            <FitTable>
              <table className="tbl sticky1">
                <thead><tr>
                  {cols.map((id) => <th key={id} className={colClass(id)}>{COL_LABEL[id]}</th>)}
                  <th className="r">Foto / detail</th>
                </tr></thead>
                <tbody>
                  {tableRows.map((t) => (
                    <tr key={t.id} onClick={() => setSel(t)} className="click">
                      {cols.map((id) => <Cell key={id} id={id} t={t} dn={dn} master={master} prefs={prefs} />)}
                      <td className="r">{(t.kendala_ket || (t.foto_kendala || []).length > 0) && <span className="chip warn" title="Ada kendala pengiriman">kendala</span>} <span className="link" title={photoCount(t) ? `${photoCount(t)} foto` : 'Detail'}>{photoCount(t) ? `${photoCount(t)} foto ›` : '›'}</span></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr>
                  {cols.map((id, i) => <Foot key={id} id={id} first={i === 0} n={tableRows.length} rows={tableRows} prefs={prefs} />)}
                  <td></td>
                </tr></tfoot>
              </table>
            </FitTable>
          )}
        </>
      )}

      {cols_open && <ColumnManager prefs={prefs} onClose={() => setCols(false)} onSave={(p) => { setPrefs(p); savePrefs(p); setCols(false); say('Susunan kolom tersimpan'); }} />}
      {sel && !edit && <Detail t={sel} master={master} isOwner={isOwner} onClose={() => setSel(null)} onEdit={() => setEdit(sel)} onDelete={() => remove(sel)} />}
      {edit && (
        <Modal title="Ubah data" wide onClose={() => setEdit(null)}>
          <TripForm master={master} initial={edit} onCancel={() => setEdit(null)} onSaved={() => { setEdit(null); setSel(null); say('Perubahan tersimpan'); load(); }} />
        </Modal>
      )}
      <Toast msg={toast.msg} kind={toast.kind} onDone={clear} />
    </>
  );
}

function Detail({ t, master, isOwner, onClose, onEdit, onDelete }) {
  const v = master.vehicle[t.vehicle_id];
  const n = t.driver2_id ? 2 : 1;
  const L = (k, val) => <div className="kv"><small>{k}</small><b>{val}</b></div>;
  return (
    <Modal title={`${fmtDate(t.tanggal)} · ${vehicleLabel(v)}`} onClose={onClose}>
      <div className="kvs">
        {L('Driver', [t.driver1_id, t.driver2_id].filter(Boolean).map((id) => master.driver[id]?.nama).join(' & '))}
        {L('Tujuan', (t.tujuan || []).join(' → '))}
        {L('KM awal / isi / akhir', `${int(t.km_awal)} / ${int(t.km_isi)} / ${int(t.km_akhir)}`)}
        {L('Total jarak', `${int(jarak(t))} km${n === 2 ? ` (per driver ${num(jarak(t) / 2, 1)} km)` : ''}`)}
        {L('BBM', `${rp(t.bbm_rp)} @ ${rp(t.harga_liter)}/L = ${num(t.bbm_rp / t.harga_liter)} L`)}
        {L('KM / liter', num(kmPerL(t)))}
        {L('Tol · Parkir', `${rp(t.tol_rp)} · ${rp(t.parkir_rp)}`)}
        {L('Parkir cash · Kuli bongkar · Security', `${rp(t.parkir_cash_rp || 0)} · ${rp(t.kuli_bongkar_rp || 0)} · ${rp(t.security_rp || 0)}`)}
        {L('Ritase', `${ritase(t)} tujuan`)}
        {L('Total biaya', rp(totalBiaya(t)))}
        {L('No kartu', t.kartu4)}
        {t.kendala_ket && L('Kendala', t.kendala_ket)}
      </div>
      <PhotoGallery trip={t} />
      {isOwner && <div className="form-actions"><button className="btn btn-danger" onClick={onDelete}>Hapus</button><button className="btn btn-primary" onClick={onEdit}>Ubah</button></div>}
    </Modal>
  );
}

function Summary({ rows, master }) {
  const byV = summarizeByVehicle(rows).sort((a, b) => b.total - a.total);
  const byD = summarizeByDriver(rows).sort((a, b) => b.bbm - a.bbm);
  const mx = bbmMatrix(rows);
  const daily = dailyByVehicle(rows);
  const vName = (id) => vehicleLabel(master.vehicle[id]);
  const dName = (id) => master.driver[id]?.nama || '—';
  const colV = byV.map((v) => v.id);
  const T = (arr, k) => arr.reduce((a, x) => a + x[k], 0);
  if (!rows.length) return <p className="muted empty-line">Tidak ada data untuk diringkas.</p>;

  return (
    <div className="summary">
      <section>
        <h3>Ringkasan per mobil</h3>
        <p className="muted small">*Biaya lain = parkir cash + kuli bongkar + security.</p>
        <p className="muted small">Total jarak = Σ (KM akhir − KM awal). KM/liter = total jarak ÷ (BBM ÷ harga per liter).</p>
        <FitTable><table className="tbl sticky1">
          <thead><tr><th>Mobil</th><th className="r">Input</th><th className="r">Total tujuan</th><th className="r">Total jarak (km)</th><th className="r">Total BBM</th><th className="r">Tol</th><th className="r">Parkir</th><th className="r">Biaya lain*</th><th className="r">Total biaya</th><th className="r">Liter</th><th className="r">KM/liter</th></tr></thead>
          <tbody>{byV.map((v) => (
            <tr key={v.id}><td>{vName(v.id)}</td><td className="r mono">{int(v.ritase)}</td><td className="r mono">{int(v.tujuan)}</td><td className="r mono b">{int(v.jarak)}</td>
              <td className="r mono">{int(v.bbm)}</td><td className="r mono">{int(v.tol)}</td><td className="r mono">{int(v.parkir)}</td><td className="r mono">{int(v.total - v.bbm - v.tol - v.parkir)}</td><td className="r mono b">{int(v.total)}</td>
              <td className="r mono">{num(v.liter)}</td><td className="r mono">{num(v.kmL)}</td></tr>))}</tbody>
          <tfoot><tr><td>Total</td><td className="r mono">{int(T(byV, 'ritase'))}</td><td className="r mono">{int(T(byV, 'tujuan'))}</td><td className="r mono">{int(T(byV, 'jarak'))}</td>
            <td className="r mono">{int(T(byV, 'bbm'))}</td><td className="r mono">{int(T(byV, 'tol'))}</td><td className="r mono">{int(T(byV, 'parkir'))}</td><td className="r mono">{int(T(byV, 'total') - T(byV, 'bbm') - T(byV, 'tol') - T(byV, 'parkir'))}</td><td className="r mono">{int(T(byV, 'total'))}</td>
            <td className="r mono">{num(T(byV, 'liter'))}</td><td className="r mono">{num(T(byV, 'liter') ? T(byV, 'jarak') / T(byV, 'liter') : 0)}</td></tr></tfoot>
        </table></FitTable>
      </section>

      <section>
        <h3>Ringkasan per driver</h3>
        <p className="muted small">Jarak, BBM, liter dan KM/liter dibagi dua bila mobil dijalankan 2 driver (KM/L 2 driver = separuh KM/L mobil); tidak dibagi bila jalan sendiri.</p>
        <FitTable><table className="tbl sticky1">
          <thead><tr><th>Driver</th><th className="r">Keikutsertaan</th><th className="r">Jarak (km)</th><th className="r">Total BBM</th><th className="r">Liter</th><th className="r">KM/liter</th><th className="r">Tol</th><th className="r">Parkir</th><th className="r">Biaya lain*</th><th className="r">Total biaya</th></tr></thead>
          <tbody>{byD.map((d) => (
            <tr key={d.id}><td>{dName(d.id)}</td><td className="r mono">{int(d.ritase)}</td><td className="r mono b">{num(d.jarak, 1)}</td><td className="r mono b">{int(d.bbm)}</td>
              <td className="r mono">{num(d.liter)}</td><td className="r mono">{num(d.kmL)}</td><td className="r mono">{int(d.tol)}</td><td className="r mono">{int(d.parkir)}</td><td className="r mono">{int(d.total - d.bbm - d.tol - d.parkir)}</td><td className="r mono">{int(d.total)}</td></tr>))}</tbody>
          <tfoot><tr><td>Total</td><td></td><td className="r mono">{num(T(byD, 'jarak'), 1)}</td><td className="r mono">{int(T(byD, 'bbm'))}</td><td className="r mono">{num(T(byD, 'liter'))}</td>
            <td className="r mono">{num(T(byD, 'liter') ? T(byD, 'jarak') / T(byD, 'liter') : 0)}</td><td className="r mono">{int(T(byD, 'tol'))}</td><td className="r mono">{int(T(byD, 'parkir'))}</td><td className="r mono">{int(T(byD, 'total') - T(byD, 'bbm') - T(byD, 'tol') - T(byD, 'parkir'))}</td><td className="r mono">{int(T(byD, 'total'))}</td></tr></tfoot>
        </table></FitTable>
      </section>

      <section>
        <h3>Pembelian BBM per mobil & per driver</h3>
        <FitTable><table className="tbl sticky1">
          <thead><tr><th>Driver</th>{colV.map((id) => <th key={id} className="r">{vName(id)}</th>)}<th className="r">Total driver</th></tr></thead>
          <tbody>{byD.map((d) => (
            <tr key={d.id}><td>{dName(d.id)}</td>{colV.map((id) => <td key={id} className="r mono">{mx.cell.get(`${d.id}|${id}`) ? int(mx.cell.get(`${d.id}|${id}`)) : <span className="muted">–</span>}</td>)}
              <td className="r mono b">{int(mx.rowTot.get(d.id) || 0)}</td></tr>))}</tbody>
          <tfoot><tr><td>Total mobil</td>{colV.map((id) => <td key={id} className="r mono">{int(mx.colTot.get(id) || 0)}</td>)}<td className="r mono">{int(mx.grand)}</td></tr></tfoot>
        </table></FitTable>
      </section>

      <section>
        <h3>Rekap harian per mobil</h3>
        <p className="muted small">Total jarak per tanggal per mobil, beserta pembagian per driver.</p>
        <FitTable><table className="tbl sticky1">
          <thead><tr><th>Tanggal</th><th>Mobil</th><th className="r">Tujuan</th><th className="r">Total jarak</th><th>Jarak per driver</th><th className="r">BBM</th><th>BBM per driver</th><th className="r">KM/liter</th></tr></thead>
          <tbody>{daily.map((d) => (
            <tr key={d.key}><td>{fmtDate(d.tanggal)}</td><td>{vName(d.vehicle_id)}</td><td className="r mono">{d.tujuan}</td><td className="r mono b">{int(d.jarak)}</td>
              <td className="wrap small">{[...d.perDriver].map(([id, p]) => `${dName(id)} ${num(p.jarak, 1)}`).join(' · ')}</td>
              <td className="r mono">{int(d.bbm)}</td>
              <td className="wrap small">{[...d.perDriver].map(([id, p]) => `${dName(id)} ${int(p.bbm)}`).join(' · ')}</td>
              <td className="r mono">{num(d.kmL)}</td></tr>))}</tbody>
        </table></FitTable>
      </section>
    </div>
  );
}

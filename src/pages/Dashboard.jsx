import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { byDriver, byVehicle, composition, kpi, topDestinations, trend, COST_META } from '../lib/logisticStats.js';
import { fmtDate, fmtLongDate, int, num, rp } from '../lib/format.js';
import { useMaster, vehicleLabel } from '../lib/useMaster.js';
import { DateRangeFields, PageHead, Stat, useDateRange } from '../components/ui.jsx';
import { ChartCard, HBars, SERIES, StackedHBars, TimeChart, compact } from '../components/Charts.jsx';
import { useAuth } from '../auth.jsx';

const COLOR_OF = Object.fromEntries(COST_META.map((m, i) => [m.key, SERIES[i]]));

export default function Dashboard() {
  const { profile, isOwner, can } = useAuth();
  const master = useMaster();
  const [range, setRange] = useDateRange();
  const [trips, setTrips] = useState(null);
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('ringkasan');

  useEffect(() => { if (isOwner) api.listProfiles().then(setUsers).catch(() => {}); }, [isOwner]);
  useEffect(() => {
    let alive = true; setTrips(null);
    api.listTrips(range).then((r) => alive && setTrips(r)).catch(() => alive && setTrips([]));
    return () => { alive = false; };
  }, [range]);

  const waiting = users.filter((u) => u.role !== 'owner' && u.active && !Object.values(u.permissions || {}).some(Boolean));

  return (
    <>
      <PageHead title={`Halo, ${profile?.nama || 'Developer'}`} sub={fmtLongDate()}>
        {can('database_driver') && <Link className="btn btn-primary" to="/app/armada">BUKA ARMADA</Link>}
      </PageHead>

      {waiting.length > 0 && (
        <p className="note">{waiting.length} pengguna menunggu akses ({waiting.map((u) => u.nama).join(', ')}). <Link to="/app/user">Atur akses →</Link></p>
      )}

      <div className="filters"><DateRangeFields value={range} onChange={setRange} /></div>

      <div className="tabs" role="tablist">
        {[['ringkasan', 'RINGKASAN'], ['logistic', 'LOGISTIC']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={'tabbtn' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {!trips || master.loading ? <div className="center"><div className="spinner" /></div>
        : tab === 'logistic' ? <Logistic trips={trips} range={range} master={master} />
        : <Ringkasan trips={trips} master={master} />}
    </>
  );
}

/* ───────────── TAB RINGKASAN ───────────── */
function Ringkasan({ trips, master }) {
  const k = useMemo(() => kpi(trips), [trips]);
  const byV = useMemo(() => byVehicle(trips), [trips]);
  const byD = useMemo(() => byDriver(trips), [trips]);
  const comp = useMemo(() => composition(trips).filter((c) => c.value > 0).sort((a, b) => b.value - a.value), [trips]);
  const plat = (id) => master.vehicle[id]?.plat || '—';
  const dname = (id) => master.driver[id]?.nama || '—';

  if (!trips.length) return <p className="muted empty-line">Belum ada data pengiriman pada rentang tanggal ini.</p>;

  const maxV = Math.max(1, ...byV.map((v) => v.total));
  const maxD = Math.max(1, ...byD.map((d) => d.total));
  const bestV = [...byV].filter((v) => v.kmL > 0).sort((a, b) => b.kmL - a.kmL)[0];
  const bestD = byD.filter((d) => d.kmL > 0)[0]; // byDriver sudah urut KM/L tertinggi
  const topV = byV[0];

  return (
    <div className="ringk">
      <div className="stats">
        <Stat label="Total biaya logistic" value={rp(k.total)} sub={`BBM ${rp(k.bbm)} · lainnya ${rp(k.nonBbm)}`} />
        <Stat label="Total jarak" value={`${int(k.jarak)} km`} sub={`${int(k.trips)} pengiriman · ${int(k.ritase)} tujuan`} />
        <Stat label="BBM terpakai" value={`${num(k.liter, 1)} L`} sub={rp(k.bbm)} />
        <Stat label="Rata-rata KM/liter" value={num(k.kmL)} sub={`Biaya per km ${rp(k.perKm)}`} accent />
      </div>

      <div className="ringk-hi">
        <div><small>Armada termahal</small><b>{topV ? plat(topV.id) : '—'}</b><span>{topV ? rp(topV.total) : ''}</span></div>
        <div><small>Armada paling hemat</small><b>{bestV ? plat(bestV.id) : '—'}</b><span>{bestV ? `${num(bestV.kmL)} KM/L` : ''}</span></div>
        <div><small>Driver paling efisien</small><b>{bestD ? dname(bestD.id) : '—'}</b><span>{bestD ? `${num(bestD.kmL)} KM/L` : ''}</span></div>
        <div><small>Pengiriman berkendala</small><b>{int(k.kendala)}</b><span>{k.trips ? `${num((k.kendala / k.trips) * 100, 1)}% dari pengiriman` : ''}</span></div>
      </div>

      <div className="dash-grid">
        <section className="card">
          <h3 className="card-t">Komposisi biaya</h3>
          <div className="comp-bar" role="img" aria-label="Komposisi biaya">
            {comp.map((c) => <i key={c.key} style={{ width: `${c.pct * 100}%`, background: COLOR_OF[c.key] }} title={`${c.label} ${num(c.pct * 100, 1)}%`} />)}
          </div>
          <ul className="comp-list">
            {comp.map((c) => (
              <li key={c.key}><span className="dot" style={{ background: COLOR_OF[c.key] }} /><span className="cl">{c.label}</span><b className="mono">{rp(c.value)}</b><small className="mono">{num(c.pct * 100, 1)}%</small></li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h3 className="card-t">Biaya per armada</h3>
          {byV.map((v) => (
            <div className="bar" key={v.id}>
              <div className="bar-l"><span>{vehicleLabel(master.vehicle[v.id])}</span><b className="mono">{rp(v.total)}</b></div>
              <div className="bar-t"><i style={{ width: `${(v.total / maxV) * 100}%` }} /></div>
              <small>{int(v.trips)} pengiriman · {int(v.jarak)} km · {num(v.kmL)} KM/L · {rp(v.perKm)}/km</small>
            </div>
          ))}
        </section>

        <section className="card wide">
          <h3 className="card-t">Rekap per driver</h3>
          <div className="tablewrap">
            <table className="tbl compact">
              <thead><tr><th>Driver</th><th className="r"><span className="hd-long">Pengiriman</span><span className="hd-short">Kirim</span></th><th className="r"><span className="hd-long">Jarak (km)</span><span className="hd-short">Km</span></th><th className="r">KM/L</th><th className="r">Biaya</th><th className="bcol">Porsi biaya</th></tr></thead>
              <tbody>{[...byD].sort((a, b) => b.total - a.total).map((d) => (
                <tr key={d.id}>
                  <td>{dname(d.id)}</td><td className="r mono">{int(d.trips)}</td><td className="r mono">{num(d.jarak, 1)}</td>
                  <td className="r mono">{num(d.kmL)}</td><td className="r mono b">{rp(d.total)}</td>
                  <td className="bcol"><div className="bar-t"><i style={{ width: `${(d.total / maxD) * 100}%` }} /></div></td>
                </tr>))}</tbody>
            </table>
          </div>
          <p className="muted small">Jarak dan biaya dibagi rata pada perjalanan berdua. KM/L per driver = KM/L perjalanan.</p>
        </section>
      </div>
    </div>
  );
}

/* ───────────── TAB LOGISTIC ───────────── */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const shortDate = (iso) => `${iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]}`;
const xLabel = (d, long) => (long ? (d.weekly ? `Minggu ${fmtDate(d.key)}` : fmtDate(d.key)) : shortDate(d.key));

function Logistic({ trips, range, master }) {
  const k = useMemo(() => kpi(trips), [trips]);
  const comp = useMemo(() => composition(trips), [trips]);
  const tr = useMemo(() => trend(trips, range), [trips, range]);
  const vs = useMemo(() => byVehicle(trips), [trips]);
  const ds = useMemo(() => byDriver(trips), [trips]);
  const dest = useMemo(() => topDestinations(trips, 8), [trips]);
  const plat = (id) => master.vehicle[id]?.plat || '—';
  const dname = (id) => master.driver[id]?.nama || '—';
  const costSeries = COST_META.map((m) => ({ key: m.key, label: m.label, color: COLOR_OF[m.key] }));
  const unit = tr[0]?.weekly ? 'minggu' : 'hari';

  if (!trips.length) return <p className="muted empty-line">Belum ada data pengiriman pada rentang tanggal ini.</p>;

  const th = (arr) => <thead><tr>{arr.map((a, i) => <th key={a} className={i ? 'r' : ''}>{a}</th>)}</tr></thead>;
  return (
    <div className="logi">
      <div className="stats">
        <Stat label="Pengiriman" value={int(k.trips)} sub={`${int(k.kendala)} berkendala`} />
        <Stat label="Total tujuan" value={int(k.ritase)} sub="jumlah tujuan seluruh pengiriman" />
        <Stat label="Total jarak" value={`${int(k.jarak)} km`} />
        <Stat label="BBM terpakai" value={`${num(k.liter, 1)} L`} sub={`${rp(k.bbm)}`} />
        <Stat label="Total biaya logistic" value={rp(k.total)} sub={`BBM ${rp(k.bbm)} · lainnya ${rp(k.nonBbm)}`} />
        <Stat label="Biaya per KM" value={rp(k.perKm)} />
        <Stat label="Biaya per pengiriman" value={rp(k.perTrip)} />
        <Stat label="Rata-rata KM/liter" value={num(k.kmL)} accent />
      </div>

      <ChartCard wide title={`Tren biaya logistic per ${unit}`} sub="Setiap batang = total biaya, dipecah per komponen." legend={costSeries}
        table={<table className="tbl compact">{th(['Tanggal', 'Pengiriman', ...COST_META.map((m) => m.label), 'Total'])}<tbody>{tr.map((d) => (
          <tr key={d.key}><td>{xLabel(d, true)}</td><td className="r mono">{d.trips}</td>{COST_META.map((m) => <td key={m.key} className="r mono">{int(d[m.key])}</td>)}<td className="r mono b">{int(d.total)}</td></tr>))}</tbody></table>}>
        <TimeChart data={tr} series={costSeries} kind="bars" fmt={(v) => rp(v)} xLabel={xLabel} />
      </ChartCard>

      <div className="chart-grid">
        <ChartCard title="Komposisi biaya" sub="Porsi tiap komponen terhadap total biaya."
          table={<table className="tbl compact">{th(['Komponen', 'Rp', '%'])}<tbody>{comp.map((c) => <tr key={c.key}><td>{c.label}</td><td className="r mono">{int(c.value)}</td><td className="r mono">{num(c.pct * 100, 1)}%</td></tr>)}</tbody></table>}>
          <HBars rows={comp.map((c) => ({ label: c.label, value: c.value, color: COLOR_OF[c.key], sub: `${num(c.pct * 100, 1)}% dari total` }))} fmt={(v) => rp(v)} />
        </ChartCard>

        <ChartCard title="Biaya per armada" sub="Total biaya tiap plat, dipecah per komponen." legend={costSeries}
          table={<table className="tbl compact">{th(['Plat', 'Pengiriman', 'Jarak (km)', 'KM/L', 'Total biaya', 'Biaya/km'])}<tbody>{vs.map((v) => (
            <tr key={v.id}><td className="mono">{plat(v.id)}</td><td className="r mono">{v.trips}</td><td className="r mono">{int(v.jarak)}</td><td className="r mono">{num(v.kmL)}</td><td className="r mono b">{int(v.total)}</td><td className="r mono">{int(v.perKm)}</td></tr>))}</tbody></table>}>
          <StackedHBars rows={vs.map((v) => ({ label: plat(v.id), parts: COST_META.map((m) => ({ label: m.label, value: v[m.key], color: COLOR_OF[m.key] })) }))} fmt={(v) => rp(v)} />
        </ChartCard>

        <ChartCard title={`Jarak tempuh per ${unit}`} sub="Total kilometer seluruh armada."
          table={<table className="tbl compact">{th(['Tanggal', 'Jarak (km)'])}<tbody>{tr.map((d) => <tr key={d.key}><td>{xLabel(d, true)}</td><td className="r mono">{int(d.jarak)}</td></tr>)}</tbody></table>}>
          <TimeChart data={tr} series={[{ key: 'jarak', label: 'Jarak', color: SERIES[0] }]} kind="line" fmt={(v) => `${int(v)} km`} xLabel={xLabel} height={200} />
        </ChartCard>

        <ChartCard title={`KM/liter per ${unit}`} sub="Efisiensi BBM armada (jarak ÷ liter)."
          table={<table className="tbl compact">{th(['Tanggal', 'KM/L'])}<tbody>{tr.map((d) => <tr key={d.key}><td>{xLabel(d, true)}</td><td className="r mono">{d.kmL ? num(d.kmL) : '—'}</td></tr>)}</tbody></table>}>
          <TimeChart data={tr} series={[{ key: 'kmL', label: 'KM/L', color: SERIES[2] }]} kind="line" fmt={(v) => num(v)} tickFmt={(v) => num(v, 1)} xLabel={xLabel} height={200} />
        </ChartCard>

        <ChartCard title="Efisiensi per armada" sub="KM/L tiap plat — makin tinggi makin hemat."
          table={<table className="tbl compact">{th(['Plat', 'KM/L', 'Liter', 'Jarak (km)'])}<tbody>{[...vs].sort((a, b) => b.kmL - a.kmL).map((v) => <tr key={v.id}><td className="mono">{plat(v.id)}</td><td className="r mono b">{num(v.kmL)}</td><td className="r mono">{num(v.liter, 1)}</td><td className="r mono">{int(v.jarak)}</td></tr>)}</tbody></table>}>
          <HBars rows={[...vs].sort((a, b) => b.kmL - a.kmL).map((v) => ({ label: plat(v.id), value: v.kmL, sub: `${int(v.jarak)} km · ${num(v.liter, 1)} L` }))} fmt={(v) => num(v)} />
        </ChartCard>

        <ChartCard title="Efisiensi per driver" sub="KM/L tiap driver (jarak & BBM dibagi rata bila berdua)."
          table={<table className="tbl compact">{th(['Driver', 'Pengiriman', 'Jarak (km)', 'KM/L', 'Biaya'])}<tbody>{ds.map((d) => <tr key={d.id}><td>{dname(d.id)}</td><td className="r mono">{d.trips}</td><td className="r mono">{num(d.jarak, 1)}</td><td className="r mono b">{num(d.kmL)}</td><td className="r mono">{int(d.total)}</td></tr>)}</tbody></table>}>
          <HBars rows={ds.map((d) => ({ label: dname(d.id), value: d.kmL, color: SERIES[2], sub: `${d.trips} pengiriman · ${num(d.jarak, 1)} km` }))} fmt={(v) => num(v)} />
        </ChartCard>

        <ChartCard title="Biaya per driver" sub="Total biaya logistic yang ditanggung tiap driver (dibagi rata bila berdua)."
          table={<table className="tbl compact">{th(['Driver', 'Pengiriman', 'Biaya'])}<tbody>{[...ds].sort((a, b) => b.total - a.total).map((d) => <tr key={d.id}><td>{dname(d.id)}</td><td className="r mono">{d.trips}</td><td className="r mono b">{int(d.total)}</td></tr>)}</tbody></table>}>
          <HBars rows={[...ds].sort((a, b) => b.total - a.total).map((d) => ({ label: dname(d.id), value: d.total, color: SERIES[1], sub: `${d.trips} pengiriman` }))} fmt={(v) => rp(v)} />
        </ChartCard>

        <ChartCard title="Tujuan terbanyak" sub="Jumlah kunjungan per tujuan."
          table={<table className="tbl compact">{th(['Tujuan', 'Kunjungan'])}<tbody>{dest.map((d) => <tr key={d.label}><td>{d.label}</td><td className="r mono">{d.value}</td></tr>)}</tbody></table>}>
          <HBars rows={dest} fmt={(v) => `${int(v)}×`} color={SERIES[3]} />
        </ChartCard>
      </div>
    </div>
  );
}

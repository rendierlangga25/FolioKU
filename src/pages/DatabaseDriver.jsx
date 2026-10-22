import { Fragment, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { useMaster, useTrips, monthRange } from '../data.js'
import { distance, kmPerLiter, driverKmPerLiter, summarizeByVehicle, summarizeByDriver } from '../lib/calc.js'
import { rupiah, num, shortDate, todayJakarta } from '../lib/format.js'

async function openPhoto(path) {
  const { data } = await supabase.storage.from('km-photos').createSignedUrl(path, 300)
  if (data?.signedUrl) window.open(data.signedUrl, '_blank')
}

export default function DatabaseDriver() {
  const [ym, setYm] = useState(todayJakarta().slice(0, 7))
  const [vf, setVf] = useState('')
  const [tab, setTab] = useState('ringkasan')
  const { drivers, vehicles } = useMaster()
  const { trips: all, loading, reload } = useTrips(monthRange(ym))
  const trips = useMemo(() => (vf ? all.filter((t) => t.vehicle_id === vf) : all), [all, vf])
  const dName = Object.fromEntries(drivers.map((d) => [d.id, d.name]))
  const vById = Object.fromEntries(vehicles.map((v) => [v.id, v]))
  const byVeh = summarizeByVehicle(trips, vehicles, drivers)
  const byDrv = summarizeByDriver(trips, drivers)
  const grand = { fuel: trips.reduce((s, t) => s + +t.fuel_amount, 0), toll: trips.reduce((s, t) => s + +t.toll_amount, 0),
    parking: trips.reduce((s, t) => s + +t.parking_amount, 0), total: trips.reduce((s, t) => s + +t.total_cost, 0),
    dist: trips.reduce((s, t) => s + distance(t), 0), dest: trips.reduce((s, t) => s + t.destinations.length, 0) }

  const del = async (id) => { if (confirm('Hapus data perjalanan ini?')) { await supabase.from('trips').delete().eq('id', id); reload() } }
  const csv = () => {
    const head = ['Tanggal','Mobil','Plat','Driver 1','Driver 2','Tujuan','BBM','Tol','Parkir','Total','Kartu','KM Awal','KM Isi','KM Akhir','Jarak','KM/L']
    const rows = trips.map((t) => [t.trip_date, vById[t.vehicle_id]?.name, vById[t.vehicle_id]?.plate, dName[t.driver1_id], dName[t.driver2_id] || '',
      t.destinations.join(' | '), t.fuel_amount, t.toll_amount, t.parking_amount, t.total_cost, t.card_last4, t.km_start, t.km_fill, t.km_end, distance(t), kmPerLiter(t).toFixed(2)])
    const body = [head, ...rows].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: 'text/csv' })); a.download = `database-driver-${ym}.csv`; a.click()
  }

  return (
    <div className="page wide">
      <div className="page-head">
        <div><p className="eyebrow">Developer</p><h1>Database Driver</h1></div>
        <div className="filters">
          <input type="month" value={ym} onChange={(e) => setYm(e.target.value)} />
          <select value={vf} onChange={(e) => setVf(e.target.value)}><option value="">Semua mobil</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.plate}</option>)}</select>
          <button className="btn ghost sm" onClick={csv}>⬇ CSV</button>
        </div>
      </div>

      <div className="kpis">
        <div><span>Total perjalanan</span><b className="mono">{trips.length}</b></div>
        <div><span>Total tujuan</span><b className="mono">{grand.dest}</b></div>
        <div><span>Total jarak</span><b className="mono">{num(grand.dist)} km</b></div>
        <div className="hl"><span>Total beli BBM</span><b className="mono">{rupiah(grand.fuel)}</b></div>
        <div><span>Tol + parkir</span><b className="mono">{rupiah(grand.toll + grand.parking)}</b></div>
      </div>

      <div className="tabs">
        <button className={tab === 'ringkasan' ? 'on' : ''} onClick={() => setTab('ringkasan')}>Ringkasan</button>
        <button className={tab === 'tabel' ? 'on' : ''} onClick={() => setTab('tabel')}>Tabel data</button>
      </div>
      {loading && <p className="muted">Memuat…</p>}

      {tab === 'ringkasan' && !loading && (<>
        <h3>Ringkasan per mobil</h3>
        <div className="scroll"><table className="tbl">
          <thead><tr><th>Mobil</th><th className="r">Perjalanan</th><th className="r">Total tujuan</th><th className="r">Total jarak (km)</th><th className="r">KM/L</th><th className="r">Total beli BBM</th><th className="r">Tol</th><th className="r">Parkir</th><th className="r">Total biaya</th></tr></thead>
          <tbody>
            {byVeh.map((r) => (<Fragment key={r.vehicle.id}>
              <tr className="strong"><td><b>{r.vehicle.name}</b><small>{r.vehicle.plate} · {r.vehicle.fuel_type}</small></td>
                <td className="r mono">{r.trips}</td><td className="r mono">{r.destinations}</td><td className="r mono">{num(r.distance)}</td>
                <td className="r mono">{num(r.kmPerLiter, 2)}</td><td className="r mono">{rupiah(r.fuel)}</td><td className="r mono">{rupiah(r.toll)}</td><td className="r mono">{rupiah(r.parking)}</td><td className="r mono">{rupiah(r.total)}</td></tr>
              {r.drivers.map((d) => (
                <tr key={r.vehicle.id + d.id} className="sub"><td>↳ {d.name}</td><td className="r mono">{d.trips}</td><td />
                  <td className="r mono">{num(d.distance, 1)}</td><td className="r mono">{num(d.kmPerLiter, 2)}</td><td className="r mono">{rupiah(d.fuel)}</td><td colSpan={3} /></tr>
              ))}
            </Fragment>))}
            {!byVeh.length && <tr><td colSpan={9} className="muted center">Belum ada data.</td></tr>}
          </tbody>
          {!!byVeh.length && <tfoot><tr><td>TOTAL</td><td className="r mono">{trips.length}</td><td className="r mono">{grand.dest}</td><td className="r mono">{num(grand.dist)}</td><td />
            <td className="r mono">{rupiah(grand.fuel)}</td><td className="r mono">{rupiah(grand.toll)}</td><td className="r mono">{rupiah(grand.parking)}</td><td className="r mono">{rupiah(grand.total)}</td></tr></tfoot>}
        </table></div>
        <p className="muted sm">Baris “↳ driver” = bagian tiap driver: jarak, BBM, dan KM/L dibagi 2 pada perjalanan yang dijalani berdua; tidak dibagi bila jalan sendiri.</p>

        <h3 className="mt">Ringkasan per driver (semua mobil)</h3>
        <div className="scroll"><table className="tbl">
          <thead><tr><th>Driver</th><th className="r">Perjalanan</th><th className="r">Tujuan</th><th className="r">Total jarak (km)</th><th className="r">Rata KM/L</th><th className="r">Total beli BBM</th></tr></thead>
          <tbody>
            {byDrv.map((r) => <tr key={r.driver.id}><td><b>{r.driver.name}</b></td><td className="r mono">{r.trips}</td><td className="r mono">{r.destinations}</td><td className="r mono">{num(r.distance, 1)}</td><td className="r mono">{num(r.kmPerLiter, 2)}</td><td className="r mono">{rupiah(r.fuel)}</td></tr>)}
            {!byDrv.length && <tr><td colSpan={6} className="muted center">Belum ada data.</td></tr>}
          </tbody>
          {!!byDrv.length && <tfoot><tr><td>TOTAL</td><td className="r mono">{byDrv.reduce((s, r) => s + r.trips, 0)}</td><td className="r mono">{byDrv.reduce((s, r) => s + r.destinations, 0)}</td>
            <td className="r mono">{num(byDrv.reduce((s, r) => s + r.distance, 0), 1)}</td><td /><td className="r mono">{rupiah(byDrv.reduce((s, r) => s + r.fuel, 0))}</td></tr></tfoot>}
        </table></div>
      </>)}

      {tab === 'tabel' && !loading && (
        <div className="scroll"><table className="tbl dense">
          <thead><tr><th>Tanggal</th><th>Mobil</th><th>Driver 1</th><th>Driver 2</th><th>Tujuan</th><th className="r">BBM</th><th className="r">Tol</th><th className="r">Parkir</th><th className="r">Total</th><th>Kartu</th>
            <th className="r">KM awal</th><th className="r">KM isi</th><th className="r">KM akhir</th><th className="r">Jarak</th><th className="r">KM/L</th><th>Foto</th><th /></tr></thead>
          <tbody>
            {trips.map((t) => (
              <tr key={t.id}><td className="nowrap">{shortDate(t.trip_date)}</td><td className="nowrap">{vById[t.vehicle_id]?.name}<small>{vById[t.vehicle_id]?.plate}</small></td>
                <td>{dName[t.driver1_id]}</td><td>{dName[t.driver2_id] || '–'}</td><td>{t.destinations.join(', ')}</td>
                <td className="r mono">{rupiah(t.fuel_amount)}</td><td className="r mono">{rupiah(t.toll_amount)}</td><td className="r mono">{rupiah(t.parking_amount)}</td><td className="r mono"><b>{rupiah(t.total_cost)}</b></td>
                <td className="mono">•••• {t.card_last4}</td><td className="r mono">{num(t.km_start)}</td><td className="r mono">{num(t.km_fill)}</td><td className="r mono">{num(t.km_end)}</td>
                <td className="r mono">{num(distance(t))}</td><td className="r mono">{num(kmPerLiter(t), 2)}{t.driver2_id && <small>/driver {num(driverKmPerLiter(t), 2)}</small>}</td>
                <td className="nowrap">{[['km_start_photo', 'A'], ['km_fill_photo', 'I'], ['km_end_photo', 'K']].map(([k, l]) => t[k] && <button key={k} className="chip" onClick={() => openPhoto(t[k])}>{l}</button>)}</td>
                <td><button className="icon-btn" onClick={() => del(t.id)} aria-label="Hapus">🗑</button></td></tr>
            ))}
            {!trips.length && <tr><td colSpan={17} className="muted center">Belum ada data.</td></tr>}
          </tbody>
        </table></div>
      )}
    </div>
  )
}

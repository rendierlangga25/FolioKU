import { useState } from 'react'
import { useMaster, useTrips, monthRange } from '../data.js'
import { summarizeByDriver } from '../lib/calc.js'
import { num, todayJakarta, shortDate } from '../lib/format.js'

// Papan progres: semua driver bisa melihat progres driver lain (memicu semangat bersaing)
export default function Progress() {
  const [ym, setYm] = useState(todayJakarta().slice(0, 7))
  const { drivers } = useMaster()
  const { trips, loading } = useTrips(monthRange(ym))
  const rows = summarizeByDriver(trips, drivers).sort((a, b) => b.distance - a.distance)
  const max = Math.max(1, ...rows.map((r) => r.distance))
  const dName = Object.fromEntries(drivers.map((d) => [d.id, d.name]))
  return (
    <div className="page">
      <div className="page-head">
        <div><p className="eyebrow">Papan progres</p><h1>Siapa paling jalan bulan ini?</h1></div>
        <input type="month" value={ym} onChange={(e) => setYm(e.target.value)} />
      </div>
      {loading ? <p className="muted">Memuat…</p> : !rows.length ? <p className="muted">Belum ada data bulan ini.</p> : (
        <div className="board">
          {rows.map((r, i) => (
            <div className={'rank r' + (i + 1)} key={r.driver.id}>
              <span className="pos mono">{i + 1}</span>
              <div className="rank-main">
                <div className="rank-top"><b>{r.driver.name}</b><span className="mono">{num(r.distance, 1)} km</span></div>
                <div className="bar"><i style={{ width: (r.distance / max) * 100 + '%' }} /></div>
                <div className="rank-meta"><span>{r.trips} perjalanan</span><span>{r.destinations} tujuan</span><span>KM/L {num(r.kmPerLiter, 2)}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
      <h3 className="mt">Aktivitas terbaru</h3>
      <ul className="feed">
        {trips.slice(0, 8).map((t) => (
          <li key={t.id}><span className="mono">{shortDate(t.trip_date)}</span>
            <b>{dName[t.driver1_id]}{t.driver2_id ? ' & ' + dName[t.driver2_id] : ''}</b>
            <span className="muted">→ {t.destinations.join(', ')}</span></li>
        ))}
      </ul>
    </div>
  )
}

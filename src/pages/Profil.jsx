import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { useMaster } from '../lib/useMaster.js';
import { useDriverStats } from '../lib/useStats.js';
import { api } from '../lib/api.js';
import { int, monthISO, num, rangeLabel, todayISO } from '../lib/format.js';
import { MIN_TRIPS_RANK, TIERS, TIER_DAYS, TRIPS_PER_TIER, XP_PER_TIER, XP_PER_TRIP, fxLevel, tierOf } from '../lib/tiers.js';
import { driverYear, effBadges, hallOfFame, rankList, tierHistory } from '../lib/rank.js';
import { Avatar, EffBadge, TierBadge, ymLabel } from '../components/Tier.jsx';
import AvatarPicker from '../components/AvatarPicker.jsx';
import { DateRangeFields, Toast, useDateRange, useToast } from '../components/ui.jsx';

/** Isi tab PROFIL & PERFORMA di dalam menu DRIVER. tab: 'profil' | 'performa'; viewId: profil driver lain yang sedang dibuka. */
export default function ProfilPanel({ tab, viewId, go }) {
  const { profile } = useAuth();
  const master = useMaster();
  const { rows, err } = useDriverStats();
  if (master.loading || !rows) return <div className="center"><div className="spinner" /></div>;
  return (
    <>
      {err && <p className="note">{err}</p>}
      {tab === 'performa'
        ? <Performa rows={rows} master={master} myId={profile?.driver_id} onOpen={(id) => go({ tab: 'profil', d: id })} />
        : <Kartu rows={rows} master={master} driverId={viewId || profile?.driver_id} myId={profile?.driver_id} onBack={viewId ? () => go({ tab: 'performa' }) : null} />}
    </>
  );
}

const nowYm = () => monthISO();

/* ───────────────────────── TAB PROFIL ───────────────────────── */
function Kartu({ rows, master, driverId, myId, onBack }) {
  const { isOwner } = useAuth();
  const [toast, say, clear] = useToast();
  const [busy, setBusy] = useState(false);
  const d = master.driver[driverId];
  const year = nowYm().slice(0, 4);
  const cur = useMemo(() => (d ? driverYear(rows, d.id, year) : null), [rows, d, year]);
  const hist = useMemo(() => (d ? tierHistory(rows, d.id, year) : []), [rows, d, year]);
  const badges = useMemo(() => (d ? effBadges(rows, d.id, nowYm()) : []), [rows, d]);

  if (!d) {
    return (
      <div className="empty-state" style={{ margin: '8vh auto' }}>
        <h2>BELUM TERHUBUNG KE DATA DRIVER</h2>
        <p className="muted">Akun ini belum ditautkan ke data driver. Minta developer menyamakan nama akun Anda dengan nama driver (menu USER / MASTER DATA). Sementara itu Anda tetap bisa melihat profil driver lain lewat tab PERFORMA.</p>
      </div>
    );
  }
  const T = tierOf(cur.tier); const own = d.id === myId; const canEdit = own || isOwner;

  const savePhoto = async (foto) => {
    setBusy(true);
    try { await (own ? api.setMyPhoto(foto) : api.saveDriver({ id: d.id, nama: d.nama, aktif: d.aktif, foto })); await master.reload(); say(foto ? 'Foto profil tersimpan' : 'Foto profil dihapus'); }
    catch (e) { say(e.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <div className="profil">
      {onBack && <button className="btn btn-ghost btn-sm back" onClick={onBack}>← KEMBALI KE PERFORMA</button>}

      <section className={`hero tier-${cur.tier} fx${fxLevel(cur.tier)}`} data-tier={T.name}>
        <div className="hero-av">
          <AvatarPicker photo={d.foto} canEdit={canEdit} busy={busy} onChange={savePhoto}>
            <Avatar driver={d} tier={cur.tier} size={148} />
          </AvatarPicker>
          <TierBadge n={cur.tier} size={84} className="hero-badge" />
        </div>
        <div className="hero-info">
          <span className="tier-chip">TIER {cur.tier} · {T.name}</span>
          <h2>{d.nama_lengkap || d.nama}</h2>
          <dl className="idgrid">
            <div><dt>ID KARYAWAN</dt><dd>{d.id_karyawan || '—'}</dd></div>
            <div><dt>DEPARTEMEN</dt><dd>{d.departemen || '—'}</dd></div>
            <div><dt>JABATAN</dt><dd>{d.jabatan || '—'}</dd></div>
          </dl>

          <div className="xp">
            <div className="xp-top"><b>XP {year}</b><span>{cur.top ? 'TIER TERTINGGI' : `${cur.inTier} / ${XP_PER_TIER} XP`}</span></div>
            <div className="xp-bar"><i style={{ width: `${cur.pct}%` }} /></div>
            <small>{cur.top ? `Total ${int(cur.xp)} XP tahun ini.`
              : `${cur.tripsToNext} pengiriman lagi → TIER ${cur.tier + 1} ${tierOf(cur.tier + 1).name}.`}</small>
          </div>
          {badges.some((b) => !b.provisional) || badges.length ? <div className="hero-badges">{badges.slice(0, 3).map((b) => <EffBadge key={b.ym} size={44} ym={b.ym} provisional={b.provisional} />)}</div> : null}
        </div>
      </section>

      <section className="card">
        <h3 className="card-t">PERJALANAN TIER {year}</h3>
        <div className="tier-path">
          {TIERS.map((t) => (
            <div key={t.n} className={'tp' + (t.n < cur.tier ? ' done' : t.n === cur.tier ? ' now' : '')}>
              <TierBadge n={t.n} size={52} /><small>{t.name}</small>
            </div>
          ))}
        </div>
        <p className="muted small rules">
          {XP_PER_TRIP} XP setiap pengiriman selesai · {XP_PER_TIER} XP naik 1 tier ({TRIPS_PER_TIER} pengiriman, target ±{TIER_DAYS} hari) · tier direset tiap 1 Januari, riwayat tahun lalu tetap tersimpan.
        </p>
      </section>

      <div className="two-col">
        <section className="card">
          <h3 className="card-t">LENCANA PALING EFISIEN</h3>
          {badges.length === 0 ? <p className="muted empty-line">Belum ada. Jadi nomor 1 KM/L terbaik dalam sebulan (minimal {MIN_TRIPS_RANK} pengiriman) untuk mendapatkannya.</p> : (
            <div className="eff-grid">{badges.map((b) => (
              <div key={b.ym} className="eff-item"><EffBadge size={64} ym={b.ym} provisional={b.provisional} /><b className="mono">{num(b.kmL)} KM/L</b></div>
            ))}</div>
          )}
        </section>
        <section className="card">
          <h3 className="card-t">RIWAYAT TIER</h3>
          <table className="tbl"><thead><tr><th className="c">TAHUN</th><th className="l">TIER AKHIR</th><th className="r">XP</th><th className="r">PENGIRIMAN</th></tr></thead>
            <tbody>{hist.map((h) => (
              <tr key={h.year}>
                <td className="c mono b">{h.year}{h.year === year && <small className="sub-km">BERJALAN</small>}</td>
                <td className="l"><span className="tier-inline"><TierBadge n={h.tier} size={30} />{tierOf(h.tier).name}</span></td>
                <td className="r mono">{int(h.xp)}</td><td className="r mono">{int(h.trips)}</td>
              </tr>))}</tbody>
          </table>
        </section>
      </div>
      <Toast msg={toast.msg} kind={toast.kind} onDone={clear} />
    </div>
  );
}

/* ───────────────────────── TAB PERFORMA ───────────────────────── */
function Performa({ rows, master, myId, onOpen }) {
  const [range, setRange] = useDateRange();
  const [rs, setRs] = useState(null);
  const year = nowYm().slice(0, 4);
  useEffect(() => {
    let alive = true; setRs(null);
    api.driverRangeStats(range.from, range.to).then((r) => alive && setRs(r)).catch(() => alive && setRs([]));
    return () => { alive = false; };
  }, [range]);
  const days = Math.round((new Date(range.to) - new Date(range.from)) / 86400000) + 1;
  const minTrips = days >= 20 ? MIN_TRIPS_RANK : 1;
  const lb = useMemo(() => rankList(rs || [], minTrips), [rs, minTrips]);
  const hof = useMemo(() => hallOfFame(rows, nowYm()).slice(0, 12), [rows]);
  const tierFor = (id) => driverYear(rows, id, year).tier;
  const top = lb.ranked.filter((x) => x.rank === 1);
  const provisional = range.to >= todayISO();

  const Row = ({ x, i }) => {
    const d = master.driver[x.driver_id]; if (!d) return null;
    const t = tierFor(d.id);
    return (
      <button className={'rk' + (x.rank <= 3 ? ` top${x.rank}` : '') + (d.id === myId ? ' me' : '')} onClick={() => onOpen(d.id)}>
        <span className="rk-n">{x.rank ?? '–'}</span>
        <Avatar driver={d} tier={t} size={46} />
        <span className="rk-who"><b>{d.nama_lengkap || d.nama}</b><small>{d.jabatan || 'DRIVER'}{d.id === myId ? ' · ANDA' : ''}</small></span>
        <span className="rk-tier"><TierBadge n={t} size={34} /><small>{tierOf(t).name}</small></span>
        <span className="rk-s"><small>PENGIRIMAN</small><b className="mono">{int(x.trips)}</b></span>
        <span className="rk-s"><small>JARAK</small><b className="mono">{int(x.jarak)} KM</b></span>
        <span className="rk-s kml"><small>KM/L</small><b className="mono">{x.rank ? num(x.kmL) : '—'}</b></span>
      </button>
    );
  };

  return (
    <div className="performa">
      <div className="subhead">
        <p className="muted">PERINGKAT EFISIENSI BBM — KM/L = TOTAL JARAK ÷ LITER BBM. MINIMAL {minTrips} PENGIRIMAN PADA RENTANG TANGGAL{minTrips === 1 ? ' (RENTANG PENDEK)' : ''}. KLIK DRIVER UNTUK MELIHAT PROFILNYA.</p>
      </div>
      <div className="filters"><DateRangeFields value={range} onChange={setRange} /></div>

      {top.length > 0 && (
        <section className="champ">
          <EffBadge size={92} provisional={provisional} />
          <div>
            <small>PALING EFISIEN · {rangeLabel(range)}{provisional ? ' (SEMENTARA)' : ''}</small>
            <h2>{top.map((x) => master.driver[x.driver_id]?.nama_lengkap || master.driver[x.driver_id]?.nama).join(' & ')}</h2>
            <b className="mono">{num(top[0].kmL)} KM/L</b>
          </div>
        </section>
      )}

      <section className="card rank-card">
        <h3 className="card-t">PERINGKAT {rangeLabel(range)}</h3>
        {!rs && <div className="center"><div className="spinner" /></div>}
        {rs && lb.ranked.length === 0 && lb.unranked.length === 0 && <p className="muted empty-line">Belum ada pengiriman pada rentang tanggal ini.</p>}
        {lb.ranked.length === 0 && lb.unranked.length > 0 && <p className="muted small">Belum ada driver dengan minimal {minTrips} pengiriman.</p>}
        <div className="rk-list">{lb.ranked.map((x, i) => <Row key={x.driver_id} x={x} i={i} />)}</div>
        {lb.unranked.length > 0 && (<>
          <h4 className="rk-sub">BELUM MASUK PERINGKAT (&lt; {minTrips} PENGIRIMAN)</h4>
          <div className="rk-list">{lb.unranked.map((x, i) => <Row key={x.driver_id} x={{ ...x, rank: null }} i={i} />)}</div>
        </>)}
      </section>

      <section className="card">
        <h3 className="card-t">JUARA EFISIEN TIAP BULAN</h3>
        {hof.length === 0 ? <p className="muted empty-line">Belum ada data.</p> : (
          <div className="hof">{hof.map((m) => (
            <div key={m.ym} className="hof-i">
              <EffBadge size={46} provisional={m.provisional} />
              <small>{ymLabel(m.ym)}</small>
              <b>{m.winners.map((w) => master.driver[w.driver_id]?.nama).filter(Boolean).join(' & ')}</b>
              <span className="mono">{num(m.winners[0].kmL)} KM/L</span>
            </div>))}</div>
        )}
      </section>
    </div>
  );
}

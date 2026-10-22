import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../auth.jsx';
import { jarak, kmPerL, kmPerLDriver } from '../lib/calc.js';
import { fmtDate, int, num, rp } from '../lib/format.js';
import { DateRangeFields, Toast, useDateRange, useToast } from '../components/ui.jsx';
import { useMaster, vehicleLabel } from '../lib/useMaster.js';
import AvatarPicker from '../components/AvatarPicker.jsx';
import Ic from '../components/MiniIcons.jsx';
import { SISA_BBM_TYPES } from '../lib/permissions.js';

const dataUrlToBlob = async (d) => (await fetch(d)).blob();

/** Foto sisa bar bensin di sisi kanan kartu. Ketuk → LIHAT / UPLOAD / HAPUS (alur sama dengan foto profil: geser & zoom). */
function SisaBbmPhoto({ trip, canEdit, onChanged, say }) {
  const { session } = useAuth();
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true; setUrl(null);
    if (trip.foto_sisa_bbm) api.photoUrl(trip.foto_sisa_bbm).then((u) => alive && setUrl(u)).catch(() => {});
    return () => { alive = false; };
  }, [trip.foto_sisa_bbm]);

  const change = async (dataUrl) => {
    setBusy(true);
    try {
      const path = dataUrl ? await api.uploadPhoto(await dataUrlToBlob(dataUrl), session.user.id, 'sisa_bbm') : null;
      await api.setTripSisaBbm(trip.id, path);
      onChanged(trip.id, path);
      say(path ? 'Foto sisa bar bensin tersimpan' : 'Foto dihapus');
    } catch (e) { say(e.message, 'err'); } finally { setBusy(false); }
  };

  const tile = (
    <span className={'sisa-tile' + (trip.foto_sisa_bbm ? ' has' : '')}>
      {trip.foto_sisa_bbm
        ? (url ? <img src={url} alt="Sisa bar bensin" /> : <span className="spinner sm" />)
        : <span className="sisa-empty"><Ic n="cam" /><b>{canEdit ? 'FOTO SISA BAR BENSIN' : 'BELUM ADA FOTO'}</b></span>}
    </span>
  );
  return (
    <div className="sisa">
      <small>Sisa bar bensin</small>
      <AvatarPicker photo={url} canEdit={canEdit} busy={busy} onChange={change} className="sisa-pick" label="FOTO SISA BAR BENSIN" stamp
        cropHint="Geser foto, atur zoom sampai bar bensin terlihat jelas di tengah." out={640} deleteNote="Foto bisa diunggah ulang kapan saja">
        {tile}
      </AvatarPicker>
    </div>
  );
}

/** RIWAYAT — terbuka untuk semua user: input seluruh driver + filter nama driver & plat. Foto sisa bar bensin: DRIVER, ADMIN, SPV. */
export default function Riwayat() {
  const { session, seeAllHistory, isOwner, profile } = useAuth();
  const tipe = profile?.user_type || 'DRIVER';
  // upload foto sisa bar bensin di semua pengiriman pada riwayat: owner, SPV, ADMIN, LEADER, DRIVER
  const canPhoto = () => isOwner || SISA_BBM_TYPES.includes(tipe);
  const [toast, say, clear] = useToast();
  const master = useMaster();
  const [range, setRange] = useDateRange();
  const [rows, setRows] = useState(null);
  const [driverF, setDriverF] = useState('');
  const [platF, setPlatF] = useState('');

  useEffect(() => {
    setRows(null);
    const q = seeAllHistory ? { ...range } : { ...range, mine: true, uid: session.user.id };
    api.listTrips(q).then(setRows).catch(() => setRows([]));
  }, [range, session.user.id, seeAllHistory]);

  const onChanged = useCallback((id, path) => setRows((l) => (l || []).map((t) => (t.id === id ? { ...t, foto_sisa_bbm: path } : t))), []);
  const shown = useMemo(() => (rows || []).filter((t) =>
    (!driverF || t.driver1_id === driverF || t.driver2_id === driverF) && (!platF || t.vehicle_id === platF)), [rows, driverF, platF]);

  return (
    <>
      <p className="muted subnote">{seeAllHistory ? 'Data input seluruh driver.' : 'Data yang Anda input sendiri.'}</p>
      <div className="filters">
        <DateRangeFields value={range} onChange={setRange} />
        {seeAllHistory && (
          <>
            <div><label>Nama driver</label>
              <select value={driverF} onChange={(e) => setDriverF(e.target.value)}>
                <option value="">Semua driver</option>
                {master.drivers.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
              </select></div>
            <div><label>Plat mobil</label>
              <select value={platF} onChange={(e) => setPlatF(e.target.value)}>
                <option value="">Semua plat</option>
                {master.vehicles.map((v) => <option key={v.id} value={v.id}>{v.plat}</option>)}
              </select></div>
          </>
        )}
      </div>
      {!rows || master.loading ? <div className="center"><div className="spinner" /></div> : shown.length === 0 ? (
        <p className="muted empty-line">{rows.length ? 'Tidak ada data yang cocok dengan filter.' : 'Belum ada data pada rentang tanggal ini.'}</p>
      ) : (
        <>
          {seeAllHistory && <p className="hist-sum">{int(shown.length)} pengiriman{driverF || platF ? ' (terfilter)' : ''}</p>}
          <div className="cards">
            {shown.map((t) => (
              <article className="hist" key={t.id}>
                <div className="hist-main">
                  <div className="hist-h"><b>{fmtDate(t.tanggal)}</b><span className="chip">{vehicleLabel(master.vehicle[t.vehicle_id])}</span></div>
                  <p className="hist-d">{[t.driver1_id, t.driver2_id].filter(Boolean).map((id) => master.driver[id]?.nama).join(' & ')}</p>
                  <p className="hist-t">{(t.tujuan || []).join(' → ')}</p>
                  <div className="hist-g">
                    <div><small>Jarak</small><b className="mono">{int(jarak(t))} km</b></div>
                    <div><small>KM/L</small><b className="mono">{num(kmPerL(t))}</b></div>
                    <div><small>Total</small><b className="mono">{rp(t.total_rp)}</b></div>
                  </div>
                  {t.driver2_id && <p className="hist-split">Bagian per driver: <b className="mono">{num(jarak(t) / 2, 1)} km · {num(kmPerLDriver(t))} KM/L</b></p>}
                  {(t.kendala_ket || (t.foto_kendala || []).length > 0) && <p className="hist-split warn-t">⚠ Kendala: {t.kendala_ket || 'ada foto kendala'}</p>}
                </div>
                <SisaBbmPhoto trip={t} canEdit={canPhoto(t)} onChanged={onChanged} say={say} />
              </article>
            ))}
          </div>
        </>
      )}
      <Toast msg={toast.msg} kind={toast.kind} onDone={clear} />
    </>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useMaster } from '../lib/useMaster.js';
import { useDockOptions } from '../lib/useDockOptions.js';
import { FitTable, Modal, MoneyInput, PageHead, Toast, useToast } from '../components/ui.jsx';
import { Avatar } from '../components/Tier.jsx';
import AvatarPicker from '../components/AvatarPicker.jsx';
import { IcProfile } from '../components/Icons.jsx';
import { rp } from '../lib/format.js';

const IcTrash = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>);
const confirmDel = (what) => confirm(`Hapus ${what}? Tindakan tidak bisa dibatalkan.`);

export default function Master() {
  const m = useMaster();
  const dock = useDockOptions();
  const [toast, say, clear] = useToast();
  const run = async (fn, okMsg) => {
    try { await fn(); await Promise.all([m.reload(), dock.reload()]); say(okMsg); } catch (e) { say(e.message, 'err'); }
  };

  if (m.loading) return <div className="center"><div className="spinner" /></div>;
  return (
    <>
      <PageHead title="MASTER DATA" />
      <div className="master-grid">
        <FuelCard fuel={m.fuel} run={run} />
        <DriverCard drivers={m.drivers} run={run} />
        <VehicleCard vehicles={m.vehicles} fuel={m.fuel} run={run} />
        <DestinationCard destinations={m.destinations} run={run} />
        <DockOptionCard tipe="perusahaan" title="DAFTAR PERUSAHAAN" noun="perusahaan" example="PT MAJU JAYA" items={dock.list} run={run} />
        <DockOptionCard tipe="expedisi" title="DAFTAR EXPEDISI" noun="expedisi" example="JNE CARGO" items={dock.list} run={run} />
      </div>
      <Toast msg={toast.msg} kind={toast.kind} onDone={clear} />
    </>
  );
}

function FuelCard({ fuel, run }) {
  const [jenis, setJenis] = useState('');
  const [harga, setHarga] = useState('');
  return (
    <section className="card">
      <h3 className="card-t">HARGA BBM PER LITER</h3>
      <ul className="list">
        {fuel.map((f) => <FuelRow key={f.jenis} f={f} run={run} />)}
      </ul>
      <form className="addrow" onSubmit={(e) => { e.preventDefault(); if (!jenis.trim() || !harga) return; run(() => api.saveFuel({ jenis, harga: +harga }), 'Jenis BBM ditambahkan').then(() => { setJenis(''); setHarga(''); }); }}>
        <input placeholder="Jenis BBM baru (mis. Dexlite)" value={jenis} onChange={(e) => setJenis(e.target.value)} aria-label="Jenis BBM baru" />
        <MoneyInput value={harga} onChange={setHarga} />
        <button className="btn btn-ghost btn-sm">Tambah</button>
      </form>
      <p className="muted small">Harga disimpan pada tiap input saat itu, jadi mengubah harga tidak mengubah hitungan data lama.</p>
    </section>
  );
}

function FuelRow({ f, run }) {
  const [harga, setHarga] = useState(f.harga);
  const dirty = +harga !== +f.harga;
  return (
    <li className="li-row fuel-row">
      <b>{f.jenis}</b>
      <MoneyInput value={harga} onChange={setHarga} />
      <button className="btn btn-ghost btn-sm" disabled={!dirty || !harga} onClick={() => run(() => api.saveFuel({ jenis: f.jenis, harga: +harga }), `Harga ${f.jenis} disimpan`)}>Simpan</button>
      <button className="btn-icon danger" title="Hapus" aria-label={`Hapus ${f.jenis}`} onClick={() => confirmDel(`jenis BBM ${f.jenis}`) && run(() => api.deleteFuel(f.jenis), `${f.jenis} dihapus`)}><IcTrash /></button>
    </li>
  );
}

function DriverCard({ drivers, run }) {
  const [nama, setNama] = useState('');
  return (
    <section className="card">
      <h3 className="card-t">NAMA DRIVER</h3>
      <ul className="list">{drivers.map((d) => <DriverRow key={d.id} d={d} run={run} />)}</ul>
      <form className="addrow" onSubmit={(e) => { e.preventDefault(); if (!nama.trim()) return; run(() => api.saveDriver({ nama }), 'Driver ditambahkan').then(() => setNama('')); }}>
        <input placeholder="Nama driver baru" value={nama} onChange={(e) => setNama(e.target.value)} aria-label="Nama driver baru" />
        <button className="btn btn-ghost btn-sm">Tambah</button>
      </form>
      <p className="muted small">Nama driver otomatis huruf kapital. Nonaktifkan driver yang sudah tidak bertugas — data lama tetap aman.</p>
    </section>
  );
}

function DriverRow({ d, run }) {
  const [nama, setNama] = useState(d.nama);
  const [edit, setEdit] = useState(false);
  return (
    <li className={'li-row drv-row' + (d.aktif ? '' : ' off')}>
      <input value={nama} onChange={(e) => setNama(e.target.value)} aria-label={`Nama driver ${d.nama}`} />
      <button className="btn btn-ghost btn-sm" disabled={nama.trim().toUpperCase() === d.nama || !nama.trim()} onClick={() => run(() => api.saveDriver({ id: d.id, nama, aktif: d.aktif }), 'Nama diganti')}>Simpan</button>
      <button className="btn-icon" title="Profil karyawan" aria-label={`Profil ${d.nama}`} onClick={() => setEdit(true)}><IcProfile /></button>
      {edit && <DriverProfileModal d={d} run={run} onClose={() => setEdit(false)} />}
      <label className="switch" title={d.aktif ? 'Aktif' : 'Nonaktif'}>
        <input type="checkbox" checked={d.aktif} onChange={(e) => run(() => api.saveDriver({ id: d.id, nama: d.nama, aktif: e.target.checked }), e.target.checked ? 'Driver diaktifkan' : 'Driver dinonaktifkan')} />
        <span />
      </label>
      <button className="btn-icon danger" title="Hapus" aria-label={`Hapus ${d.nama}`} onClick={() => confirmDel(`driver ${d.nama}`) && run(() => api.deleteDriver(d.id), `${d.nama} dihapus`)}><IcTrash /></button>
    </li>
  );
}

function VehicleCard({ vehicles, fuel, run }) {
  const [v, setV] = useState({ nama: '', plat: '', bbm_jenis: fuel[0]?.jenis || '' });
  return (
    <section className="card wide">
      <h3 className="card-t">MOBIL & PLAT NOMOR</h3>
      <FitTable className="stackwrap"><table className="tbl stack">
        <thead><tr><th>Jenis</th><th>Plat</th><th>BBM</th><th>Aktif</th><th></th><th></th></tr></thead>
        <tbody>{vehicles.map((x) => <VehicleRow key={x.id} v={x} fuel={fuel} run={run} />)}</tbody>
      </table></FitTable>
      <form className="addrow vrow" onSubmit={(e) => { e.preventDefault(); if (!v.nama.trim() || !v.plat.trim() || !v.bbm_jenis) return; run(() => api.saveVehicle(v), 'Mobil ditambahkan').then(() => setV({ ...v, nama: '', plat: '' })); }}>
        <input placeholder="Jenis (mis. DUTRO)" value={v.nama} onChange={(e) => setV({ ...v, nama: e.target.value })} aria-label="Jenis mobil" />
        <input placeholder="Plat (mis. B 1234 ABC)" value={v.plat} onChange={(e) => setV({ ...v, plat: e.target.value })} aria-label="Plat nomor" />
        <select value={v.bbm_jenis} onChange={(e) => setV({ ...v, bbm_jenis: e.target.value })} aria-label="Jenis BBM">
          {fuel.map((f) => <option key={f.jenis}>{f.jenis}</option>)}
        </select>
        <button className="btn btn-primary btn-sm">Tambah mobil</button>
      </form>
    </section>
  );
}

function VehicleRow({ v, fuel, run }) {
  const [d, setD] = useState({ nama: v.nama, plat: v.plat, bbm_jenis: v.bbm_jenis });
  const dirty = d.nama !== v.nama || d.plat !== v.plat || d.bbm_jenis !== v.bbm_jenis;
  return (
    <tr className={v.aktif ? '' : 'off'}>
      <td data-l="Jenis"><input value={d.nama} onChange={(e) => setD({ ...d, nama: e.target.value })} aria-label="Jenis" /></td>
      <td data-l="Plat"><input value={d.plat} onChange={(e) => setD({ ...d, plat: e.target.value })} aria-label="Plat" /></td>
      <td data-l="BBM"><select value={d.bbm_jenis} onChange={(e) => setD({ ...d, bbm_jenis: e.target.value })} aria-label="BBM">{fuel.map((f) => <option key={f.jenis} value={f.jenis}>{f.jenis} · {rp(f.harga)}</option>)}</select></td>
      <td data-l="Aktif"><label className="switch"><input type="checkbox" checked={v.aktif} onChange={(e) => run(() => api.saveVehicle({ ...v, aktif: e.target.checked }), e.target.checked ? 'Mobil diaktifkan' : 'Mobil dinonaktifkan')} /><span /></label></td>
      <td className="r"><button className="btn btn-ghost btn-sm" disabled={!dirty} onClick={() => run(() => api.saveVehicle({ ...v, ...d }), 'Mobil disimpan')}>Simpan</button></td>
      <td className="r"><button className="btn-icon danger" title="Hapus" aria-label={`Hapus ${v.plat}`} onClick={() => confirmDel(`mobil ${v.plat}`) && run(() => api.deleteVehicle(v.id), `${v.plat} dihapus`)}><IcTrash /></button></td>
    </tr>
  );
}

function DestinationCard({ destinations, run }) {
  const [nama, setNama] = useState('');
  const [q, setQ] = useState('');
  const shown = useMemo(() => destinations.filter((d) => !q || d.nama.toLowerCase().includes(q.toLowerCase())), [destinations, q]);
  return (
    <section className="card wide">
      <h3 className="card-t">DAFTAR TUJUAN <small className="muted">PILIHAN DROPDOWN DI FORM DRIVER</small></h3>
      <form className="addbar" onSubmit={(e) => { e.preventDefault(); if (!nama.trim()) return; run(() => api.saveDestination({ nama }), 'Tujuan ditambahkan').then(() => setNama('')); }}>
        <input placeholder="Tujuan baru (mis. GUDANG CAKUNG)" value={nama} onChange={(e) => setNama(e.target.value)} aria-label="Tujuan baru" />
        <button className="btn btn-primary btn-sm">Tambah tujuan</button>
      </form>
      {destinations.length > 8 && <div className="dest-search"><input placeholder="Cari tujuan…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari tujuan" /></div>}
      {destinations.length === 0 ? <p className="muted empty-line">Belum ada tujuan. Tambahkan di atas, atau biarkan terisi dari input driver.</p> : (
        <ul className="list dest-list">{shown.map((d) => <DestinationRow key={d.id} d={d} run={run} />)}</ul>
      )}
    </section>
  );
}

function DestinationRow({ d, run }) {
  const [nama, setNama] = useState(d.nama);
  const dirty = nama.trim().replace(/\s+/g, ' ').toUpperCase() !== d.nama && nama.trim();
  return (
    <li className={'li-row drv-row' + (d.aktif ? '' : ' off')}>
      <input value={nama} onChange={(e) => setNama(e.target.value)} aria-label={`Tujuan ${d.nama}`} />
      <button className="btn btn-ghost btn-sm" disabled={!dirty} onClick={() => run(() => api.saveDestination({ ...d, nama }), 'Tujuan disimpan')}>Simpan</button>
      <label className="switch" title={d.aktif ? 'Tampil di dropdown' : 'Disembunyikan dari dropdown'}>
        <input type="checkbox" checked={d.aktif} onChange={(e) => run(() => api.saveDestination({ ...d, aktif: e.target.checked }), e.target.checked ? 'Tujuan diaktifkan' : 'Tujuan disembunyikan')} />
        <span />
      </label>
      <button className="btn-icon danger" aria-label={`Hapus tujuan ${d.nama}`} title="Hapus"
        onClick={() => { if (confirm(`Hapus tujuan "${d.nama}" dari daftar? Data perjalanan lama tidak berubah.`)) run(() => api.deleteDestination(d.id), 'Tujuan dihapus'); }}>🗑</button>
    </li>
  );
}

/** Daftar pilihan LOADING DOCK (nama perusahaan / nama expedisi). Developer mengelola; nama baru yang diketik user otomatis masuk. */
function DockOptionCard({ tipe, title, noun, example, items, run }) {
  const [nama, setNama] = useState('');
  const [q, setQ] = useState('');
  const mine = useMemo(() => items.filter((o) => o.tipe === tipe), [items, tipe]);
  const shown = useMemo(() => mine.filter((o) => !q || o.nama.toLowerCase().includes(q.toLowerCase())), [mine, q]);
  return (
    <section className="card">
      <h3 className="card-t">{title} <small className="muted">PILIHAN DROPDOWN DI LOADING DOCK</small></h3>
      <form className="addbar" onSubmit={(e) => { e.preventDefault(); if (!nama.trim()) return; run(() => api.saveDockOption({ tipe, nama }), `${noun} ditambahkan`).then(() => setNama('')); }}>
        <input placeholder={`${noun[0].toUpperCase() + noun.slice(1)} baru (mis. ${example})`} value={nama} onChange={(e) => setNama(e.target.value)} aria-label={`${noun} baru`} />
        <button className="btn btn-primary btn-sm">Tambah</button>
      </form>
      {mine.length > 8 && <div className="dest-search"><input placeholder={`Cari ${noun}…`} value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Cari ${noun}`} /></div>}
      {mine.length === 0 ? <p className="muted empty-line">Belum ada {noun}. Tambahkan di atas, atau biarkan terisi dari input user.</p> : (
        <ul className="list dest-list">{shown.map((o) => <DockOptionRow key={o.id} o={o} noun={noun} run={run} />)}</ul>
      )}
    </section>
  );
}

function DockOptionRow({ o, noun, run }) {
  const [nama, setNama] = useState(o.nama);
  const dirty = nama.trim().replace(/\s+/g, ' ').toUpperCase() !== o.nama && nama.trim();
  return (
    <li className={'li-row' + (o.aktif ? '' : ' off')}>
      <input value={nama} onChange={(e) => setNama(e.target.value)} aria-label={`${noun} ${o.nama}`} />
      <button className="btn btn-ghost btn-sm" disabled={!dirty} onClick={() => run(() => api.saveDockOption({ ...o, nama }), 'Nama disimpan')}>Simpan</button>
      <label className="switch" title={o.aktif ? 'Tampil di dropdown' : 'Disembunyikan dari dropdown'}>
        <input type="checkbox" checked={o.aktif} onChange={(e) => run(() => api.saveDockOption({ ...o, aktif: e.target.checked }), e.target.checked ? 'Diaktifkan' : 'Disembunyikan dari dropdown')} />
        <span />
      </label>
      <button className="btn-icon danger" aria-label={`Hapus ${noun} ${o.nama}`} title="Hapus"
        onClick={() => { if (confirm(`Hapus ${noun} "${o.nama}" dari daftar? Data upload lama tidak berubah.`)) run(() => api.deleteDockOption(o.id), 'Dihapus'); }}>🗑</button>
    </li>
  );
}

/** Owner mengisi data karyawan driver (tampil di menu PROFIL). Foto bisa diganti driver sendiri. */
function DriverProfileModal({ d, run, onClose }) {
  const [f, setF] = useState({ nama_lengkap: d.nama_lengkap || '', id_karyawan: d.id_karyawan || '', departemen: d.departemen || '', jabatan: d.jabatan || '' });
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value.toUpperCase() });
  return (
    <Modal title={`PROFIL KARYAWAN · ${d.nama}`} size="sm" onClose={onClose}>
      <div className="pm-head">
        <AvatarPicker photo={d.foto} onChange={(foto) => run(() => api.saveDriver({ id: d.id, nama: d.nama, aktif: d.aktif, foto }), foto ? 'Foto tersimpan' : 'Foto dihapus')}>
          <Avatar driver={d} tier={1} size={88} />
        </AvatarPicker>
        <p className="muted small pm-hint">Ketuk foto untuk melihat atau mengunggah foto baru.</p>
      </div>
      <label>NAMA LENGKAP<input value={f.nama_lengkap} onChange={up('nama_lengkap')} /></label>
      <label>ID KARYAWAN<input value={f.id_karyawan} onChange={up('id_karyawan')} placeholder="mis. RX-001" /></label>
      <label>DEPARTEMEN<input value={f.departemen} onChange={up('departemen')} placeholder="mis. LOGISTIC" /></label>
      <label>JABATAN<input value={f.jabatan} onChange={up('jabatan')} placeholder="mis. DRIVER" /></label>
      <div className="form-actions sticky-foot">
        <button className="btn btn-ghost" onClick={onClose}>BATAL</button>
        <button className="btn btn-primary" onClick={() => run(() => api.saveDriver({ id: d.id, nama: d.nama, aktif: d.aktif, ...f }), 'Profil karyawan tersimpan').then(onClose)}>SIMPAN</button>
      </div>
    </Modal>
  );
}

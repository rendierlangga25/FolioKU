import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../auth.jsx';
import { fmtDate, int, todayISO } from '../lib/format.js';
import { dropItem } from '../lib/photoItem.js';
import { normDock, useDockOptions } from '../lib/useDockOptions.js';
import { ComboInput, DateRangeFields, Modal, PageHead, Toast, useDateRange, useToast } from '../components/ui.jsx';
import { MultiPhoto } from '../components/PhotoField.jsx';
import { useMaster } from '../lib/useMaster.js';

export const KATEGORI = [['reguler', 'REGULER'], ['otomotif', 'OTOMOTIF'], ['movestock', 'MOVESTOCK']];
const KAT_LABEL = Object.fromEntries(KATEGORI);

/** LOADING DOCK — tab INTERNAL, EKSTERNAL (upload bukti loading) dan RIWAYAT (semua yang sudah diupload). */
export default function LoadingDock() {
  const [sp, setSp] = useSearchParams();
  const opts = useDockOptions();
  const tabs = [['internal', 'INTERNAL'], ['eksternal', 'EKSTERNAL'], ['riwayat', 'RIWAYAT']];
  const tab = tabs.some(([k]) => k === sp.get('tab')) ? sp.get('tab') : 'internal';
  return (
    <>
      <PageHead title="LOADING DOCK" />
      <div className="tabs" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={'tabbtn' + (tab === k ? ' on' : '')}
            onClick={() => setSp(k === 'internal' ? {} : { tab: k }, { replace: true })}>{l}</button>
        ))}
      </div>
      {tab === 'riwayat' ? <DockHistory opts={opts} />
        : tab === 'eksternal' ? <ExternalForm opts={opts} />
        : <InternalForm opts={opts} />}
    </>
  );
}

/** Kolom nama (perusahaan / expedisi): pilih dari dropdown atau ketik manual — nama baru otomatis tersimpan saat kirim. */
function NameField({ label, noun, value, onChange, options, id }) {
  const isNew = value.trim() && !options.includes(normDock(value));
  return (
    <div>
      <label htmlFor={id}>{label} <i className="req">*</i></label>
      <ComboInput id={id} noun={noun} value={value} onChange={onChange} options={options}
        placeholder={`Pilih atau ketik ${noun}`} ariaLabel={label} />
      {isNew && <small className="hint">{noun[0].toUpperCase() + noun.slice(1)} baru — otomatis masuk daftar pilihan setelah dikirim.</small>}
    </div>
  );
}

/** Plat mobil: pilih dari daftar armada atau ketik sendiri (plat di luar daftar tetap bisa). */
function PlatField({ value, onChange, id = 'dk-plat' }) {
  const master = useMaster();
  const plats = useMemo(() => master.vehicles.filter((v) => v.aktif !== false).map((v) => v.plat), [master.vehicles]);
  return (
    <div>
      <label htmlFor={id}>Plat mobil <i className="req">*</i></label>
      <ComboInput id={id} noun="plat mobil" value={value} onChange={(v) => onChange(v.toUpperCase())} options={plats}
        placeholder="Pilih atau ketik plat mobil" ariaLabel="Plat mobil" />
    </div>
  );
}

/** Unggah semua foto form lalu simpan satu baris loading dock. */
function useDockSubmit(opts, say) {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState([]);
  const uid = session.user.id;
  const upAll = (items, kind) => Promise.all(items.map((i) => api.uploadPhoto(i.blob, uid, kind)));

  const send = async (problems, build, after) => {
    setErrors(problems);
    if (problems.length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setBusy(true);
    try {
      const built = await build(upAll);
      const list = Array.isArray(built) ? built : [built];
      for (const row of list) await api.createDock({ ...row, created_by: uid });
      // nama baru → masuk daftar pilihan (kegagalan di sini tidak membatalkan data)
      await api.addDockOptions('perusahaan', [...new Set(list.flatMap((r) => (r.items?.length ? r.items.map((i) => i.perusahaan) : [r.perusahaan])))]).catch(() => {});
      const exps = [...new Set(list.map((r) => r.expedisi).filter(Boolean))];
      if (exps.length) await api.addDockOptions('expedisi', exps).catch(() => {});
      opts.reload();
      after();
      say(list[0]?.items?.length > 1 ? `${list[0].items.length} SO tersimpan dalam 1 upload ✓` : 'Upload loading dock tersimpan ✓');
    } catch (e) { setErrors([e.message]); window.scrollTo({ top: 0, behavior: 'smooth' }); } finally { setBusy(false); }
  };
  return { busy, errors, setErrors, send };
}

const ErrBox = ({ errors }) => errors.length > 0 && (
  <div className="err-box" role="alert"><b>Data belum lengkap — belum bisa dikirim:</b><ul>{errors.map((m) => <li key={m}>{m}</li>)}</ul></div>
);

let soSeq = 0;
const newSo = () => ({ id: `so${++soSeq}`, so: '', prs: '' });

/** INTERNAL: REGULER (No SO + perusahaan + plat + foto) · OTOMOTIF / MOVESTOCK (perusahaan + plat + foto). */
function InternalForm({ opts }) {
  const [toast, say, clear] = useToast();
  const [kat, setKat] = useState('reguler');
  const [soRows, setSoRows] = useState(() => [newSo()]);   // REGULER: satu baris = satu No SO + nama perusahaannya
  const [perusahaan, setPerusahaan] = useState('');
  const [plat, setPlat] = useState('');
  const [fotos, setFotos] = useState([]);
  const { busy, errors, send } = useDockSubmit(opts, say);
  const reguler = kat === 'reguler';
  const setSo = (id, patch) => setSoRows((l) => l.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addSo = () => setSoRows((l) => [...l, newSo()]);
  const delSo = (id) => setSoRows((l) => (l.length > 1 ? l.filter((r) => r.id !== id) : l));

  const submit = (e) => {
    e.preventDefault();
    const p = [];
    const base = { jenis: 'internal', kategori: kat, tanggal: todayISO(), foto_sj: [], plat: normDock(plat) };
    if (!plat.trim()) p.push('Plat mobil wajib diisi.');
    if (reguler) {
      const seen = new Set();
      soRows.forEach((r, i) => {
        const no = r.so.trim().toUpperCase();
        if (!no) p.push(`Nomor SO ke-${i + 1} wajib diisi.`);
        else if (seen.has(no)) p.push(`Nomor SO ${no} diisi dua kali.`);
        seen.add(no);
        if (!r.prs.trim()) p.push(`Nama perusahaan untuk SO ke-${i + 1} wajib diisi.`);
      });
    } else {
      if (!perusahaan.trim()) p.push('Nama perusahaan wajib diisi.');
    }
    if (fotos.length === 0) p.push('Foto loading wajib diunggah (minimal 1).');
    send(p, async (upAll) => {
      const foto_loading = await upAll(fotos, 'loading');   // foto diunggah sekali, dipakai semua SO
      if (reguler) {
        // satu upload = satu card, semua nomor SO (beserta perusahaannya) tercatat di dalamnya
        const items = soRows.map((r) => ({ so: r.so.trim().toUpperCase(), perusahaan: normDock(r.prs) }));
        const prs = [...new Set(items.map((i) => i.perusahaan))];
        return { ...base, no_so: items.map((i) => i.so).join(', '), perusahaan: prs.join(', '), items, expedisi: null, foto_loading };
      }
      return { ...base, no_so: null, perusahaan: normDock(perusahaan), expedisi: null, foto_loading };
    }, () => { fotos.forEach(dropItem); setFotos([]); setSoRows([newSo()]); setPerusahaan(''); setPlat(''); });
  };

  return (
    <form className="tripform" onSubmit={submit} noValidate>
      <ErrBox errors={errors} />
      <section className="card">
        <h3 className="card-t">Kategori</h3>
        <div className="seg" role="radiogroup" aria-label="Kategori internal">
          {KATEGORI.map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={kat === k} className={'seg-btn' + (kat === k ? ' on' : '')} onClick={() => setKat(k)}>{l}</button>
          ))}
        </div>
        <p className="muted small dock-note">{reguler
          ? 'REGULER: isi nomor SO + nama perusahaan (tambah baris bila SO lebih dari satu) dan foto loading sebagai bukti SO sudah di-loading.'
          : `${KAT_LABEL[kat]}: isi plat mobil, nama perusahaan, dan foto loading.`}</p>
      </section>
      <section className="card">
        <h3 className="card-t">Data loading</h3>
        <div className="grid2 plat-row"><PlatField value={plat} onChange={setPlat} /></div>
        {reguler ? (
          <>
            <div className="so-list">
              {soRows.map((r, i) => (
                <div className="so-row" key={r.id}>
                  <div className="so-no">{i + 1}</div>
                  <div className="grid2">
                    <div>
                      <label htmlFor={`dk-so-${r.id}`}>Nomor SO <i className="req">*</i></label>
                      <input id={`dk-so-${r.id}`} value={r.so} onChange={(e) => setSo(r.id, { so: e.target.value })} placeholder="mis. SO-2026-00123" autoComplete="off" />
                    </div>
                    <NameField id={`dk-prs-${r.id}`} label="Nama perusahaan" noun="perusahaan" value={r.prs} onChange={(v) => setSo(r.id, { prs: v })} options={opts.perusahaan} />
                  </div>
                  {soRows.length > 1 && <button type="button" className="so-del" onClick={() => delSo(r.id)} aria-label={`Hapus SO ke-${i + 1}`} title="Hapus baris ini">✕</button>}
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-ghost btn-sm so-add" onClick={addSo}>+ TAMBAH SO</button>
            <small className="hint">Lebih dari satu SO? Tekan TAMBAH SO — bar nomor SO dan nama perusahaan baru langsung muncul. Semua SO tersimpan dalam satu upload dengan foto loading yang sama.</small>
          </>
        ) : (
          <div className="grid2">
            <NameField id="dk-prs" label="Nama perusahaan" noun="perusahaan" value={perusahaan} onChange={setPerusahaan} options={opts.perusahaan} />
          </div>
        )}
      </section>
      <section className="card">
        <h3 className="card-t">Foto loading</h3>
        <MultiPhoto title="Foto loading" required items={fotos} onItems={setFotos}
          note={reguler ? 'Foto bukti barang pada SO ini sudah di-loading.' : 'Foto barang yang sudah di-loading.'} />
      </section>
      <div className="form-actions">
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim upload'}</button>
      </div>
      <Toast msg={toast.msg} kind={toast.kind} onDone={clear} />
    </form>
  );
}

/** EKSTERNAL: tanggal (otomatis hari ini, bisa diubah) + expedisi + perusahaan + foto loading + foto SJ bertanda tangan. */
function ExternalForm({ opts }) {
  const [toast, say, clear] = useToast();
  const [tanggal, setTanggal] = useState(todayISO);
  const [expedisi, setExpedisi] = useState('');
  const [perusahaan, setPerusahaan] = useState('');
  const [plat, setPlat] = useState('');   // ketik manual, hanya tercatat di riwayat (tidak masuk daftar pilihan mana pun)
  const [loading, setLoading] = useState([]);
  const [sj, setSj] = useState([]);
  const { busy, errors, send } = useDockSubmit(opts, say);

  const submit = (e) => {
    e.preventDefault();
    const p = [];
    if (!tanggal) p.push('Tanggal wajib diisi.');
    if (!expedisi.trim()) p.push('Nama expedisi wajib diisi.');
    if (!perusahaan.trim()) p.push('Nama perusahaan wajib diisi.');
    if (!plat.trim()) p.push('Plat nomor wajib diisi.');
    if (loading.length === 0) p.push('Foto loading wajib diunggah (minimal 1).');
    if (sj.length === 0) p.push('Foto surat jalan (SJ) yang sudah ditandatangani wajib diunggah (minimal 1).');
    send(p, async (upAll) => {
      const [foto_loading, foto_sj] = await Promise.all([upAll(loading, 'loading'), upAll(sj, 'sj')]);
      return { jenis: 'eksternal', kategori: null, tanggal, no_so: null, perusahaan: normDock(perusahaan), expedisi: normDock(expedisi), plat: normDock(plat), foto_loading, foto_sj };
    }, () => { [...loading, ...sj].forEach(dropItem); setLoading([]); setSj([]); setExpedisi(''); setPerusahaan(''); setPlat(''); setTanggal(todayISO()); });
  };

  return (
    <form className="tripform" onSubmit={submit} noValidate>
      <ErrBox errors={errors} />
      <section className="card">
        <h3 className="card-t">Tanggal</h3>
        <div className="grid2">
          <div>
            <label htmlFor="dk-tgl">Tanggal <i className="req">*</i></label>
            <input id="dk-tgl" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required />
            <small className="hint">Otomatis hari ini — ubah bila perlu.</small>
          </div>
        </div>
      </section>
      <section className="card">
        <h3 className="card-t">Data loading</h3>
        <div className="grid2">
          <NameField id="dk-exp" label="Nama expedisi" noun="expedisi" value={expedisi} onChange={setExpedisi} options={opts.expedisi} />
          <NameField id="dk-prs" label="Nama perusahaan" noun="perusahaan" value={perusahaan} onChange={setPerusahaan} options={opts.perusahaan} />
          <div>
            <label htmlFor="dk-plat-ext">Plat nomor <i className="req">*</i></label>
            <input id="dk-plat-ext" value={plat} onChange={(e) => setPlat(e.target.value.toUpperCase())} placeholder="mis. B 1234 XYZ" autoComplete="off" />
            <small className="hint">Ketik manual untuk expedisi eksternal — hanya tercatat di riwayat.</small>
          </div>
        </div>
      </section>
      <section className="card docs">
        <h3 className="card-t">Foto</h3>
        <MultiPhoto title="Foto loading" required items={loading} onItems={setLoading} note="Foto barang yang sudah di-loading ke expedisi." />
        <MultiPhoto title="Foto SJ (sudah ditandatangani)" required items={sj} onItems={setSj} note="Foto surat jalan yang sudah ditandatangani — pastikan tanda tangan & isi terbaca jelas." />
      </section>
      <div className="form-actions">
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim upload'}</button>
      </div>
      <Toast msg={toast.msg} kind={toast.kind} onDone={clear} />
    </form>
  );
}

/** Foto satu upload (dimuat saat dibuka agar riwayat panjang tetap ringan). */
function DockPhotos({ row }) {
  const groups = [['Foto loading', row.foto_loading || []], ['Foto SJ (ditandatangani)', row.foto_sj || []]].filter(([, p]) => p.length);
  const [urls, setUrls] = useState({});
  useEffect(() => {
    let alive = true;
    groups.flatMap(([, p]) => p).forEach(async (p) => {
      const u = await api.photoUrl(p).catch(() => null);
      if (alive && u) setUrls((s) => ({ ...s, [p]: u }));
    });
    return () => { alive = false; };
  }, [row.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="gallery dock-gal">
      {groups.map(([label, paths]) => (
        <div key={label} className="gal-g">
          <small>{label}</small>
          <div className="gal-row">
            {paths.map((p) => (urls[p]
              ? <a key={p} href={urls[p]} target="_blank" rel="noreferrer"><img src={urls[p]} alt={label} loading="lazy" /></a>
              : <div key={p} className="thumb-wait"><span className="spinner sm" /></div>))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Isi data satu upload (dipakai di card dan di popup). */
function DockInfo({ r }) {
  return (
    <>
      {r.items?.length > 1 ? (
        <ul className="so-hist">{r.items.map((i) => <li key={i.so}><b className="mono">{i.so}</b><span>{i.perusahaan}</span></li>)}</ul>
      ) : (
        <>
          <p className="hist-d">{r.perusahaan}</p>
          {r.no_so && <p className="hist-t">No SO: <b className="mono">{r.no_so}</b></p>}
        </>
      )}
      {r.plat && <p className="hist-t">Plat mobil: <b className="mono">{r.plat}</b></p>}
      {r.expedisi && <p className="hist-t">Expedisi: <b>{r.expedisi}</b></p>}
    </>
  );
}

/** RIWAYAT: semua yang diupload + filter internal/eksternal, nama perusahaan, tanggal, dan nama expedisi (eksternal). */
function DockHistory({ opts }) {
  const { isOwner } = useAuth();
  const master = useMaster();
  const [toast, say, clear] = useToast();
  const [range, setRange] = useDateRange();
  const [rows, setRows] = useState(null);
  const [jenisF, setJenisF] = useState('');
  const [katF, setKatF] = useState('');
  const [prsF, setPrsF] = useState('');
  const [expF, setExpF] = useState('');
  const [platF, setPlatF] = useState('');
  const [view, setView] = useState(null);   // upload yang fotonya sedang dibuka (popup)

  useEffect(() => { setRows(null); api.listDock({ ...range }).then(setRows).catch(() => setRows([])); }, [range]);

  const prsOf = (r) => (r.items?.length ? r.items.map((i) => i.perusahaan) : [r.perusahaan]);
  const prsOptions = useMemo(() => [...new Set([...opts.perusahaanAll, ...(rows || []).flatMap(prsOf)])].sort(), [opts.perusahaanAll, rows]);
  const platOptions = useMemo(() => [...new Set([...master.vehicles.map((v) => v.plat), ...(rows || []).filter((r) => r.jenis === 'internal').map((r) => r.plat)].filter(Boolean))].sort(), [rows, master.vehicles]);
  const expOptions = useMemo(() => [...new Set([...opts.expedisiAll, ...(rows || []).filter((r) => r.jenis === 'eksternal').map((r) => r.expedisi)].filter(Boolean))].sort(), [opts.expedisiAll, rows]);
  const shown = useMemo(() => (rows || []).filter((r) =>
    (!jenisF || r.jenis === jenisF)
    && (jenisF !== 'internal' || !katF || r.kategori === katF)
    && (!prsF || prsOf(r).includes(prsF))
    && (!platF || r.plat === platF)
    && (jenisF !== 'eksternal' || !expF || r.expedisi === expF)), [rows, jenisF, katF, prsF, expF, platF]);

  const pickJenis = (v) => { setJenisF(v); if (v !== 'internal') setKatF(''); if (v !== 'eksternal') setExpF(''); };
  const remove = async (r) => {
    if (!confirm(`Hapus upload ${r.perusahaan} tanggal ${fmtDate(r.tanggal)}? Tindakan tidak bisa dibatalkan.`)) return;
    try { await api.deleteDock(r.id); setRows((l) => l.filter((x) => x.id !== r.id)); say('Upload dihapus'); } catch (e) { say(e.message, 'err'); }
  };

  return (
    <>
      <p className="muted subnote">Semua upload loading dock (internal & eksternal).</p>
      <div className="filters">
        <DateRangeFields value={range} onChange={setRange} />
        <div><label>Internal / Eksternal</label>
          <select value={jenisF} onChange={(e) => pickJenis(e.target.value)}>
            <option value="">Semua</option><option value="internal">Internal</option><option value="eksternal">Eksternal</option>
          </select></div>
        {jenisF === 'internal' && (
          <div><label>Kategori</label>
            <select value={katF} onChange={(e) => setKatF(e.target.value)}>
              <option value="">Semua kategori</option>
              {KATEGORI.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select></div>
        )}
        <div><label>Nama perusahaan</label>
          <select value={prsF} onChange={(e) => setPrsF(e.target.value)}>
            <option value="">Semua perusahaan</option>
            {prsOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select></div>
        {(
          <div><label>Plat mobil</label>
            <select value={platF} onChange={(e) => setPlatF(e.target.value)}>
              <option value="">Semua plat</option>
              {platOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select></div>
        )}
        {jenisF === 'eksternal' && (
          <div><label>Nama expedisi</label>
            <select value={expF} onChange={(e) => setExpF(e.target.value)}>
              <option value="">Semua expedisi</option>
              {expOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select></div>
        )}
      </div>
      {!rows ? <div className="center"><div className="spinner" /></div> : shown.length === 0 ? (
        <p className="muted empty-line">{rows.length ? 'Tidak ada data yang cocok dengan filter.' : 'Belum ada upload pada rentang tanggal ini.'}</p>
      ) : (
        <>
          <p className="hist-sum">{int(shown.length)} upload{jenisF || katF || prsF || expF || platF ? ' (terfilter)' : ''}</p>
          <div className="cards dock-cards">
            {shown.map((r) => {
              const n = (r.foto_loading || []).length + (r.foto_sj || []).length;
              return (
                <article className="hist dock-hist clickable" key={r.id} role="button" tabIndex={0} onClick={() => setView(r)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), setView(r))}>
                  <div className="hist-h">
                    <b>{fmtDate(r.tanggal)}</b>
                    <span className="chip">{r.jenis === 'internal' ? `INTERNAL · ${KAT_LABEL[r.kategori] || ''}` : 'EKSTERNAL'}</span>
                  </div>
                  <DockInfo r={r} />
                  <div className="dock-actions">
                    <span className="dock-open">LIHAT FOTO ({n})</span>
                    {isOwner && <button type="button" className="btn btn-ghost btn-sm danger-t" onClick={(e) => { e.stopPropagation(); remove(r); }}>HAPUS</button>}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
      {view && (
        <Modal title={`UPLOAD ${fmtDate(view.tanggal)}`} wide onClose={() => setView(null)}>
          <span className="chip">{view.jenis === 'internal' ? `INTERNAL · ${KAT_LABEL[view.kategori] || ''}` : 'EKSTERNAL'}</span>
          <DockInfo r={view} />
          <DockPhotos row={view} />
        </Modal>
      )}
      <Toast msg={toast.msg} kind={toast.kind} onDone={clear} />
    </>
  );
}

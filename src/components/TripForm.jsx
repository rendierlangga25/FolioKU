import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../auth.jsx';
import { jarak, liter, kmPerL, kmPerLDriver, totalBiaya } from '../lib/calc.js';
import { drafts } from '../lib/draftStore.js';
import { fmtClock, fmtLongDate, int, num, rp, todayISO } from '../lib/format.js';
import { dropItem, mkItem, pathItem } from '../lib/photoItem.js';
import { checkTrip, EMPTY_FORM, EMPTY_PHOTOS, normTujuan } from '../lib/tripRules.js';
import { vehicleLabel } from '../lib/useMaster.js';
import { MultiPhoto, ODO_NOTE, OdoPhoto } from './PhotoField.jsx';
import { ComboInput, MoneyInput } from './ui.jsx';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
const PHOTO_KEYS = ['km_awal', 'km_isi', 'km_akhir'];
const MULTI_KEYS = ['serah_terima', 'surat_jalan', 'kendala', 'sisa_bbm'];

// Foto di database → item form (mode ubah data oleh owner)
const photosFromTrip = (t) => ({
  km_awal: pathItem(t.foto_path),
  km_isi: pathItem(t.foto_km_isi),
  km_akhir: pathItem(t.foto_km_akhir),
  serah_terima: (t.foto_serah_terima || []).map(pathItem),
  surat_jalan: (t.foto_surat_jalan || []).map(pathItem),
  kendala: (t.foto_kendala || []).map(pathItem),
  sisa_bbm: t.foto_sisa_bbm ? [pathItem(t.foto_sisa_bbm)] : [],
});
// Draft (IndexedDB) → item form
const photosFromDraft = (p = {}) => ({
  km_awal: p.km_awal ? mkItem(p.km_awal) : null,
  km_isi: p.km_isi ? mkItem(p.km_isi) : null,
  km_akhir: p.km_akhir ? mkItem(p.km_akhir) : null,
  serah_terima: (p.serah_terima || []).map(mkItem),
  surat_jalan: (p.surat_jalan || []).map(mkItem),
  kendala: (p.kendala || []).map(mkItem),
  sisa_bbm: (p.sisa_bbm || []).map(mkItem),
});
// Item form → draft (hanya blob; foto tidak perlu diunggah ulang)
const photosToDraft = (ph) => ({
  km_awal: ph.km_awal?.blob || null, km_isi: ph.km_isi?.blob || null, km_akhir: ph.km_akhir?.blob || null,
  serah_terima: ph.serah_terima.map((i) => i.blob).filter(Boolean),
  surat_jalan: ph.surat_jalan.map((i) => i.blob).filter(Boolean),
  kendala: ph.kendala.map((i) => i.blob).filter(Boolean),
  sisa_bbm: ph.sisa_bbm.map((i) => i.blob).filter(Boolean),
});
const allItems = (ph) => [...PHOTO_KEYS.map((k) => ph[k]), ...MULTI_KEYS.flatMap((k) => ph[k])].filter(Boolean);

/**
 * Dua mode:
 *  • Driver (tanpa `initial`)  → alur DRAFT: boleh disimpan sementara di perangkat; data baru masuk
 *    database lewat tombol "Kirim data" setelah semua wajib lengkap. `draft` = melanjutkan draft lama.
 *  • Owner (dengan `initial`)  → mengubah data yang sudah ada di database.
 *
 * onSaved('submitted'|'draft'|'edited') · onCancel() — kembali ke daftar / tutup modal
 */
export default function TripForm({ master, initial, draft, onSaved, onCancel }) {
  const { session } = useAuth();
  const editing = Boolean(initial);
  const userId = session.user.id;

  const [draftId] = useState(() => draft?.id || uid());
  const [f, setF] = useState(() => {
    if (initial) return { ...EMPTY_FORM, ...initial, tujuan: initial.tujuan?.length ? initial.tujuan : [''],
      driver2_id: initial.driver2_id || '', tol_rp: initial.tol_rp || '', parkir_rp: initial.parkir_rp || '', parkir_cash_rp: initial.parkir_cash_rp || '', kuli_bongkar_rp: initial.kuli_bongkar_rp || '', security_rp: initial.security_rp || '', kendala_ket: initial.kendala_ket || '' };
    if (draft) return { ...EMPTY_FORM, ...draft.form, tujuan: draft.form?.tujuan?.length ? draft.form.tujuan : [''] };
    return EMPTY_FORM;
  });
  const [ph, setPh] = useState(() => (initial ? photosFromTrip(initial) : draft ? photosFromDraft(draft.photos) : EMPTY_PHOTOS()));
  const [tanggal, setTanggal] = useState(initial?.tanggal || draft?.tanggal || todayISO());
  const [now, setNow] = useState(new Date());
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState('');
  const [savedAt, setSavedAt] = useState(draft ? new Date(draft.updatedAt) : null);
  const [draftErr, setDraftErr] = useState('');
  const uploaded = useRef(new WeakMap());   // blob → path: percobaan kirim ulang tidak mengunggah dua kali
  const phRef = useRef(ph); phRef.current = ph;

  useEffect(() => { if (editing || draft) return; const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, [editing, draft]);
  // foto yang sudah ada di storage → ambil URL tampilnya
  useEffect(() => {
    let alive = true;
    allItems(ph).filter((i) => i.path && !i.url).forEach(async (i) => {
      const url = await api.photoUrl(i.path).catch(() => null);
      if (alive) setPh((p) => {
        const patch = (x) => (x && x.id === i.id ? { ...x, url } : x);
        return { ...p, ...Object.fromEntries(PHOTO_KEYS.map((k) => [k, patch(p[k])])), ...Object.fromEntries(MULTI_KEYS.map((k) => [k, p[k].map(patch)])) };
      });
    });
    return () => { alive = false; };
  }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => allItems(phRef.current).forEach(dropItem), []);

  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const setPhoto = (k) => (v) => setPh((p) => ({ ...p, [k]: v }));
  const vehicle = master.vehicle[f.vehicle_id];
  const harga = vehicle ? master.price[vehicle.bbm_jenis] : 0;
  const activeDrivers = master.drivers.filter((d) => d.aktif || d.id === f.driver1_id || d.id === f.driver2_id);
  const activeVehicles = master.vehicles.filter((v) => v.aktif || v.id === f.vehicle_id);
  const destOptions = useMemo(() => {
    const chosen = new Set(f.tujuan.map(normTujuan));
    return master.destinations.filter((d) => d.aktif).map((d) => d.nama).filter((n) => !chosen.has(n));
  }, [master.destinations, f.tujuan]);
  const knownDest = useMemo(() => new Set(master.destinations.map((d) => d.nama)), [master.destinations]);

  const calc = useMemo(() => {
    const t = { ...f, harga_liter: editing && initial.vehicle_id === f.vehicle_id ? initial.harga_liter : harga };
    const n = [f.driver1_id, f.driver2_id].filter(Boolean).length || 1;
    return { n, jarak: jarak(t), liter: liter(t), kmL: kmPerL(t), kmLd: kmPerLDriver(t), total: totalBiaya(t) };
  }, [f, harga, editing, initial]);

  const check = useMemo(() => checkTrip(f, ph, { harga, relaxPhotos: editing }), [f, ph, harga, editing]);

  // Setelah percobaan kirim pertama, daftar error ikut diperbarui saat driver melengkapi isian.
  useEffect(() => { if (errors.length) setErrors(check.problems); }, [check]); // eslint-disable-line react-hooks/exhaustive-deps

  // ───── Draft: simpan otomatis di perangkat ─────
  const dirty = useMemo(() => JSON.stringify(f) !== JSON.stringify(EMPTY_FORM) || allItems(ph).length > 0, [f, ph]);
  const persist = async () => {
    await drafts.put({ id: draftId, uid: userId, tanggal, form: f, photos: photosToDraft(ph), updatedAt: Date.now() });
    setSavedAt(new Date()); setDraftErr('');
  };
  useEffect(() => {
    if (editing || !dirty) return;
    const t = setTimeout(() => { persist().catch((e) => setDraftErr(e.message)); }, 700);
    return () => clearTimeout(t);
  }, [f, ph, tanggal]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveDraft = async () => {
    setBusy('draft');
    try { await persist(); onSaved?.('draft'); }
    catch (e) { setErrors([`Draft gagal disimpan: ${e.message}`]); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    finally { setBusy(''); }
  };

  // ───── Kirim ke database ─────
  const up = async (item, kind) => {
    if (!item) return null;
    if (item.path && !item.blob) return item.path;
    let p = uploaded.current.get(item.blob);
    if (!p) { p = await api.uploadPhoto(item.blob, userId, kind); uploaded.current.set(item.blob, p); }
    return p;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setErrors(check.problems);
    if (!check.complete) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setBusy('submit');
    try {
      const [foto_path, foto_km_isi, foto_km_akhir, foto_serah_terima, foto_surat_jalan, foto_kendala, foto_sisa_bbm] = await Promise.all([
        up(ph.km_awal, 'km_awal'), up(ph.km_isi, 'km_isi'), up(ph.km_akhir, 'km_akhir'),
        Promise.all(ph.serah_terima.map((i) => up(i, 'serah_terima'))),
        Promise.all(ph.surat_jalan.map((i) => up(i, 'surat_jalan'))),
        Promise.all(ph.kendala.map((i) => up(i, 'kendala'))),
        up(ph.sisa_bbm[0], 'sisa_bbm'),
      ]);
      const keepPrice = editing && initial.vehicle_id === f.vehicle_id;
      const tujuan = f.tujuan.map(normTujuan).filter(Boolean);
      const row = {
        tanggal: editing ? tanggal : tanggal || todayISO(),
        vehicle_id: f.vehicle_id,
        driver1_id: f.driver1_id,
        driver2_id: f.driver2_id || null,
        tujuan,
        bbm_rp: +f.bbm_rp, tol_rp: +f.tol_rp || 0, parkir_rp: +f.parkir_rp || 0,
        parkir_cash_rp: +f.parkir_cash_rp || 0, kuli_bongkar_rp: +f.kuli_bongkar_rp || 0, security_rp: +f.security_rp || 0,
        total_rp: calc.total,
        kartu4: f.kartu4,
        km_awal: +f.km_awal, km_isi: +f.km_isi, km_akhir: +f.km_akhir,
        foto_path, foto_km_isi, foto_km_akhir, foto_serah_terima, foto_surat_jalan, foto_kendala, foto_sisa_bbm,
        kendala_ket: f.kendala_ket.trim() || null,
        harga_liter: keepPrice ? initial.harga_liter : harga,
      };
      if (editing) await api.updateTrip(initial.id, row);
      else await api.createTrip({ ...row, created_by: userId });
      // tujuan baru dari driver → masuk daftar pilihan (kegagalan di sini tidak membatalkan data)
      await api.addDestinations(tujuan).catch(() => {});
      if (!editing) await drafts.remove(draftId).catch(() => {});
      setErrors([]);
      onSaved?.(editing ? 'edited' : 'submitted');
    } catch (err) { setErrors([err.message]); window.scrollTo({ top: 0, behavior: 'smooth' }); } finally { setBusy(''); }
  };

  const kmWarn = {
    awal: () => '',
    isi: (v) => (f.km_awal !== '' && v < +f.km_awal ? 'lebih kecil dari KM awal' : ''),
    akhir: (v) => (f.km_isi !== '' && v < +f.km_isi ? 'lebih kecil dari KM saat isi BBM'
      : f.km_awal !== '' && v < +f.km_awal ? 'lebih kecil dari KM awal' : ''),
  };
  const dateLabel = draft ? fmtLongDate(new Date(`${tanggal}T12:00:00+07:00`)) : fmtLongDate(now);
  const doneN = check.steps.filter((s) => s.ok).length;

  return (
    <form className="tripform" onSubmit={submit} noValidate>
      {errors.length > 0 && (
        <div className="err-box" role="alert">
          <b>{editing ? 'Periksa kembali:' : 'Data belum lengkap — belum bisa dikirim:'}</b>
          <ul>{errors.map((m) => <li key={m}>{m}</li>)}</ul>
          {!editing && check.problems.length > 0 && <p className="err-hint">Tidak apa-apa — tekan <b>Simpan sementara</b>, lanjutkan nanti.</p>}
        </div>
      )}

      {!editing && (
        <div className="progress-card" aria-label="Kelengkapan data">
          <div className="progress-top">
            <b>{doneN === check.steps.length ? 'Semua data wajib sudah lengkap ✓' : `Kelengkapan: ${doneN} dari ${check.steps.length}`}</b>
            <small>{draftErr ? <span className="err">⚠ {draftErr}</span>
              : savedAt ? <>Draft tersimpan otomatis di HP · {fmtClock(savedAt).slice(0, 5)}</> : 'Draft tersimpan otomatis di HP saat Anda mengisi'}</small>
          </div>
          <ul className="steps">{check.steps.map((s) => <li key={s.key} className={s.ok ? 'ok' : ''}>{s.ok ? '✓' : '○'} {s.label}</li>)}</ul>
        </div>
      )}

      <section className="card">
        <h3 className="card-t"><span>1</span> Tanggal & kru</h3>
        <div className="grid2">
          <div>
            <label>Tanggal</label>
            {editing ? (
              <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required />
            ) : (
              <div className="datebox" aria-live="off">
                <b>{dateLabel}</b>
                {draft ? <span>tanggal mulai perjalanan</span> : <span className="mono">{fmtClock(now)} WIB</span>}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="vehicle">Mobil <i className="req">*</i></label>
            <select id="vehicle" value={f.vehicle_id} onChange={(e) => set('vehicle_id')(e.target.value)}>
              <option value="">Pilih mobil…</option>
              {activeVehicles.map((v) => <option key={v.id} value={v.id}>{vehicleLabel(v)} — {v.bbm_jenis}</option>)}
            </select>
            {vehicle && <small className="hint">BBM {vehicle.bbm_jenis} · {rp(harga)}/liter</small>}
          </div>
          <div>
            <label htmlFor="d1">Driver 1 <i className="req">*</i></label>
            <select id="d1" value={f.driver1_id} onChange={(e) => set('driver1_id')(e.target.value)}>
              <option value="">Pilih driver…</option>
              {activeDrivers.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="d2">Driver 2 <small>(kosongkan bila jalan sendiri)</small></label>
            <select id="d2" value={f.driver2_id} onChange={(e) => set('driver2_id')(e.target.value)}>
              <option value="">— Tidak ada —</option>
              {activeDrivers.filter((d) => d.id !== f.driver1_id).map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="card">
        <h3 className="card-t"><span>2</span> Tujuan</h3>
        <p className="muted small tujuan-note">Pilih dari daftar atau <b>ketik sendiri</b>. Tujuan baru yang Anda ketik otomatis masuk daftar pilihan setelah data dikirim.</p>
        {f.tujuan.map((t, i) => {
          const isNew = t.trim() && !knownDest.has(normTujuan(t));
          return (
            <div className="tujuan-item" key={i}>
              <div className="tujuan-row">
                <ComboInput value={t} options={destOptions} placeholder={`Tujuan ${i + 1} — pilih atau ketik`} ariaLabel={`Tujuan ${i + 1}`}
                  onChange={(v) => set('tujuan')(f.tujuan.map((x, j) => (j === i ? v : x)))} />
                {f.tujuan.length > 1 && (
                  <button type="button" className="btn-icon danger" aria-label={`Hapus tujuan ${i + 1}`}
                    onClick={() => set('tujuan')(f.tujuan.filter((_, j) => j !== i))}>✕</button>
                )}
              </div>
              {isNew && <small className="hint new-dest">＋ Tujuan baru — akan ditambahkan ke daftar pilihan</small>}
            </div>
          );
        })}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('tujuan')([...f.tujuan, ''])}>+ Tambah tujuan</button>
      </section>

      <section className="card">
        <h3 className="card-t"><span>3</span> Biaya</h3>
        <div className="grid2">
          <div>
            <label htmlFor="bbm">Nominal BBM <i className="req">*</i></label>
            <MoneyInput id="bbm" value={f.bbm_rp} onChange={set('bbm_rp')} />
          </div>
          <div>
            <label htmlFor="kartu">4 digit nomor kartu <i className="req">*</i></label>
            <input id="kartu" className="mono" inputMode="numeric" maxLength={4} placeholder="••••" value={f.kartu4}
              onChange={(e) => set('kartu4')(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          </div>
          <div>
            <label htmlFor="tol">Jumlah tol <small>(opsional)</small></label>
            <MoneyInput id="tol" value={f.tol_rp} onChange={set('tol_rp')} />
          </div>
          <div>
            <label htmlFor="parkir">Parkir <small>(opsional)</small></label>
            <MoneyInput id="parkir" value={f.parkir_rp} onChange={set('parkir_rp')} />
          </div>
          <div>
            <label htmlFor="parkir_cash">Parkir cash <small>(opsional)</small></label>
            <MoneyInput id="parkir_cash" value={f.parkir_cash_rp} onChange={set('parkir_cash_rp')} />
          </div>
          <div>
            <label htmlFor="kuli">Kuli bongkar <small>(opsional)</small></label>
            <MoneyInput id="kuli" value={f.kuli_bongkar_rp} onChange={set('kuli_bongkar_rp')} />
          </div>
          <div>
            <label htmlFor="security">Security <small>(opsional)</small></label>
            <MoneyInput id="security" value={f.security_rp} onChange={set('security_rp')} />
          </div>
        </div>
        <p className="muted small">Tol, parkir, parkir cash, kuli bongkar &amp; security tidak wajib dan tidak menahan pengiriman data — isi kapan saja sebelum dikirim.</p>
        <div className="totalbar"><span>Total biaya <small>(BBM + tol + parkir + parkir cash + kuli bongkar + security)</small></span><b className="mono">{rp(calc.total)}</b></div>
      </section>

      <section className="card">
        <h3 className="card-t"><span>4</span> Kilometer</h3>
        <p className="odo-note"><b>📌 Catatan foto KM:</b> {ODO_NOTE}</p>
        {!editing && <p className="muted small">KM saat isi BBM &amp; KM akhir belum bisa diisi saat masih di jalan? Isi KM awal dulu, tekan <b>Simpan sementara</b>, lalu lanjutkan nanti.</p>}
        <div className="odo-list">
          <OdoPhoto id="kmawal" title="Foto KM awal" required={!editing} item={ph.km_awal} onItem={setPhoto('km_awal')} km={f.km_awal} onKm={set('km_awal')} check={kmWarn.awal} />
          <OdoPhoto id="kmisi" title="Foto KM saat isi BBM" required={!editing} item={ph.km_isi} onItem={setPhoto('km_isi')} km={f.km_isi} onKm={set('km_isi')} check={kmWarn.isi} />
          <OdoPhoto id="kmakhir" title="Foto KM akhir" required={!editing} item={ph.km_akhir} onItem={setPhoto('km_akhir')} km={f.km_akhir} onKm={set('km_akhir')} check={kmWarn.akhir} />
        </div>
        {f.km_awal !== '' && f.km_akhir !== '' && +f.km_akhir >= +f.km_awal && (
          <div className="calc">
            <div><small>Total jarak</small><b className="mono">{int(calc.jarak)} km</b></div>
            <div><small>BBM</small><b className="mono">{num(calc.liter)} L</b></div>
            <div><small>KM / liter</small><b className="mono accent">{num(calc.kmL)}</b></div>
            {calc.n === 2 && (
              <div className="calc-wide"><small>Dibagi 2 driver (bagian masing-masing)</small>
                <b className="mono">{num(calc.jarak / 2, 1)} km · {rp((+f.bbm_rp || 0) / 2)} · {num(calc.liter / 2)} L · <span className="accent">{num(calc.kmLd)} KM/L</span></b></div>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h3 className="card-t"><span>5</span> Dokumen pengiriman</h3>
        <div className="docs">
          <MultiPhoto title="Bukti serah terima dengan customer" required note="Foto saat barang diserahkan / diterima customer."
            items={ph.serah_terima} onItems={setPhoto('serah_terima')} />
          <MultiPhoto title="Surat jalan yang sudah ditandatangani" required note="Pastikan tanda tangan & stempel penerima terbaca jelas."
            items={ph.surat_jalan} onItems={setPhoto('surat_jalan')} />
          <MultiPhoto title="Foto sisa bar bensin" optional max={1} note="Foto indikator bensin setelah pengiriman selesai. Tidak wajib — bisa juga diunggah nanti dari tab RIWAYAT."
            items={ph.sisa_bbm} onItems={setPhoto('sisa_bbm')} />
          <div>
            <MultiPhoto title="Foto kendala saat pengiriman" optional note="Misal: barang rusak, jalan tertutup, ban bocor, antrean bongkar. Kosongkan bila tidak ada kendala."
              items={ph.kendala} onItems={setPhoto('kendala')} />
            <label htmlFor="kendala" className="kendala-l">Keterangan kendala <small>(opsional)</small></label>
            <textarea id="kendala" rows={3} value={f.kendala_ket} maxLength={500} placeholder="Ceritakan singkat kendala yang dialami…"
              onChange={(e) => set('kendala_ket')(e.target.value)} />
          </div>
        </div>
      </section>

      <div className="form-actions">
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>{editing ? 'Batal' : '← Kembali'}</button>}
        {!editing && <button type="button" className="btn btn-ghost btn-lg" disabled={Boolean(busy) || !dirty} onClick={saveDraft}>{busy === 'draft' ? 'Menyimpan…' : '💾 Simpan sementara'}</button>}
        <button className="btn btn-primary btn-lg" disabled={Boolean(busy)}>{busy === 'submit' ? 'Mengirim…' : editing ? 'Simpan perubahan' : 'Kirim data'}</button>
      </div>
    </form>
  );
}

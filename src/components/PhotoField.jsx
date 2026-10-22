import { useRef, useState } from 'react';
import { compressImage, int } from '../lib/format.js';
import { readOdometer } from '../lib/ocr.js';
import { dropItem, mkItem } from '../lib/photoItem.js';
import { stampBlob } from '../lib/watermark.js';
import CameraCapture from './CameraCapture.jsx';
import CropEditor from './CropEditor.jsx';
import Ic from './MiniIcons.jsx';
import PhotoSourceSheet from './PhotoSourceSheet.jsx';
import { NumInput } from './ui.jsx';

export const ODO_NOTE = 'Pastikan nomor ODO terlihat jelas dan dekat. Pas-kan angka di dalam kotak bidik — foto otomatis terpotong & ter-zoom ke angkanya.';

/**
 * Satu blok: foto odometer + isian angka KM. Ketuk kotak foto → pilih KAMERA (dengan kotak bidik) atau GALERI.
 * Angka dibaca otomatis dari foto (OCR) dan selalu bisa dikoreksi.
 *
 * check(value) → string peringatan bila angka janggal (mis. lebih kecil dari KM sebelumnya)
 */
export function OdoPhoto({ title, required, item, onItem, km, onKm, check, id }) {
  const [cam, setCam] = useState(false);
  const [sheet, setSheet] = useState(false);       // lembar pilihan KAMERA / GALERI
  const [file, setFile] = useState(null);          // foto galeri menunggu dipotong
  const [ocr, setOcr] = useState({ state: 'idle', msg: '' });
  const galRef = useRef(null);
  const nativeRef = useRef(null);                  // cadangan: kamera bawaan HP bila kamera langsung tak tersedia
  const seq = useRef(0);
  const shotAt = useRef(null);                     // waktu foto diambil (galeri: lastModified; kamera: sekarang)

  const take = async (blob) => {
    const at = shotAt.current; shotAt.current = null;
    setCam(false); setFile(null);
    dropItem(item);
    onItem(mkItem(await stampBlob(blob, at ?? Date.now())));   // OCR tetap membaca foto asli tanpa watermark
    const mine = ++seq.current;
    setOcr({ state: 'busy', msg: 'Membaca angka KM dari foto…' });
    try {
      const r = await readOdometer(blob, (m) => mine === seq.current && setOcr({ state: 'busy', msg: m }));
      if (mine !== seq.current) return;
      if (r) {
        onKm(r.value);
        const warn = check?.(r.value);
        setOcr(warn
          ? { state: 'warn', msg: `Terbaca ${int(r.value)}, tetapi ${warn}. Periksa & koreksi.` }
          : { state: 'ok', msg: `Terbaca ${int(r.value)} (keyakinan ${r.confidence}%). Periksa dan koreksi bila perlu.` });
      } else setOcr({ state: 'warn', msg: 'Angka KM tidak terbaca. Ketik manual, atau ulangi foto lebih dekat.' });
    } catch {
      if (mine === seq.current) setOcr({ state: 'warn', msg: 'OCR tidak tersedia saat ini. Isi angka KM secara manual.' });
    }
  };

  const openCamera = () => {
    if (navigator.mediaDevices?.getUserMedia) setCam(true); else nativeRef.current?.click();
  };
  const picked = (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setCam(false); shotAt.current = f.lastModified; setFile(f); } };
  const remove = () => { seq.current++; dropItem(item); onItem(null); setOcr({ state: 'idle', msg: '' }); };
  const warnNow = km !== '' && check?.(+km);

  return (
    <div className="odo">
      <div className="odo-h"><b>{title}{required && <i className="req"> *</i>}</b></div>
      <button type="button" className={'photo-btn odo-prev' + (item ? ' has' : '')} onClick={() => setSheet(true)}
        aria-label={item ? `${title} — ketuk untuk melihat, mengganti, atau menghapus` : `${title} — ketuk untuk mengambil foto`}>
        {item?.url ? (
          <>
            <img src={item.url} alt={title} />
            <span className="pb-edit"><Ic n="cam" /> UBAH</span>
          </>
        ) : (
          <span className="pb-empty"><Ic n="cam" /><b>KETUK UNTUK FOTO</b><small>Kamera atau galeri</small></span>
        )}
      </button>
      {ocr.state !== 'idle' && <p className={'ocr ' + ocr.state}>{ocr.state === 'busy' && <span className="spinner sm" />} {ocr.msg}</p>}
      <input ref={galRef} type="file" accept="image/*" hidden onChange={picked} />
      <input ref={nativeRef} type="file" accept="image/*" capture="environment" hidden onChange={picked} />

      <label htmlFor={id}>{title.replace(/^Foto /i, '')} <small>(angka di odometer)</small> {required && <i className="req">*</i>}</label>
      <NumInput id={id} value={km} onChange={(v) => { onKm(v); }} placeholder="otomatis dari foto" />
      {warnNow && ocr.state !== 'warn' && <small className="hint warn-t">⚠ {warnNow}</small>}

      {sheet && (
        <PhotoSourceSheet title={title} hasPhoto={Boolean(item)} photoUrl={item?.url}
          cameraNote="Dengan kotak bidik — angka ODO otomatis terpotong" galleryNote="Pilih foto, lalu geser & zoom ke angka ODO"
          onClose={() => setSheet(false)} onCamera={openCamera} onGallery={() => galRef.current?.click()} onRemove={remove} />
      )}
      {cam && <CameraCapture title={title} onCapture={take} onCancel={() => setCam(false)} onUnavailable={() => { setCam(false); galRef.current?.click(); }} />}
      {file && <CropEditor file={file} title={title} onDone={take} onCancel={() => setFile(null)} />}
    </div>
  );
}

/**
 * Banyak foto dokumen (serah terima, surat jalan, kendala): kamera bawaan HP atau galeri.
 * Tidak dipotong — dokumen perlu terlihat utuh.
 */
export function MultiPhoto({ title, note, required, optional, items, onItems, max = 6 }) {
  const camRef = useRef(null);
  const galRef = useRef(null);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const add = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setBusy(true); setErr('');
    try {
      const room = max - items.length;
      const blobs = await Promise.all(files.slice(0, room).map(async (f) => stampBlob(await compressImage(f, 1600, 0.82), f.lastModified)));
      onItems([...items, ...blobs.map(mkItem)]);
      if (files.length > room) setErr(`Maksimal ${max} foto — sebagian tidak ditambahkan.`);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const del = (it) => { dropItem(it); onItems(items.filter((x) => x.id !== it.id)); };
  const full = items.length >= max;

  return (
    <div className="multi">
      <div className="odo-h">
        <b>{title}{required && <i className="req"> *</i>}{optional && <small> (opsional)</small>}</b>
        <span className="count">{items.length}/{max}</span>
      </div>
      {note && <p className="muted small multi-note">{note}</p>}
      <div className={'thumbs' + (items.length === 0 ? ' empty' : '')}>
        {items.map((it, i) => (
          <figure key={it.id}>
            {it.url ? <a href={it.url} target="_blank" rel="noreferrer"><img src={it.url} alt={`${title} ${i + 1}`} /></a> : <div className="thumb-wait"><span className="spinner sm" /></div>}
            <button type="button" className="thumb-x" aria-label={`Hapus foto ${i + 1}`} onClick={() => del(it)}>✕</button>
          </figure>
        ))}
        {!full && (
          <button type="button" className={'add-tile' + (items.length === 0 ? ' empty' : '')} disabled={busy} onClick={() => setSheet(true)}
            aria-label={`Tambah ${title}`}>
            {busy ? <span className="spinner sm" /> : <Ic n={items.length === 0 ? 'cam' : 'plus'} />}
            <b>{items.length === 0 ? 'KETUK UNTUK FOTO' : 'TAMBAH'}</b>
            {items.length === 0 && <small>Kamera atau galeri</small>}
          </button>
        )}
      </div>
      {err && <p className="err small">{err}</p>}
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={add} />
      <input ref={galRef} type="file" accept="image/*" multiple hidden onChange={add} />
      {sheet && <PhotoSourceSheet title={title} onClose={() => setSheet(false)} cameraNote="Foto dokumen langsung sekarang" galleryNote="Pilih satu atau beberapa foto dari HP"
        onCamera={() => camRef.current?.click()} onGallery={() => galRef.current?.click()} />}
    </div>
  );
}

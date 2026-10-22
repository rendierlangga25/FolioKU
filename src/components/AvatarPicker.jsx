import { useEffect, useRef, useState } from 'react';
import { Modal } from './ui.jsx';
import { stampDataUrl } from '../lib/watermark.js';

const S = 280;   // kotak potong (px)
const OUT_DEFAULT = 320; // hasil akhir (px)

/** Geser & zoom foto ke kotak persegi, hasilnya JPEG 320×320 (data-URL ±20 KB). */
function SquareCrop({ file, onDone, onCancel, title = 'ATUR FOTO PROFIL', hint = 'Geser foto, atur zoom sampai wajah pas di tengah.', out = OUT_DEFAULT }) {
  const [img, setImg] = useState(null);
  const [z, setZ] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef(null);

  useEffect(() => {
    const url = URL.createObjectURL(file); const el = new Image();
    el.onload = () => setImg({ el, w: el.naturalWidth, h: el.naturalHeight });
    el.src = url; return () => URL.revokeObjectURL(url);
  }, [file]);

  const base = img ? S / Math.min(img.w, img.h) : 1;
  const scale = base * z;
  const clamp = (o, sc = scale) => img ? ({
    x: Math.max(-(img.w * sc - S) / 2, Math.min((img.w * sc - S) / 2, o.x)),
    y: Math.max(-(img.h * sc - S) / 2, Math.min((img.h * sc - S) / 2, o.y)),
  }) : o;
  const setZoom = (v) => { setZ(v); setOff((o) => clamp(o, base * v)); };

  const down = (e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, o: off }; };
  const move = (e) => { if (drag.current) setOff(clamp({ x: drag.current.o.x + e.clientX - drag.current.x, y: drag.current.o.y + e.clientY - drag.current.y })); };
  const up = () => { drag.current = null; };

  const done = () => {
    const size = S / scale;
    const sx = img.w / 2 - off.x / scale - size / 2; const sy = img.h / 2 - off.y / scale - size / 2;
    const c = document.createElement('canvas'); c.width = c.height = out;
    c.getContext('2d').drawImage(img.el, sx, sy, size, size, 0, 0, out, out);
    onDone(c.toDataURL('image/jpeg', out > 400 ? 0.82 : 0.86));
  };

  return (
    <Modal title={title} size="sm" onClose={onCancel}>
      <p className="muted small" style={{ margin: 0 }}>{hint}</p>
      <div className="crop-stage" style={{ width: S, height: S }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {img && <img src={img.el.src} alt="" draggable={false} style={{ width: img.w * scale, height: img.h * scale, transform: `translate(calc(-50% + ${off.x}px), calc(-50% + ${off.y}px))` }} />}
        <i className="crop-mask" />
      </div>
      <label className="crop-zoom">ZOOM<input type="range" min="1" max="4" step="0.01" value={z} onChange={(e) => setZoom(+e.target.value)} /></label>
      <div className="form-actions sticky-foot">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>BATAL</button>
        <button type="button" className="btn btn-primary" disabled={!img} onClick={done}>PAKAI FOTO</button>
      </div>
    </Modal>
  );
}

const I = {
  eye: <path d="M12 5C6.5 5 2.7 8.6 1.5 12c1.2 3.4 5 7 10.5 7s9.3-3.6 10.5-7C21.3 8.6 17.5 5 12 5zm0 11.2a4.2 4.2 0 1 1 0-8.4 4.2 4.2 0 0 1 0 8.4zm0-6.4a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4z" />,
  up: <path d="M12 3l5.5 5.5-1.4 1.4L13 6.8V15h-2V6.8L7.9 9.9 6.5 8.5 12 3zM5 17h14v4H5v-4z" />,
  trash: <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 12H7L6 9z" />,
  cam: <path d="M9 4l-1.7 2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.3L15 4H9zm3 4.2a4.3 4.3 0 1 1 0 8.6 4.3 4.3 0 0 1 0-8.6zm0 2a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6z" />,
};
const Ic = ({ n }) => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{I[n]}</svg>;

/**
 * Foto profil yang bisa diklik. Bungkus komponen <Avatar/> sebagai children:
 *   <AvatarPicker photo={d.foto} canEdit onChange={...}><Avatar driver={d} /></AvatarPicker>
 *
 *  • Ada foto + boleh edit  → pilihan: LIHAT FOTO / UPLOAD FOTO / HAPUS FOTO
 *  • Belum ada foto + boleh edit → langsung membuka pemilih file (kamera atau galeri, sesuai pilihan HP)
 *  • Hanya boleh melihat → langsung tampil ukuran besar
 * onChange(dataURL | null) dipanggil setelah foto dipotong persegi.
 */
export default function AvatarPicker({ photo, canEdit = true, busy, onChange, children, label = 'FOTO PROFIL', stamp = false, cropHint, out, className = '', deleteNote = 'Kembali ke ikon siluet' }) {
  const [menu, setMenu] = useState(null);   // null | 'menu' | 'view'
  const [file, setFile] = useState(null);
  const input = useRef(null);

  const choose = () => input.current?.click();
  const pick = (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setMenu(null); setFile(f); } };
  const open = () => {
    if (busy) return;
    if (canEdit && !photo) choose();
    else if (!canEdit && photo) setMenu('view');
    else setMenu('menu');
  };
  const interactive = canEdit || Boolean(photo);

  return (
    <>
      {/* tanpa capture: HP menawarkan KAMERA atau GALERI sendiri */}
      <input ref={input} type="file" accept="image/*" hidden onChange={pick} />
      {interactive ? (
        <button type="button" className={'av-click ' + className} onClick={open} disabled={busy}
          aria-label={canEdit ? `${label} — ketuk untuk melihat atau mengubah` : `Lihat ${label.toLowerCase()}`}>
          {children}
          {canEdit && <span className="av-cam" aria-hidden="true"><Ic n="cam" /></span>}
        </button>
      ) : children}

      {menu && (
        <Modal title={label} size="sm" onClose={() => setMenu(null)}>
          {menu === 'view' ? (
            <>
              <div className="av-view"><img src={photo} alt={label} /></div>
              <div className="av-view-f">
                {canEdit && <button type="button" className="btn btn-ghost" onClick={() => setMenu('menu')}>← KEMBALI</button>}
                <button type="button" className="btn btn-primary" onClick={() => setMenu(null)}>TUTUP</button>
              </div>
            </>
          ) : (
            <div className="av-menu">
              {photo && (
                <button type="button" className="av-opt" onClick={() => setMenu('view')}>
                  <Ic n="eye" /><span><b>LIHAT FOTO</b><small>Tampilkan dalam ukuran besar</small></span>
                </button>
              )}
              <button type="button" className="av-opt" onClick={choose}>
                <Ic n="up" /><span><b>UPLOAD FOTO</b><small>Ambil dari kamera atau pilih dari galeri</small></span>
              </button>
              {photo && (
                <button type="button" className="av-opt danger" onClick={() => { if (confirm(`Hapus ${label.toLowerCase()}?`)) { setMenu(null); onChange(null); } }}>
                  <Ic n="trash" /><span><b>HAPUS FOTO</b><small>{deleteNote}</small></span>
                </button>
              )}
            </div>
          )}
        </Modal>
      )}
      {file && <SquareCrop title={`ATUR ${label}`} hint={cropHint} out={out} file={file} onCancel={() => setFile(null)} onDone={async (d) => { const at = file.lastModified; setFile(null); onChange(stamp ? await stampDataUrl(d, at) : d); }} />}
    </>
  );
}

import { useEffect, useRef, useState } from 'react';
import { cropSourceRect, drawCrop, frameSize } from '../lib/imageCrop.js';

/**
 * Untuk foto dari GALERI: geser & zoom foto sampai angka ODO pas di dalam kotak,
 * lalu foto dipotong persis seukuran kotak — hasilnya sama dengan jepretan kamera.
 */
export default function CropEditor({ file, title, onDone, onCancel }) {
  const stage = useRef(null);
  const [img, setImg] = useState(null);                // { el, w, h, url }
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [z, setZ] = useState(1);                       // pengali zoom (1 = ukuran minimum)
  const [c, setC] = useState({ x: 0, y: 0 });          // titik gambar (piksel) di tengah kotak bidik
  const pts = useRef(new Map());
  const pinch = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => { setImg({ el, w: el.naturalWidth, h: el.naturalHeight, url }); setC({ x: el.naturalWidth / 2, y: el.naturalHeight / 2 }); };
    el.onerror = () => setErr('File bukan gambar yang valid');
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const m = () => { const r = stage.current?.getBoundingClientRect(); if (r) setBox({ w: r.width, h: r.height }); };
    m(); window.addEventListener('resize', m);
    const k = (e) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', k);
    return () => { document.body.style.overflow = ''; window.removeEventListener('resize', m); document.removeEventListener('keydown', k); };
  }, [onCancel]);

  const f = frameSize(box.w || 1, box.h || 1);
  // skala minimum: seluruh foto muat di layar DAN kotak bidik selalu terisi penuh oleh foto
  const minScale = img ? Math.max(Math.min(box.w / img.w, box.h / img.h), f.fw / img.w, f.fh / img.h) : 1;
  const scale = minScale * z;

  const clampC = (p) => img ? ({
    x: Math.max(f.fw / 2 / scale, Math.min(img.w - f.fw / 2 / scale, p.x)),
    y: Math.max(f.fh / 2 / scale, Math.min(img.h - f.fh / 2 / scale, p.y)),
  }) : p;
  const cc = clampC(c);
  const left = f.fx + f.fw / 2 - cc.x * scale;
  const top = f.fy + f.fh / 2 - cc.y * scale;

  const setZoom = (nz) => setZ(Math.max(1, Math.min(8, nz)));

  const down = (e) => { e.currentTarget.setPointerCapture?.(e.pointerId); pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.current.size === 2) pinch.current = null; };
  const move = (e) => {
    const p = pts.current.get(e.pointerId);
    if (!p) return;
    const n = { x: e.clientX, y: e.clientY };
    if (pts.current.size === 1) {
      setC((cur) => ({ x: clampC(cur).x - (n.x - p.x) / scale, y: clampC(cur).y - (n.y - p.y) / scale }));
    } else if (pts.current.size === 2) {
      pts.current.set(e.pointerId, n);
      const [a, b] = [...pts.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current) setZoom(z * (dist / pinch.current));
      pinch.current = dist;
      return;
    }
    pts.current.set(e.pointerId, n);
  };
  const up = (e) => { pts.current.delete(e.pointerId); pinch.current = null; };
  const wheel = (e) => setZoom(z * Math.exp(-e.deltaY * 0.0015));

  const confirm = async () => {
    setBusy(true);
    try {
      const rect = cropSourceRect({ scale, left, top, fx: f.fx, fy: f.fy, fw: f.fw, fh: f.fh });
      onDone(await drawCrop(img.el, rect, img.w, img.h));
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <div className="cam" role="dialog" aria-modal="true" aria-label={title}>
      <div className="cam-stage cropper" ref={stage} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel}>
        {img && box.w > 0 && (
          <img src={img.url} alt="Foto dari galeri" draggable={false}
            style={{ position: 'absolute', left, top, width: img.w * scale, height: img.h * scale, maxWidth: 'none' }} />
        )}
        {box.w > 0 && <div className="cam-frame" style={{ left: f.fx, top: f.fy, width: f.fw, height: f.fh }}><i /><i /><i /><i /></div>}
        <p className="cam-tip" style={{ top: Math.max(8, f.fy - 78) }}>
          <b>{title}</b>Geser &amp; zoom foto sampai <u>angka ODO</u> pas di dalam kotak.
        </p>
        {!img && !err && <div className="cam-msg"><div className="spinner" /></div>}
        {err && <div className="cam-msg err"><p>{err}</p></div>}
      </div>
      <label className="cam-zoom">🔍
        <input type="range" min={1} max={8} step={0.05} value={z} onChange={(e) => setZoom(+e.target.value)} aria-label="Zoom" />
      </label>
      <div className="cam-bar">
        <button type="button" className="btn btn-ghost light" onClick={onCancel}>Batal</button>
        <button type="button" className="btn btn-accent btn-lg" disabled={!img || busy} onClick={confirm}>{busy ? 'Memotong…' : '✓ Potong & pakai'}</button>
      </div>
    </div>
  );
}

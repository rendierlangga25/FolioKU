import { useEffect, useRef, useState } from 'react';
import { coverSourceRect, drawCrop, frameSize } from '../lib/imageCrop.js';

/**
 * Kamera layar penuh dengan KOTAK BIDIK untuk angka odometer.
 * Saat jepret, foto otomatis dipotong persis di dalam kotak (jadi sudah "zoom" ke angka KM).
 *
 * onCapture(blob) · onCancel() · onUnavailable() → dipanggil bila kamera tidak bisa dibuka
 * (izin ditolak / bukan HTTPS) agar pemanggil memakai pilihan lain.
 */
export default function CameraCapture({ title, onCapture, onCancel, onUnavailable }) {
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [state, setState] = useState('starting'); // starting | live | review | error
  const [err, setErr] = useState('');
  const [zoom, setZoom] = useState(null);          // { min, max, step, value } bila kamera mendukung
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [shot, setShot] = useState(null);          // { blob, url }

  // ukuran area → ukuran kotak bidik
  useEffect(() => {
    const m = () => { const r = wrapRef.current?.getBoundingClientRect(); if (r) setBox({ w: r.width, h: r.height }); };
    m(); window.addEventListener('resize', m); window.addEventListener('orientationchange', m);
    return () => { window.removeEventListener('resize', m); window.removeEventListener('orientationchange', m); };
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const k = (e) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', k);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', k); };
  }, [onCancel]);

  const stop = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };

  const start = async () => {
    stop(); setState('starting'); setErr('');
    if (!navigator.mediaDevices?.getUserMedia) { setErr('Browser ini tidak mendukung kamera langsung.'); setState('error'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      v.srcObject = stream;
      await v.play().catch(() => {});
      const track = stream.getVideoTracks()[0];
      const cap = track.getCapabilities?.() || {};
      if (cap.zoom) setZoom({ min: cap.zoom.min, max: Math.min(cap.zoom.max, cap.zoom.min * 6 + 4), step: cap.zoom.step || 0.1, value: track.getSettings?.().zoom ?? cap.zoom.min });
      setState('live');
    } catch (e) {
      setErr(e?.name === 'NotAllowedError' ? 'Izin kamera ditolak. Aktifkan izin kamera di browser, atau pakai tombol Galeri.' : 'Kamera tidak bisa dibuka di perangkat ini.');
      setState('error');
    }
  };
  useEffect(() => { start(); return stop; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyZoom = (val) => {
    setZoom((z) => ({ ...z, value: val }));
    streamRef.current?.getVideoTracks()[0]?.applyConstraints({ advanced: [{ zoom: val }] }).catch(() => {});
  };

  const { fw, fh, fx, fy } = frameSize(box.w || 1, box.h || 1);

  const snap = async () => {
    const v = videoRef.current;
    if (!v?.videoWidth) return;
    try {
      const r = wrapRef.current.getBoundingClientRect();
      const rect = coverSourceRect({ vw: v.videoWidth, vh: v.videoHeight, cw: r.width, ch: r.height, fx, fy, fw, fh });
      const blob = await drawCrop(v, rect, v.videoWidth, v.videoHeight);
      setShot({ blob, url: URL.createObjectURL(blob) });
      setState('review');
    } catch (e) { setErr(e.message); }
  };
  const retake = () => { if (shot) URL.revokeObjectURL(shot.url); setShot(null); setState('live'); };
  const use = () => { stop(); onCapture(shot.blob); };

  return (
    <div className="cam" role="dialog" aria-modal="true" aria-label={title}>
      <div className="cam-stage" ref={wrapRef}>
        <video ref={videoRef} playsInline muted autoPlay className={state === 'review' ? 'hide' : ''} />
        {state === 'review' && shot && <img className="cam-shot" src={shot.url} alt="Hasil foto" />}

        {(state === 'live' || state === 'starting') && box.w > 0 && (
          <div className="cam-frame" style={{ left: fx, top: fy, width: fw, height: fh }}>
            <i /><i /><i /><i />
          </div>
        )}
        {state === 'live' && <p className="cam-tip" style={{ top: Math.max(8, fy - 78) }}>
          <b>{title}</b>Dekatkan kamera, pas-kan <u>deretan angka ODO</u> di dalam kotak sampai terlihat jelas.
        </p>}
        {state === 'starting' && <div className="cam-msg"><div className="spinner" /></div>}
        {state === 'error' && (
          <div className="cam-msg err">
            <p>{err}</p>
            <div className="cam-row">
              <button type="button" className="btn btn-accent" onClick={start}>Coba lagi</button>
              <button type="button" className="btn btn-ghost light" onClick={onUnavailable}>Pilih dari galeri</button>
            </div>
          </div>
        )}
        {state === 'review' && <p className="cam-tip cam-tip-b">Angka terbaca jelas? Bila buram, ulangi foto.</p>}
      </div>

      <div className="cam-bar">
        {state === 'review' ? (
          <>
            <button type="button" className="btn btn-ghost light" onClick={retake}>↺ Ulangi</button>
            <button type="button" className="btn btn-accent btn-lg" onClick={use}>✓ Pakai foto</button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-ghost light" onClick={onCancel}>Batal</button>
            <button type="button" className="shutter" aria-label="Ambil foto" disabled={state !== 'live'} onClick={snap} />
            <button type="button" className="btn btn-ghost light" onClick={onUnavailable}>Galeri</button>
          </>
        )}
      </div>
      {state === 'live' && zoom && zoom.max > zoom.min && (
        <label className="cam-zoom">🔍
          <input type="range" min={zoom.min} max={zoom.max} step={zoom.step} value={zoom.value} onChange={(e) => applyZoom(+e.target.value)} aria-label="Zoom" />
        </label>
      )}
    </div>
  );
}

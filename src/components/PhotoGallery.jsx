import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

/** Semua foto satu perjalanan, dikelompokkan per jenis. Klik untuk membuka ukuran penuh. */
export const photoGroups = (t) => [
  { label: 'KM awal', paths: [t.foto_path] },
  { label: 'KM saat isi BBM', paths: [t.foto_km_isi] },
  { label: 'KM akhir', paths: [t.foto_km_akhir] },
  { label: 'Bukti serah terima customer', paths: t.foto_serah_terima || [] },
  { label: 'Surat jalan (ditandatangani)', paths: t.foto_surat_jalan || [] },
  { label: 'Sisa bar bensin', paths: [t.foto_sisa_bbm] },
  { label: 'Kendala pengiriman', paths: t.foto_kendala || [] },
].map((g) => ({ ...g, paths: g.paths.filter(Boolean) })).filter((g) => g.paths.length);

export const photoCount = (t) => photoGroups(t).reduce((n, g) => n + g.paths.length, 0);

export default function PhotoGallery({ trip }) {
  const groups = photoGroups(trip);
  const [urls, setUrls] = useState({});
  useEffect(() => {
    let alive = true;
    groups.flatMap((g) => g.paths).forEach(async (p) => {
      const u = await api.photoUrl(p).catch(() => null);
      if (alive && u) setUrls((s) => ({ ...s, [p]: u }));
    });
    return () => { alive = false; };
  }, [trip.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!groups.length) return <p className="muted small">Tidak ada foto pada data ini.</p>;
  return (
    <div className="gallery">
      {groups.map((g) => (
        <div key={g.label} className={'gal-g' + (g.label.startsWith('Kendala') ? ' warn' : '')}>
          <small>{g.label}</small>
          <div className="gal-row">
            {g.paths.map((p) => (urls[p]
              ? <a key={p} href={urls[p]} target="_blank" rel="noreferrer"><img src={urls[p]} alt={g.label} loading="lazy" /></a>
              : <div key={p} className="thumb-wait"><span className="spinner sm" /></div>))}
          </div>
        </div>
      ))}
    </div>
  );
}

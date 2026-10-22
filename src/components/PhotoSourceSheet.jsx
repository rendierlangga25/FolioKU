import { useState } from 'react';
import Ic from './MiniIcons.jsx';
import { Modal } from './ui.jsx';

/**
 * Lembar pilihan setelah kotak foto diketuk: KAMERA atau GALERI.
 * Bila sudah ada foto (hasPhoto) tersedia juga LIHAT FOTO dan HAPUS FOTO.
 * Memilih opsi akan menutup lembar ini lalu menjalankan aksinya.
 */
export default function PhotoSourceSheet({ title, hasPhoto, photoUrl, cameraNote, galleryNote, onCamera, onGallery, onRemove, onClose }) {
  const [view, setView] = useState(false);
  const go = (fn) => () => { onClose(); fn(); };   // tutup dulu, lalu jalankan (klik file input tetap dalam gestur pengguna)

  if (view) {
    return (
      <Modal title={title} size="sm" onClose={onClose}>
        <div className="av-view"><img src={photoUrl} alt={title} /></div>
        <div className="av-view-f">
          <button type="button" className="btn btn-ghost" onClick={() => setView(false)}>← KEMBALI</button>
          <button type="button" className="btn btn-primary" onClick={onClose}>TUTUP</button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal title={title} size="sm" onClose={onClose}>
      <div className="av-menu">
        <button type="button" className="av-opt" onClick={go(onCamera)}>
          <Ic n="cam" /><span><b>KAMERA</b><small>{cameraNote || 'Foto langsung sekarang'}</small></span>
        </button>
        <button type="button" className="av-opt" onClick={go(onGallery)}>
          <Ic n="gallery" /><span><b>GALERI</b><small>{galleryNote || 'Pilih foto yang sudah ada di HP'}</small></span>
        </button>
        {hasPhoto && photoUrl && (
          <button type="button" className="av-opt" onClick={() => setView(true)}>
            <Ic n="eye" /><span><b>LIHAT FOTO</b><small>Tampilkan dalam ukuran besar</small></span>
          </button>
        )}
        {hasPhoto && onRemove && (
          <button type="button" className="av-opt danger" onClick={go(onRemove)}>
            <Ic n="trash" /><span><b>HAPUS FOTO</b><small>Hapus dan ambil ulang</small></span>
          </button>
        )}
      </div>
    </Modal>
  );
}

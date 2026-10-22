import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Logo from '../components/Logo.jsx';

const FEATURES = [
  { t: 'Input driver 1 menit', d: 'Tanggal otomatis, pilih driver & mobil, isi tujuan, BBM, tol, parkir. Total biaya terhitung sendiri.' },
  { t: 'KM dibaca dari foto', d: 'Foto odometer, angka KM awal terisi otomatis lewat OCR. Tinggal cek dan koreksi bila perlu.' },
  { t: 'Rekap otomatis per mobil', d: 'Jumlah tujuan, total jarak (KM akhir − KM awal), konsumsi KM/liter dan total BBM per mobil.' },
  { t: 'Adil untuk 2 driver', d: 'Satu mobil dua driver? Jarak dan BBM dibagi dua. Jalan sendiri? Tidak dibagi.' },
  { t: 'Akses diatur developer', d: 'Setiap user hanya melihat fitur yang diizinkan developer. Ubah kapan saja, tanpa perlu ubah kode.' },
  { t: 'Data master fleksibel', d: 'Nama driver, plat mobil, jenis BBM dan harga per liter bisa diganti sendiri oleh developer.' },
];

export default function Landing() {
  const { session } = useAuth();
  return (
    <div className="landing">
      <header className="l-nav">
        <Logo light />
        <nav>
          <a href="#fitur">Fitur</a>
          <a href="#alur">Cara kerja</a>
          {session ? (
            <Link className="btn btn-accent" to="/app">Buka aplikasi</Link>
          ) : (
            <>
              <Link className="l-link" to="/masuk">Masuk</Link>
              <Link className="btn btn-accent" to="/daftar">Daftar</Link>
            </>
          )}
        </nav>
      </header>

      <section className="l-hero">
        <div className="l-hero-copy">
          <p className="eyebrow">ERP operasional armada</p>
          <h1>Dari kunci kontak sampai laporan developer, <em>rapi</em> dalam satu tempat.</h1>
          <p className="lead">
            Driver cukup isi satu form. Developer langsung melihat tabel, ringkasan per mobil, per driver, dan konsumsi BBM
            tanpa rekap manual di Excel.
          </p>
          <div className="l-cta">
            <Link className="btn btn-accent btn-lg" to={session ? '/app' : '/daftar'}>{session ? 'Buka aplikasi' : 'Mulai sekarang'}</Link>
            {!session && <Link className="btn btn-ghost btn-lg" to="/masuk">Saya sudah punya akun</Link>}
          </div>
        </div>

        <div className="l-mock" aria-hidden="true">
          <div className="mock-card">
            <div className="mock-h"><span>DUTRO · B 9075 PCR</span><span className="chip">Solar</span></div>
            <div className="mock-row"><small>Tujuan hari ini</small><b>ADM SUNTER</b></div>
            <div className="mock-grid">
              <div><small>KM awal</small><b className="mono">185.559</b></div>
              <div><small>KM akhir</small><b className="mono">185.701</b></div>
              <div><small>Jarak</small><b className="mono">142 km</b></div>
              <div><small>KM / liter</small><b className="mono accent">5,36</b></div>
            </div>
            <div className="mock-split">
              <span>CEPI · 71 km · Rp 90.000</span>
              <span>RANTA · 71 km · Rp 90.000</span>
            </div>
          </div>
          <div className="mock-card mock-b">
            <small>Total BBM bulan ini</small>
            <b className="mono big">Rp 13.640.000</b>
            <div className="bars"><i style={{ height: '38%' }} /><i style={{ height: '62%' }} /><i style={{ height: '48%' }} /><i style={{ height: '80%' }} /><i style={{ height: '56%' }} /><i style={{ height: '70%' }} /></div>
          </div>
        </div>
      </section>

      <section id="fitur" className="l-section">
        <h2>Semua yang dulu direkap manual</h2>
        <div className="l-grid">
          {FEATURES.map((f, i) => (
            <article key={f.t} className="l-feature">
              <span className="num">{String(i + 1).padStart(2, '0')}</span>
              <h3>{f.t}</h3>
              <p>{f.d}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="alur" className="l-section l-dark">
        <h2>Cara kerjanya</h2>
        <ol className="l-steps">
          <li><b>Driver input</b><span>Foto KM, isi tujuan, BBM, tol dan parkir dari HP.</span></li>
          <li><b>Data tersimpan</b><span>Otomatis masuk database lengkap dengan foto bukti.</span></li>
          <li><b>Developer memantau</b><span>Tabel, ringkasan per mobil & driver, ekspor ke CSV.</span></li>
        </ol>
      </section>

      <footer className="l-foot">
        <Logo light />
        <span>© {new Date().getFullYear()} RAXER ERP</span>
      </footer>
    </div>
  );
}

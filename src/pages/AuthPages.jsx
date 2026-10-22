import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../auth.jsx';
import Logo from '../components/Logo.jsx';

function AuthLayout({ title, sub, children, foot }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <Link to="/"><Logo light /></Link>
        <div>
          <h2>Operasional armada, tanpa rekap manual.</h2>
          <p>Catat sekali di lapangan, laporan developer langsung jadi.</p>
        </div>
        {api.mode === 'demo' && (
          <p className="demo-note">
            <b>Mode demo</b> — data hanya tersimpan di browser ini.<br />
            Owner: <code>owner@raxer.test</code> / <code>owner123</code><br />
            Driver: <code>driver@raxer.test</code> / <code>driver123</code>
          </p>
        )}
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <Link to="/" className="auth-back">← Beranda</Link>
          <h1>{title}</h1>
          {sub && <p className="muted">{sub}</p>}
          {children}
          {foot && <p className="auth-foot">{foot}</p>}
        </div>
      </main>
    </div>
  );
}

function PasswordInput({ value, onChange, id = 'password', autoComplete, placeholder = 'Password' }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw">
      <input id={id} type={show ? 'text' : 'password'} value={value} onChange={onChange} required minLength={6}
        autoComplete={autoComplete} placeholder={placeholder} />
      <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}>
        {show ? 'Sembunyi' : 'Lihat'}
      </button>
    </div>
  );
}

export function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const savedEmail = (() => { try { return localStorage.getItem('raxer_email') || ''; } catch { return ''; } })();
  const [email, setEmail] = useState(savedEmail);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await api.signIn({ email: email.trim(), password, remember });
      try { remember ? localStorage.setItem('raxer_email', email.trim()) : localStorage.removeItem('raxer_email'); } catch {}
      nav('/app', { replace: true });
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <AuthLayout title="Masuk" sub="Selamat datang kembali." foot={<>Belum punya akun? <Link to="/daftar">Daftar</Link></>}>
      {loc.state?.from && <p className="note">Silakan masuk untuk melanjutkan.</p>}
      <form onSubmit={submit} className="form">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" placeholder="nama@perusahaan.com" />
        <label htmlFor="password">Password</label>
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        <div className="row-between">
          <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Ingat saya</label>
          <Link to="/lupa-password" className="small">Lupa password?</Link>
        </div>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</button>
      </form>
    </AuthLayout>
  );
}

export function Register() {
  const nav = useNavigate();
  const [f, setF] = useState({ nama: '', email: '', password: '', konfirmasi: '' });
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (f.password !== f.konfirmasi) return setErr('Konfirmasi password tidak sama');
    setErr(''); setBusy(true);
    try {
      const r = await api.signUp({ nama: f.nama.trim(), email: f.email.trim(), password: f.password });
      if (r.needsConfirm || r.demo) setDone(r);
      else nav('/app', { replace: true });
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  if (done) {
    return (
      <AuthLayout title="Pendaftaran berhasil">
        <p>{done.needsConfirm ? 'Kami mengirim email konfirmasi. Buka email Anda lalu klik tautan verifikasi, kemudian masuk.' : 'Akun sudah dibuat. Silakan masuk.'}</p>
        <p className="muted">Hak akses fitur akan diatur oleh developer setelah Anda masuk.</p>
        <Link className="btn btn-primary btn-block" to="/masuk">Ke halaman masuk</Link>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title="Daftar" sub="Buat akun. Developer yang menentukan fitur apa yang bisa Anda buka." foot={<>Sudah punya akun? <Link to="/masuk">Masuk</Link></>}>
      <form onSubmit={submit} className="form">
        <label htmlFor="nama">Nama lengkap</label>
        <input id="nama" value={f.nama} onChange={set('nama')} required autoComplete="name" />
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={f.email} onChange={set('email')} required autoComplete="email" />
        <label htmlFor="password">Password <small>(min. 6 karakter)</small></label>
        <PasswordInput value={f.password} onChange={set('password')} autoComplete="new-password" />
        <label htmlFor="konfirmasi">Ulangi password</label>
        <PasswordInput id="konfirmasi" value={f.konfirmasi} onChange={set('konfirmasi')} autoComplete="new-password" placeholder="Ulangi password" />
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Memproses…' : 'Buat akun'}</button>
      </form>
    </AuthLayout>
  );
}

export function Forgot() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api.resetPassword(email.trim()); setSent(true); } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return (
    <AuthLayout title="Lupa password" sub="Masukkan email akun Anda. Kami kirim tautan untuk membuat password baru." foot={<Link to="/masuk">← Kembali ke masuk</Link>}>
      {sent ? (
        <>
          <p className="ok">Jika email terdaftar, tautan reset sudah dikirim. Periksa kotak masuk (dan folder spam).</p>
          {api.mode === 'demo' && <Link className="btn btn-primary btn-block" to="/reset-password">Mode demo: lanjut ke buat password baru</Link>}
        </>
      ) : (
        <form onSubmit={submit} className="form">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          {err && <p className="err" role="alert">{err}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim tautan reset'}</button>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPassword() {
  const { recovery, session, loading } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const allowed = api.mode === 'demo' ? Boolean(sessionStorage.getItem('raxer_demo_reset')) : recovery || Boolean(session);

  useEffect(() => { if (done) { const t = setTimeout(() => nav(api.mode === 'demo' ? '/masuk' : '/app', { replace: true }), 1500); return () => clearTimeout(t); } }, [done, nav]);

  const submit = async (e) => {
    e.preventDefault();
    if (pw !== pw2) return setErr('Konfirmasi password tidak sama');
    setErr(''); setBusy(true);
    try { await api.updatePassword(pw); setDone(true); } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  if (loading) return <div className="splash"><div className="spinner" /></div>;
  return (
    <AuthLayout title="Buat password baru">
      {done ? <p className="ok">Password berhasil diubah. Mengalihkan…</p> : !allowed ? (
        <>
          <p className="err">Tautan reset tidak valid atau sudah kedaluwarsa.</p>
          <Link className="btn btn-primary btn-block" to="/lupa-password">Minta tautan baru</Link>
        </>
      ) : (
        <form onSubmit={submit} className="form">
          <label htmlFor="password">Password baru</label>
          <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          <label htmlFor="pw2">Ulangi password baru</label>
          <PasswordInput id="pw2" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" placeholder="Ulangi password" />
          {err && <p className="err" role="alert">{err}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan password'}</button>
        </form>
      )}
    </AuthLayout>
  );
}

import { useState } from 'react'
import { supabase, setRemember, getRemember } from '../supabase.js'
import { useAuth } from '../auth.jsx'

export function AuthPage({ mode, go }) {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [name, setName] = useState('')
  const [remember, setRem] = useState(getRemember())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null)
    try {
      if (mode === 'login') {
        setRemember(remember)
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
        if (error) throw error
      } else if (mode === 'register') {
        if (pass.length < 6) throw new Error('Password minimal 6 karakter.')
        setRemember(remember)
        const { data, error } = await supabase.auth.signUp({ email, password: pass, options: { data: { full_name: name } } })
        if (error) throw error
        if (!data.session) setMsg({ ok: true, t: 'Pendaftaran berhasil. Cek email untuk konfirmasi, lalu tunggu persetujuan developer.' })
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        setMsg({ ok: true, t: 'Link reset password sudah dikirim ke email kamu.' })
      }
    } catch (err) {
      const m = /Invalid login/i.test(err.message) ? 'Email atau password salah.' : err.message
      setMsg({ ok: false, t: m })
    } finally { setBusy(false) }
  }

  const title = { login: 'Masuk', register: 'Daftar akun', forgot: 'Lupa password' }[mode]
  return (
    <div className="auth-wrap">
      <aside className="auth-side">
        <button className="brand link" onClick={() => go('landing')}><span className="brand-mark">R</span> RAXER<small>ERP</small></button>
        <p className="auth-quote">“Data perjalanan rapi,<br />keputusan jadi cepat.”</p>
      </aside>
      <form className="auth-card" onSubmit={submit}>
        <h2>{title}</h2>
        {mode === 'register' && <p className="muted">Akun baru perlu disetujui developer sebelum bisa dipakai.</p>}
        {mode === 'forgot' && <p className="muted">Masukkan email, kami kirim link untuk membuat password baru.</p>}
        {mode === 'register' && (
          <label>Nama lengkap<input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
        )}
        <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        {mode !== 'forgot' && (
          <label>Password
            <input type="password" required value={pass} onChange={(e) => setPass(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </label>
        )}
        {mode !== 'forgot' && (
          <div className="row-between">
            <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRem(e.target.checked)} /> Ingat saya</label>
            {mode === 'login' && <button type="button" className="link-btn" onClick={() => go('forgot')}>Lupa password?</button>}
          </div>
        )}
        {msg && <div className={'note ' + (msg.ok ? 'ok' : 'err')}>{msg.t}</div>}
        <button className="btn solid lg block" disabled={busy}>{busy ? 'Memproses…' : title}</button>
        <p className="muted center">
          {mode === 'login' ? <>Belum punya akun? <button type="button" className="link-btn" onClick={() => go('register')}>Daftar</button></>
            : <>Sudah punya akun? <button type="button" className="link-btn" onClick={() => go('login')}>Masuk</button></>}
        </p>
      </form>
    </div>
  )
}

export function ResetPassword() {
  const { setRecovery } = useAuth()
  const [pass, setPass] = useState(''); const [msg, setMsg] = useState(null)
  const submit = async (e) => {
    e.preventDefault()
    if (pass.length < 6) return setMsg({ ok: false, t: 'Password minimal 6 karakter.' })
    const { error } = await supabase.auth.updateUser({ password: pass })
    if (error) return setMsg({ ok: false, t: error.message })
    setMsg({ ok: true, t: 'Password berhasil diubah.' }); setTimeout(() => setRecovery(false), 1200)
  }
  return (
    <div className="auth-wrap single">
      <form className="auth-card" onSubmit={submit}>
        <h2>Buat password baru</h2>
        <label>Password baru<input type="password" required value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" /></label>
        {msg && <div className={'note ' + (msg.ok ? 'ok' : 'err')}>{msg.t}</div>}
        <button className="btn solid lg block">Simpan password</button>
      </form>
    </div>
  )
}

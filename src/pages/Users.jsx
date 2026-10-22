import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../auth.jsx';
import { PERMISSIONS, TYPE_PRESET, USER_TYPES, matchDriver } from '../lib/permissions.js';
import { PageHead, Toast, useToast } from '../components/ui.jsx';
import { fmtDate } from '../lib/format.js';
import { useMaster } from '../lib/useMaster.js';

export default function Users() {
  const { session, refresh } = useAuth();
  const [users, setUsers] = useState(null);
  const master = useMaster();
  const [toast, say, clear] = useToast();

  const load = useCallback(() => api.listProfiles().then(setUsers).catch((e) => { setUsers([]); say(e.message, 'err'); }), []); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  // User berjenis DRIVER otomatis ditautkan ke data driver bernama sama (untuk PROFIL & PERFORMA).
  useEffect(() => {
    if (!users || master.loading) return;
    for (const u of users) {
      if (u.role === 'owner' || (u.user_type || 'DRIVER') !== 'DRIVER' || u.driver_id) continue;
      const m = matchDriver(u, master.drivers, users);
      if (m) { api.updateProfile(u.id, { driver_id: m.id }).then(() => setUsers((l) => l.map((x) => (x.id === u.id ? { ...x, driver_id: m.id } : x)))).catch(() => {}); break; }
    }
  }, [users, master.loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (u, p, msg = 'Tersimpan') => {
    setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, ...p } : x))); // optimistis
    try { await api.updateProfile(u.id, p); say(msg); if (u.id === session.user.id) refresh(); } catch (e) { say(e.message, 'err'); load(); }
  };
  const togglePerm = (u, key) => patch(u, { permissions: { ...u.permissions, [key]: !u.permissions?.[key] } }, 'Akses diperbarui');
  const remove = async (u) => {
    if (!confirm(`Hapus profil ${u.nama}? Akun login-nya perlu dihapus juga dari Supabase > Authentication bila ingin dibersihkan.`)) return;
    try { await api.deleteProfile(u.id); say('Pengguna dihapus'); load(); } catch (e) { say(e.message, 'err'); }
  };

  if (!users) return <div className="center"><div className="spinner" /></div>;
  const owners = users.filter((u) => u.role === 'owner');
  const others = users.filter((u) => u.role !== 'owner');
  const waiting = users.filter((u) => u.role !== 'owner' && u.active && !Object.values(u.permissions || {}).some(Boolean)).length;

  return (
    <>
      <PageHead title="USER" />
      {waiting > 0 && <p className="note">{waiting} pengguna belum punya akses. Tekan <b>Beri akses</b> atau centang fitur di bawah.</p>}

      {owners.length > 0 && (
        <>
          <h2 className="uc-sec">DEVELOPER</h2>
          <div className="uc-owners">
            {owners.map((u) => <OwnerCard key={u.id} u={u} me={u.id === session.user.id} patch={patch} />)}
          </div>
        </>
      )}

      <h2 className="uc-sec">PENGGUNA <small>{others.length}</small></h2>
      {others.length === 0 && <p className="muted empty-line">Belum ada pengguna lain. Akun baru yang mendaftar akan muncul di sini.</p>}
      <div className="ucards">
        {others.map((u) => {
          const me = u.id === session.user.id;
          const type = u.user_type || 'DRIVER';
          return (
            <article className={'uc' + (u.active ? '' : ' off')} key={u.id}>
              <header className="uc-h">
                <div className="avatar">{(u.nama || '?').slice(0, 1).toUpperCase()}</div>
                <div className="uc-id">
                  <b>{u.nama} {me && <span className="chip">Anda</span>}</b>
                  <small title={u.email}>{u.email}</small>
                </div>
                <span className={'uc-state ' + (u.active ? 'on' : 'off')}>{u.active ? 'AKTIF' : 'NONAKTIF'}</span>
              </header>
              <p className="uc-since">Daftar {fmtDate((u.created_at || '').slice(0, 10))}</p>

              <div className="uc-sets">
                <label>PERAN
                  <select value={u.role} disabled={me} onChange={(e) => patch(u, { role: e.target.value }, 'Peran diubah')} aria-label={`Peran ${u.nama}`}>
                    <option value="driver">User</option>
                    <option value="owner">Developer</option>
                  </select>
                </label>
                <label>USER
                  <select value={type} onChange={(e) => patch(u, { user_type: e.target.value }, 'Jenis user diubah')} aria-label={`Jenis user ${u.nama}`}>
                    {USER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              </div>

              {type === 'DRIVER' && !u.driver_id && (
                <p className="uc-note">Nama belum cocok dengan data driver, jadi PROFIL &amp; PERFORMA belum terhubung. Samakan nama dengan driver di MASTER DATA, atau pilih manual:
                  <select className="inline-sel" value="" onChange={(e) => e.target.value && patch(u, { driver_id: e.target.value }, 'Dihubungkan ke data driver')} aria-label={`Pilih driver ${u.nama}`}>
                    <option value="">— PILIH DRIVER —</option>
                    {master.drivers.map((d) => <option key={d.id} value={d.id} disabled={users.some((x) => x.id !== u.id && x.driver_id === d.id)}>{d.nama_lengkap || d.nama}</option>)}
                  </select></p>
              )}

              <div className="uc-perms" role="group" aria-label={`Akses ${u.nama}`}>
                <h4>AKSES FITUR</h4>
                {PERMISSIONS.map((p) => (
                  <label key={p.key} className="uc-perm">
                    <input type="checkbox" checked={Boolean(u.permissions?.[p.key])} onChange={() => togglePerm(u, p.key)} disabled={!u.active} />
                    <span><b>{p.label}</b><small>{p.desc}</small></span>
                  </label>
                ))}
              </div>

              <footer className="uc-f">
                <div className="uc-f1">
                  <button className="btn btn-ghost btn-sm" onClick={() => patch(u, { permissions: { ...u.permissions, ...TYPE_PRESET[type] } }, `Akses ${type} diberikan`)}>Beri akses {type}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => patch(u, { permissions: {} }, 'Semua akses dicabut')}>Cabut semua</button>
                </div>
                <div className="uc-f2">
                  <label className="switch with-label"><input type="checkbox" checked={u.active} disabled={me} onChange={(e) => patch(u, { active: e.target.checked }, e.target.checked ? 'Akun diaktifkan' : 'Akun dinonaktifkan')} /><span /> {u.active ? 'Aktif' : 'Nonaktif'}</label>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(u)}>Hapus akun</button>
                </div>
              </footer>
            </article>
          );
        })}
      </div>
      <Toast msg={toast.msg} kind={toast.kind} onDone={clear} />
    </>
  );
}

function OwnerCard({ u, me, patch }) {
  return (
    <article className="uc uc-owner">
      <header className="uc-h">
        <div className="avatar">{(u.nama || '?').slice(0, 1).toUpperCase()}</div>
        <div className="uc-id">
          <b>{u.nama} {me && <span className="chip">Anda</span>}</b>
          <small title={u.email}>{u.email}</small>
        </div>
        <label className="uc-role">
          <select value={u.role} disabled={me} onChange={(e) => patch(u, { role: e.target.value }, 'Peran diubah')} aria-label={`Peran ${u.nama}`}>
            <option value="driver">User</option>
            <option value="owner">Developer</option>
          </select>
        </label>
      </header>
      <p className="uc-since">Memiliki seluruh akses, termasuk DASHBOARD dan USER.</p>
    </article>
  );
}

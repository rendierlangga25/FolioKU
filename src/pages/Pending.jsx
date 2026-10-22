import { useAuth } from '../auth.jsx';

export default function Pending() {
  const { profile, refresh } = useAuth();
  return (
    <div className="empty-state">
      <div className="empty-ic">⏳</div>
      <h2>{profile?.active === false ? 'Akun dinonaktifkan' : 'Menunggu akses dari developer'}</h2>
      <p className="muted">
        {profile?.active === false
          ? 'Hubungi developer untuk mengaktifkan kembali akun Anda.'
          : `Halo ${profile?.nama || ''}, akun Anda sudah aktif tetapi belum diberi fitur apa pun. Minta developer mengaktifkan akses di menu USER.`}
      </p>
      <button className="btn btn-primary" onClick={refresh}>Cek lagi</button>
    </div>
  );
}

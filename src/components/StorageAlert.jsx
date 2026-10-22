import { useState } from 'react';
import { Link } from 'react-router-dom';
import { alertText, shouldShowAlert } from '../lib/storageUsage.js';

const KEY = 'raxer.storage.dismiss.v1';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };

/** Banner peringatan untuk developer (owner) saat database / penyimpanan foto hampir penuh. Bisa ditutup 24 jam; muncul lagi bila level naik. */
export default function StorageAlert({ ev }) {
  const [dismissed, setDismissed] = useState(read);
  if (!ev || !shouldShowAlert(ev.level, dismissed)) return null;
  const close = () => {
    const d = { level: ev.level, until: Date.now() + 24 * 3600 * 1000 };
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* abaikan */ }
    setDismissed(d);
  };
  return (
    <div className={'storage-alert ' + ev.level} role="alert">
      <span className="sa-ic" aria-hidden="true">{ev.level === 'crit' ? '⛔' : '⚠'}</span>
      <div className="sa-t">
        <b>{alertText(ev)}</b>
        <span>Segera unduh backup & foto di REPORT LOGISTIC, lalu pertimbangkan upgrade paket Supabase agar input driver tidak terhenti.</span>
      </div>
      <Link className="btn btn-ghost btn-sm" to="/app/report-logistic">BUKA REPORT</Link>
      <button type="button" className="btn-icon" onClick={close} aria-label="Tutup peringatan 24 jam" title="Tutup 24 jam">✕</button>
    </div>
  );
}

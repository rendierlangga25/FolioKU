import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../auth.jsx';
import { fmtDate, int, todayISO } from '../lib/format.js';
import { CONFIRM_WORD, KINDS, MIN_KEEP_DAYS, buildPlan, maxCutoff, monthsAgo, runCleanup, validateCutoff } from '../lib/cleanup.js';

const KIND_TXT = { foto_pengiriman: 'foto pengiriman', pengiriman: 'pengiriman', dock: 'upload loading dock' };

/** BERSIHKAN DATABASE — hanya developer (owner). Pilih jenis + batas tanggal → cek → konfirmasi → bersihkan. */
export default function CleanupPanel({ onDone, say }) {
  const { isOwner, profile } = useAuth();
  const today = todayISO();
  const [kind, setKind] = useState('foto_pengiriman');
  const [before, setBefore] = useState(() => { const m = monthsAgo(today, 12); return m > maxCutoff(today) ? maxCutoff(today) : m; });
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState('');
  const [prog, setProg] = useState(null);
  const [saved, setSaved] = useState(false);
  const [word, setWord] = useState('');
  const [log, setLog] = useState([]);
  const err = validateCutoff(before, today);

  const loadLog = () => api.listCleanupLog().then(setLog).catch(() => setLog([]));
  useEffect(() => { if (isOwner) loadLog(); }, [isOwner]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPlan(null); setSaved(false); setWord(''); }, [kind, before]);
  const presets = useMemo(() => [3, 6, 12, 24].map((n) => ({ n, d: monthsAgo(today, n) })).filter((p) => p.d <= maxCutoff(today)), [today]);
  if (!isOwner) return null;

  const check = async () => {
    setBusy('check');
    try { setPlan(buildPlan(kind, before, await api.cleanupRows(kind, before))); } catch (e) { say(e.message, 'err'); } finally { setBusy(''); }
  };
  const go = async () => {
    setBusy('run'); setProg({ step: 'files', done: 0, total: 0 });
    try {
      const r = await runCleanup(api, plan, { onProgress: setProg, by: profile?.nama });
      say(`Selesai — ${int(r.rows)} data, ${int(r.photos)} foto dibersihkan ✓`);
      setPlan(null); setSaved(false); setWord(''); loadLog(); onDone?.();
    } catch (e) { say(e.message, 'err'); } finally { setBusy(''); setProg(null); }
  };
  const ready = plan && plan.rows > 0 && saved && word.trim().toUpperCase() === CONFIRM_WORD;
  const danger = kind !== 'foto_pengiriman';

  return (
    <section className="card clean">
      <h3 className="card-t">BERSIHKAN DATABASE <small className="muted">KHUSUS DEVELOPER</small></h3>
      <p className="muted small">Kosongkan ruang dengan menghapus data/foto lama. Data {MIN_KEEP_DAYS} hari terakhir selalu aman. Unduh <b>Backup Seluruh Data</b> dan <b>Foto Bukti</b> di atas lebih dulu — hasil pembersihan tidak bisa dikembalikan.</p>

      <div className="clean-kinds" role="radiogroup" aria-label="Jenis pembersihan">
        {Object.entries(KINDS).map(([k, v]) => (
          <label key={k} className={'clean-kind' + (kind === k ? ' on' : '') + (k !== 'foto_pengiriman' ? ' dg' : '')}>
            <input type="radio" name="clean-kind" checked={kind === k} onChange={() => setKind(k)} disabled={busy === 'run'} />
            <span><b>{v.label}</b><small>{v.hint}</small></span>
          </label>
        ))}
      </div>

      <div className="clean-date">
        <div><label htmlFor="cl-before">Bersihkan yang tanggalnya SEBELUM</label>
          <input id="cl-before" type="date" value={before} max={maxCutoff(today)} onChange={(e) => setBefore(e.target.value)} disabled={busy === 'run'} /></div>
        <div className="clean-presets">{presets.map((p) => <button key={p.n} type="button" className={'btn btn-ghost btn-sm' + (before === p.d ? ' on' : '')} onClick={() => setBefore(p.d)}>&gt; {p.n} bulan</button>)}</div>
      </div>
      {err && <p className="err small">{err}</p>}

      <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={check} disabled={Boolean(err) || busy !== ''}>{busy === 'check' ? 'Memeriksa…' : 'CEK DULU'}</button></div>

      {plan && (
        <div className={'clean-plan' + (danger ? ' dg' : '')} aria-live="polite">
          {plan.rows === 0 ? <p>Tidak ada {KIND_TXT[kind]} sebelum {fmtDate(before)} yang perlu dibersihkan.</p> : (
            <>
              <h4>Akan dibersihkan</h4>
              <ul>
                <li><b>{int(plan.rows)}</b> {danger ? `${KIND_TXT[kind]} (data + foto) dihapus` : 'pengiriman dikosongkan fotonya (data tetap)'}</li>
                <li><b>{int(plan.photos)}</b> file foto dihapus dari penyimpanan</li>
                <li>Tanggal {fmtDate(plan.oldest)} – {fmtDate(plan.newest)}</li>
              </ul>
              <label className="colchk"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} disabled={busy === 'run'} /><span>Saya sudah mengunduh backup data & foto untuk rentang ini.</span></label>
              <div className="clean-word"><label htmlFor="cl-word">Ketik <b>{CONFIRM_WORD}</b> untuk melanjutkan</label>
                <input id="cl-word" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" disabled={busy === 'run'} /></div>
              {busy === 'run' && prog && (
                <div className="zip-prog"><div className="meter-t ok"><i style={{ width: `${prog.total ? (prog.done / prog.total) * 100 : 5}%` }} /></div>
                  <small className="mono">{prog.step === 'files' ? 'Menghapus foto' : 'Membersihkan data'} · {int(prog.done)} / {int(prog.total)}</small></div>
              )}
              <div className="form-actions"><button type="button" className="btn btn-danger" disabled={!ready || busy !== ''} onClick={go}>{busy === 'run' ? 'MEMBERSIHKAN…' : 'BERSIHKAN SEKARANG'}</button></div>
              <small className="muted">Ukuran database di meteran baru turun setelah proses vacuum otomatis Supabase; ruang yang dibebaskan langsung bisa dipakai lagi. Ukuran foto turun segera.</small>
            </>
          )}
        </div>
      )}

      {log.length > 0 && (
        <div className="clean-log"><h4>Riwayat pembersihan</h4>
          <ul>{log.map((l) => <li key={l.id}><span>{new Date(l.at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })}</span><b>{KIND_TXT[l.kind] || l.kind}</b><span className="muted">sebelum {fmtDate(l.before_date)} · {int(l.rows)} data · {int(l.photos)} foto{l.by_name ? ` · ${l.by_name}` : ''}</span></li>)}</ul></div>
      )}
    </section>
  );
}

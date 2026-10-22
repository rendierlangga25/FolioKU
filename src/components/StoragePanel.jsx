import { useState } from 'react';
import { api } from '../lib/api.js';
import { DEFAULT_LIMITS, LEVEL_TEXT, fmtBytes, fmtPct, monthsUntilFull } from '../lib/storageUsage.js';
import { monthISO } from '../lib/format.js';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const PRESETS = { Free: { db_mb: 500, storage_mb: 1024 }, Pro: { db_mb: 8192, storage_mb: 102400 } };
const dt = (iso) => { try { return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(iso)); } catch { return ''; } };

/** Status penyimpanan untuk developer: meteran database & foto, tren foto per bulan, tabel terbesar, dan pengaturan batas. */
export default function StoragePanel({ usage, ev, error, loading, reload, say }) {
  const [form, setForm] = useState(null);       // null = tertutup; berisi batas yang sedang diedit
  const [saving, setSaving] = useState(false);

  if (error && !usage) {
    return (
      <section className="card stor">
        <h3 className="card-t">STATUS PENYIMPANAN</h3>
        <p className="err">{/function|storage_usage/i.test(error) ? 'Fungsi pemantau penyimpanan belum terpasang. Jalankan supabase/migrations/2026-10-revisi-16-report-storage.sql di Supabase SQL Editor.' : error}</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={reload}>COBA LAGI</button>
      </section>
    );
  }
  if (!usage || !ev) return <section className="card stor"><h3 className="card-t">STATUS PENYIMPANAN</h3><div className="center"><div className="spinner" /></div></section>;

  const photoItem = ev.items.find((i) => i.key === 'storage');
  const avg = usage.photo_count ? usage.storage_bytes / usage.photo_count : 0;
  const months = monthsUntilFull(usage.monthly, photoItem.used, photoItem.limit, monthISO());
  const maxM = Math.max(1, ...(usage.monthly || []).map((m) => +m.bytes));

  const save = async () => {
    setSaving(true);
    try { await api.saveStorageLimits(form); await reload(); setForm(null); say('Batas penyimpanan disimpan ✓'); }
    catch (e) { say(e.message, 'err'); } finally { setSaving(false); }
  };
  const num = (k) => (e) => setForm({ ...form, [k]: e.target.value === '' ? '' : +e.target.value });

  return (
    <section className="card stor">
      <div className="stor-h">
        <div className="stor-title">
          <h3 className="card-t">STATUS PENYIMPANAN</h3>
          <b className={'lvl ' + ev.level}>{LEVEL_TEXT[ev.level]}</b>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={reload} disabled={loading}>{loading ? 'MEMUAT…' : 'PERBARUI'}</button>
      </div>

      <div className="meters">
        {ev.items.map((i) => (
          <div className="meter" key={i.key}>
            <div className="meter-l"><b>{i.label}</b><span className="mono">{fmtBytes(i.used)} / {fmtBytes(i.limit)}</span></div>
            <div className={'meter-t ' + i.level} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(i.pct)} aria-valuetext={fmtPct(i.pct)} aria-label={`${i.label} terpakai`}>
              <i style={{ width: `${Math.min(100, i.pct)}%` }} /><em style={{ left: `${ev.limits.warn_pct}%` }} /><em className="c" style={{ left: `${ev.limits.crit_pct}%` }} />
            </div>
            <small className="muted">{fmtPct(i.pct)} terpakai · sisa {fmtBytes(i.free)}{i.level !== 'ok' && <b className={'lvl-t ' + i.level}> · {LEVEL_TEXT[i.level]}</b>}</small>
          </div>
        ))}
      </div>

      <p className="meter-key muted small"><span><i /> garis abu = mulai peringatan ({ev.limits.warn_pct}%)</span><span><i className="c" /> garis merah = kritis ({ev.limits.crit_pct}%)</span></p>

      {ev.level !== 'ok' && (
        <p className={'note stor-note ' + ev.level}>Segera <b>unduh Backup Seluruh Data</b> dan <b>Foto Bukti</b> di atas. Setelah aman tersimpan, upgrade paket atau kurangi foto lama sebelum penyimpanan penuh (input baru bisa gagal bila database penuh).</p>
      )}

      <div className="stor-grid">
        <div>
          <h4>Foto</h4>
          <p className="muted small">{usage.photo_count.toLocaleString('id-ID')} foto · rata-rata {fmtBytes(avg)} per foto</p>
          <p className="muted small">{months == null ? 'Perkiraan penuh: belum cukup data (butuh minimal 1 bulan lengkap).' : months === 0 ? 'Penyimpanan foto sudah penuh.' : `Dengan laju 3 bulan terakhir, penyimpanan foto penuh dalam ± ${months < 1 ? '< 1' : Math.round(months)} bulan.`}</p>
          {(usage.monthly || []).length > 0 && (
            <div className="mbars" aria-label="Tambahan foto per bulan">
              {usage.monthly.slice(-6).map((m) => (
                <div key={m.ym} title={`${m.ym}: ${m.files} foto, ${fmtBytes(m.bytes)}`}><i style={{ height: `${Math.max(4, (m.bytes / maxM) * 100)}%` }} /><small>{MON[+m.ym.slice(5) - 1]}</small></div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h4>Tabel terbesar</h4>
          <ul className="toptab">
            {(usage.tables || []).slice(0, 5).map((t) => <li key={t.name}><span>{t.name}</span><b className="mono">{fmtBytes(t.bytes)}</b><small className="muted">{(+t.rows).toLocaleString('id-ID')} baris</small></li>)}
          </ul>
        </div>
      </div>
      <p className="muted small">Dicek {dt(usage.checked_at)} WIB. Ukuran database mencakup tabel sistem Supabase, jadi angkanya sedikit lebih besar dari data aplikasi saja. Peringatan hanya tampil untuk akun OWNER (developer).</p>

      {!form ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...DEFAULT_LIMITS, ...ev.limits })}>ATUR BATAS & PERINGATAN</button>
      ) : (
        <div className="limit-form">
          <h4>Batas paket & ambang peringatan</h4>
          <div className="preset-row">
            {Object.entries(PRESETS).map(([k, v]) => <button key={k} type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, ...v })}>Paket {k} ({v.db_mb / 1024 >= 1 ? v.db_mb / 1024 + ' GB' : v.db_mb + ' MB'} · {v.storage_mb / 1024 >= 1 ? v.storage_mb / 1024 + ' GB' : v.storage_mb + ' MB'})</button>)}
          </div>
          <div className="grid2">
            <div><label htmlFor="lm-db">Batas database (MB)</label><input id="lm-db" inputMode="numeric" value={form.db_mb} onChange={num('db_mb')} /></div>
            <div><label htmlFor="lm-st">Batas penyimpanan foto (MB)</label><input id="lm-st" inputMode="numeric" value={form.storage_mb} onChange={num('storage_mb')} /></div>
            <div><label htmlFor="lm-w">Peringatan di (%)</label><input id="lm-w" inputMode="numeric" value={form.warn_pct} onChange={num('warn_pct')} /></div>
            <div><label htmlFor="lm-c">Kritis di (%)</label><input id="lm-c" inputMode="numeric" value={form.crit_pct} onChange={num('crit_pct')} /></div>
          </div>
          <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>BATAL</button><button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'MENYIMPAN…' : 'SIMPAN'}</button></div>
        </div>
      )}
    </section>
  );
}

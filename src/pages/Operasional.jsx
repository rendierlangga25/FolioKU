import { useCallback, useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import TripForm from '../components/TripForm.jsx';
import { PageHead, Toast, useToast } from '../components/ui.jsx';
import Riwayat from './Riwayat.jsx';
import ProfilPanel from './Profil.jsx';
import { drafts } from '../lib/draftStore.js';
import { fmtDate } from '../lib/format.js';
import { checkTrip, EMPTY_FORM } from '../lib/tripRules.js';
import { useMaster, vehicleLabel } from '../lib/useMaster.js';

// foto draft hanya perlu "ada / tidak" untuk menghitung progres
const asItems = (p = {}) => ({
  km_awal: p.km_awal ? {} : null, km_isi: p.km_isi ? {} : null, km_akhir: p.km_akhir ? {} : null,
  serah_terima: (p.serah_terima || []).map(() => ({})), surat_jalan: (p.surat_jalan || []).map(() => ({})), kendala: [], sisa_bbm: [],
});

/** LOGISTIC › DRIVER — satu menu, empat tab: INPUT, RIWAYAT, PERFORMA, PROFIL. PERFORMA & PROFIL terbuka untuk semua user aktif. */
export default function Operasional() {
  const { can, profile, seeAllHistory } = useAuth();
  const [sp, setSp] = useSearchParams();
  if (profile?.active === false) return <Navigate to="/app" replace />;
  const tabs = [can('operasional_driver') && ['input', 'INPUT'], seeAllHistory && ['riwayat', 'RIWAYAT'], ['performa', 'PERFORMA'], ['profil', 'PROFIL']].filter(Boolean);
  const tab = tabs.some(([k]) => k === sp.get('tab')) ? sp.get('tab') : tabs[0][0];
  const go = (p, replace = false) => setSp(p, { replace });
  return (
    <>
      <PageHead title="DRIVER" />
      <div className="tabs" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={'tabbtn' + (tab === k ? ' on' : '')}
            onClick={() => go(k === tabs[0][0] ? {} : { tab: k }, true)}>{l}</button>
        ))}
      </div>
      {tab === 'riwayat' ? <Riwayat />
        : tab === 'performa' || tab === 'profil' ? <ProfilPanel tab={tab} viewId={sp.get('d')} go={go} />
        : <InputDriver />}
    </>
  );
}

function InputDriver() {
  const master = useMaster();
  const { profile, session } = useAuth();
  const [toast, say, clear] = useToast();
  const [list, setList] = useState(null);
  const [view, setView] = useState(null);       // null = daftar · { draft? } = form
  const [formKey, setFormKey] = useState(0);
  const [storeErr, setStoreErr] = useState('');

  const refresh = useCallback(async () => {
    try { setList(await drafts.list(session.user.id)); setStoreErr(''); }
    catch (e) { setList([]); setStoreErr(e.message); }
  }, [session.user.id]);
  useEffect(() => { refresh(); }, [refresh]);

  const back = async (kind) => {
    if (kind === 'submitted') say('Data terkirim ke database ✓');
    else if (kind === 'draft') say('Disimpan sementara di HP ✓ — lanjutkan kapan saja');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setView(null); setFormKey((k) => k + 1);
    await refresh();
  };
  const remove = async (d) => {
    if (!confirm('Hapus draft perjalanan ini beserta foto-fotonya dari HP? Tindakan tidak bisa dibatalkan.')) return;
    await drafts.remove(d.id).catch(() => {});
    say('Draft dihapus'); refresh();
  };

  if (master.loading || !list) return <div className="center"><div className="spinner" /></div>;
  if (master.error) return <p className="err">{master.error}</p>;

  // tanpa draft → langsung form baru; ada draft → tampilkan daftar dulu
  const showForm = view || list.length === 0;

  return (
    <>
      <div className="subhead">
        <p className="muted">{`Halo ${profile?.nama || ''}. ${showForm ? 'Isi data perjalanan. Tanda * wajib diisi — belum selesai? Simpan sementara dulu.' : 'Lanjutkan perjalanan yang belum selesai, atau mulai yang baru.'}`}</p>
        {!showForm && <button className="btn btn-primary" onClick={() => setView({})}>＋ PERJALANAN BARU</button>}
      </div>

      {storeErr && <p className="note">Draft tidak bisa disimpan di browser ini ({storeErr}). Selesaikan pengisian sekaligus lalu kirim.</p>}

      {showForm ? (
        <TripForm key={view?.draft?.id || formKey} master={master} draft={view?.draft}
          onCancel={list.length > 0 || view?.draft ? () => back() : undefined} onSaved={back} />
      ) : (
        <div className="drafts">
          {list.map((d) => {
            const c = checkTrip({ ...EMPTY_FORM, ...d.form }, asItems(d.photos), { harga: 1 });
            const v = master.vehicle[d.form?.vehicle_id];
            const tujuan = (d.form?.tujuan || []).filter((t) => t.trim());
            return (
              <article className="card draft" key={d.id}>
                <div className="draft-h">
                  <span className="chip">DRAFT</span>
                  <b>{fmtDate(d.tanggal)}</b>
                  <small className="muted">{v ? vehicleLabel(v) : 'Mobil belum dipilih'}</small>
                </div>
                <p className="draft-t">{tujuan.length ? tujuan.join(' → ') : <span className="muted">Tujuan belum diisi</span>}</p>
                <ul className="steps">{c.steps.map((s) => <li key={s.key} className={s.ok ? 'ok' : ''}>{s.ok ? '✓' : '○'} {s.label}</li>)}</ul>
                <div className="draft-f">
                  <button className="btn btn-ghost btn-sm danger-t" onClick={() => remove(d)}>Hapus</button>
                  <button className="btn btn-primary" onClick={() => setView({ draft: d })}>Lanjutkan →</button>
                </div>
              </article>
            );
          })}
          <p className="muted small">Draft tersimpan di HP ini (termasuk foto) dan baru masuk database setelah Anda menekan <b>Kirim data</b> dengan data lengkap. Jangan hapus data browser sebelum terkirim.</p>
        </div>
      )}
      <Toast msg={toast.msg} kind={toast.kind} onDone={clear} />
    </>
  );
}

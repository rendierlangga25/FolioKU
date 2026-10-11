import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {Check,Copy,ExternalLink} from 'lucide-react'
import {sb} from '../../lib/supabase'
import {useAccount} from '../../lib/account'
import {daysLeft,dt} from '../../lib/format'
import {siteUrl} from '../../lib/site'
import QrCode from '../../components/admin/QrCode'
export default function Dashboard(){
  const {user,profile,sub,access}=useAccount(),uid=user.id,[c,setC]=useState(null),[cp,setCp]=useState(false)
  const cnt=(t,f)=>{let q=sb.from(t).select('*',{count:'exact',head:true}).eq('owner_id',uid);if(f)q=q.eq(f[0],f[1]);return q.then(r=>r.count??0)}
  useEffect(()=>{Promise.all([cnt('projects'),cnt('projects',['published',true]),cnt('experiences'),cnt('skills'),cnt('contact_messages'),cnt('contact_messages',['is_read',false])]).then(setC)},[])
  const url=`${siteUrl()}/u/${profile.username}`
  const cards=c?[['Total proyek',c[0]],['Proyek terpublikasi',c[1]],['Pengalaman',c[2]],['Skill',c[3]],['Pesan masuk',c[4]],['Belum dibaca',c[5]]]:[]
  const status=sub?.is_lifetime?'Lifetime':sub?.expires_at&&access?`Aktif sampai ${dt(sub.expires_at)} (${daysLeft(sub.expires_at)} hari lagi)`:sub?`Berakhir ${dt(sub.expires_at)}`:access?'Akses owner':'Belum aktif'
  return(<div><h1 className="font-display mb-6 text-2xl font-semibold">Halo, {profile.name||'Selamat datang'} 👋</h1>
    <div className="mb-6 grid gap-4 lg:grid-cols-2">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-white p-5"><div className="min-w-0 flex-1 basis-48"><p className="text-sm text-neutral-500">Link portofolio kamu</p><p className="mt-1 break-all font-medium">{url}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm"><button onClick={()=>{navigator.clipboard?.writeText(url);setCp(true);setTimeout(()=>setCp(false),1800)}} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5">{cp?<Check size={14}/>:<Copy size={14}/>}{cp?'Tersalin':'Salin link'}</button>
          <a href={`/u/${profile.username}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-white"><ExternalLink size={14}/>Buka</a></div></div>
        {profile.username&&<QrCode url={`${siteUrl()}/q/${uid}`} name={profile.username}/>}</div>
      <div className="rounded-xl border bg-white p-5"><p className="text-sm text-neutral-500">Status langganan</p><p className={`mt-1 font-medium ${access?'text-emerald-700':'text-red-700'}`}>{status}</p>{sub?.plan_name&&<p className="text-sm text-neutral-500">Paket {sub.plan_name}</p>}
        <Link to="/app/billing" className="mt-3 inline-block rounded-lg border px-3 py-1.5 text-sm">{access&&!sub?.is_lifetime?'Perpanjang / ganti paket':access?'Riwayat pembayaran':'Aktifkan sekarang'}</Link></div></div>
    {!c?<p className="text-sm text-neutral-500">Memuat…</p>:<div className="grid grid-cols-2 gap-4 lg:grid-cols-3">{cards.map(([l,n])=><div key={l} className="rounded-xl border bg-white p-5"><p className="font-display text-3xl font-semibold">{n}</p><p className="mt-1 text-sm text-neutral-500">{l}</p></div>)}</div>}
    <p className="mt-8 text-sm text-neutral-500">Pilih menu di samping untuk mengubah konten. Perubahan langsung tampil di portofolio publik.</p></div>)
}

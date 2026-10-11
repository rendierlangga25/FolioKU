import {useEffect,useState} from 'react'
import {sb} from '../../lib/supabase'
import Manager from '../../components/admin/Manager'
import {F} from '../../lib/fields'
import {useToast} from '../../components/admin/Toast'
import {dt,rp,dur} from '../../lib/format'
const Page=({t,children})=><div><h1 className="font-display mb-6 text-2xl font-semibold">{t}</h1><div className="space-y-6">{children}</div></div>
const Tag=({s})=>{const m={paid:'bg-emerald-50 text-emerald-700',pending:'bg-amber-50 text-amber-700',review:'bg-blue-50 text-blue-700',rejected:'bg-red-50 text-red-700'};return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${m[s]||'bg-neutral-100 text-neutral-600'}`}>{s}</span>}

export {default as Overview} from './Overview'
export {default as Feedback} from './Feedback'
export const Plans=()=><Page t="Paket & Harga"><p className="-mt-3 text-sm text-neutral-500">Atur nama, lama aktif, dan harga paket di sini. Perubahan langsung tampil di landing page dan halaman langganan. Kosongkan "Lama aktif" untuk paket Lifetime.</p>
  <Manager owned={false} table="plans" title="Paket" fields={F.plan} primary="name" sub={r=>`${rp(r.price)} · ${dur(r)}${r.active?'':' · NONAKTIF'}`}/></Page>
export const Methods=()=><Page t="Metode Pembayaran"><p className="-mt-3 text-sm text-neutral-500">Tambah akun QRIS, e-wallet, dan bank milikmu. Yang <b>Aktif</b> akan tampil di halaman pembayaran pelanggan dan di landing page. Untuk QRIS, upload gambar QRIS dari aplikasi GoPay Merchant atau bank kamu.</p><Manager owned={false} table="payment_methods" title="Metode" fields={F.paymethod} primary="label" thumb="image_url" sub={r=>`${{qris:'QRIS',ewallet:'E-Wallet',bank:'Bank'}[r.type]||r.type}${r.account_number?' · '+r.account_number:''}${r.active?'':' · NONAKTIF'}`}/></Page>
export const AppSettings=()=><Page t="Pengaturan Landing Page"><div className="max-w-2xl rounded-xl border bg-white p-5"><Manager owned={false} singleton sortable={false} table="app_settings" fields={F.app}/></div></Page>

export function Orders(){
  const toast=useToast(),[r,setR]=useState(null),[em,setEm]=useState({}),[f,setF]=useState('review'),[busy,setBusy]=useState('')
  const load=()=>sb.from('orders').select('*').order('created_at',{ascending:false}).limit(300).then(x=>setR(x.data||[]))
  useEffect(()=>{load();sb.rpc('admin_list_users').then(({data})=>setEm(Object.fromEntries((data||[]).map(u=>[u.id,u.email]))))},[])
  const proof=async o=>{const {data,error}=await sb.storage.from('proofs').createSignedUrl(o.proof_path,300);if(error)return toast(error.message,'err');window.open(data.signedUrl,'_blank')}
  const run=async(o,fn,msg)=>{setBusy(o.id);const {error}=await fn();setBusy('');if(error)return toast(error.message,'err');toast(msg);load()}
  const approve=o=>{if(confirm(`Setujui ${o.order_id} (${rp(o.amount)}) dan aktifkan paket ${o.plan_name}? Pastikan uangnya sudah masuk.`))run(o,()=>sb.rpc('admin_approve_order',{p_order:o.order_id}),'Pesanan disetujui, langganan aktif')}
  const reject=o=>{const n=prompt('Alasan penolakan (dilihat pelanggan):','Pembayaran belum kami terima');if(n!==null)run(o,()=>sb.rpc('admin_reject_order',{p_order:o.order_id,p_note:n}),'Pesanan ditolak')}
  const L={review:'Perlu dicek',pending:'Belum bayar',paid:'Lunas',rejected:'Ditolak',all:'Semua'}
  const rows=(r||[]).filter(x=>f==='all'||x.status===f),cnt=k=>(r||[]).filter(x=>x.status===k).length
  return(<Page t="Pesanan"><div className="flex flex-wrap gap-2 text-sm">{Object.keys(L).map(k=><button key={k} onClick={()=>setF(k)} className={`rounded-full px-3.5 py-1.5 ${f===k?'bg-neutral-900 text-white':'border bg-white'}`}>{L[k]}{k!=='all'&&r?` (${cnt(k)})`:''}</button>)}</div>
    {!r?<p className="text-sm text-neutral-500">Memuat…</p>:<div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase text-neutral-500"><tr>{['Tanggal','Pelanggan','Paket','Nominal','Metode','Bukti','Status','Aksi'].map(h=><th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
      <tbody className="divide-y">{rows.map(x=><tr key={x.id}><td className="whitespace-nowrap p-3">{dt(x.created_at)}<p className="font-mono text-[10px] text-neutral-400">{x.order_id}</p></td><td className="p-3">{em[x.user_id]||'-'}</td><td className="p-3">{x.plan_name}</td><td className="whitespace-nowrap p-3 font-semibold">{rp(x.amount)}<p className="text-[10px] font-normal text-neutral-400">kode unik {x.unique_code||0}</p></td><td className="p-3">{x.method_label||'-'}</td>
        <td className="p-3">{x.proof_path?<button onClick={()=>proof(x)} className="underline">Lihat</button>:'-'}</td><td className="p-3"><Tag s={x.status}/>{x.note&&<p className="mt-1 max-w-[10rem] text-[10px] text-neutral-500">{x.note}</p>}</td>
        <td className="p-3"><div className="flex gap-2">{x.status!=='paid'&&x.status!=='cancelled'&&<button disabled={busy===x.id} onClick={()=>approve(x)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Setujui</button>}{['pending','review'].includes(x.status)&&<button disabled={busy===x.id} onClick={()=>reject(x)} className="rounded-lg border px-3 py-1.5 text-xs text-red-600">Tolak</button>}</div></td></tr>)}
        {rows.length===0&&<tr><td colSpan={8} className="p-8 text-center text-neutral-500">Tidak ada data.</td></tr>}</tbody></table></div>}</Page>)
}

export function Users(){
  const toast=useToast(),[u,setU]=useState(null),[plans,setP]=useState([]),[q,setQ]=useState('')
  const load=()=>sb.rpc('admin_list_users').then(({data,error})=>{if(error)toast(error.message,'err');setU(data||[])})
  useEffect(()=>{load();sb.from('plans').select('*').order('sort_order').then(r=>setP(r.data||[]))},[])
  const grant=async(user,planId)=>{const p=plans.find(x=>x.id===planId);if(!p)return
    if(!confirm(`Aktifkan paket ${p.name} untuk ${user.email} tanpa pembayaran?`))return
    let row
    if(p.duration_months==null)row={user_id:user.id,plan_id:p.id,plan_name:p.name,is_lifetime:true,expires_at:null}
    else{const now=new Date(),base=user.expires_at&&new Date(user.expires_at)>now?new Date(user.expires_at):now,e=new Date(base);e.setMonth(e.getMonth()+p.duration_months);row={user_id:user.id,plan_id:p.id,plan_name:p.name,is_lifetime:false,expires_at:e.toISOString()}}
    const {error}=await sb.from('subscriptions').upsert(row,{onConflict:'user_id'});if(error)return toast(error.message,'err');toast('Langganan diaktifkan');load()}
  const revoke=async user=>{if(!confirm(`Cabut langganan ${user.email}?`))return;const {error}=await sb.from('subscriptions').delete().eq('user_id',user.id);if(error)return toast(error.message,'err');toast('Langganan dicabut');load()}
  const rows=(u||[]).filter(x=>!q||(x.email+' '+(x.username||'')).toLowerCase().includes(q.toLowerCase()))
  return(<Page t="Pelanggan"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari email atau username…" className="w-full max-w-sm rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900"/>
    {!u?<p className="text-sm text-neutral-500">Memuat…</p>:<div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase text-neutral-500"><tr>{['Email','Username','Daftar','Langganan','Aksi'].map(h=><th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
      <tbody className="divide-y">{rows.map(x=>{const act=x.is_lifetime||(x.expires_at&&new Date(x.expires_at)>new Date());return <tr key={x.id}><td className="p-3">{x.email}</td><td className="p-3">{x.username?<a className="underline" target="_blank" rel="noreferrer" href={'/u/'+x.username}>{x.username}</a>:'-'}</td><td className="whitespace-nowrap p-3">{dt(x.created_at)}</td>
        <td className="p-3">{x.plan_name?<span className={act?'text-emerald-700':'text-red-700'}>{x.plan_name} · {x.is_lifetime?'Lifetime':(act?'sampai ':'berakhir ')+dt(x.expires_at)}</span>:<span className="text-neutral-400">Belum ada</span>}</td>
        <td className="p-3"><div className="flex items-center gap-2"><select defaultValue="" onChange={e=>{grant(x,e.target.value);e.target.value=''}} className="rounded-lg border px-2 py-1 text-xs"><option value="">Beri paket…</option>{plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>{x.plan_name&&<button onClick={()=>revoke(x)} className="text-xs text-red-600 underline">Cabut</button>}</div></td></tr>})}</tbody></table></div>}</Page>)
}

import {useEffect,useState} from 'react'
import {Mail,Trash2} from 'lucide-react'
import {sb} from '../../lib/supabase'
import {useToast} from '../../components/admin/Toast'
import {dtTime} from '../../lib/format'
const KIND={saran:'Saran',fitur:'Ide fitur',masalah:'Masalah',lainnya:'Lainnya'}
const TONE={saran:'bg-blue-50 text-blue-700',fitur:'bg-violet-50 text-violet-700',masalah:'bg-red-50 text-red-700',lainnya:'bg-neutral-100 text-neutral-600'}
export default function Feedback(){
  const toast=useToast(),[rows,setRows]=useState(null),[flt,setFlt]=useState('all')
  const load=async()=>{const {data,error}=await sb.from('feedback').select('*').order('created_at',{ascending:false}).limit(300)
    if(error){toast('Gagal memuat. Jalankan update-6-masukan.sql di Supabase terlebih dahulu.','err');return setRows([])}
    setRows(data||[])}
  useEffect(()=>{load()},[])
  const read=async r=>{const {error}=await sb.from('feedback').update({is_read:!r.is_read}).eq('id',r.id);if(error)toast(error.message,'err');load()}
  const del=async r=>{if(!confirm('Hapus masukan ini?'))return;const {error}=await sb.from('feedback').delete().eq('id',r.id);if(error)return toast(error.message,'err');load()}
  const unread=(rows||[]).filter(r=>!r.is_read).length
  const list=(rows||[]).filter(r=>flt==='all'||(flt==='unread'?!r.is_read:r.kind===flt))
  const chips=[['all',`Semua (${(rows||[]).length})`],['unread',`Belum dibaca (${unread})`],...Object.entries(KIND)]
  return(<div><h1 className="font-display mb-1 text-2xl font-semibold">Saran & Masukan</h1>
    <p className="mb-5 text-sm text-neutral-500">Masukan yang dikirim pengunjung lewat landing page.</p>
    <div className="mb-4 flex flex-wrap gap-2">{chips.map(([k,l])=><button key={k} onClick={()=>setFlt(k)} className={`rounded-full border px-3.5 py-1.5 text-sm ${flt===k?'border-neutral-900 bg-neutral-900 text-white':'bg-white'}`}>{l}</button>)}</div>
    {!rows?<p className="text-sm text-neutral-500">Memuat…</p>:list.length===0?<div className="rounded-xl border bg-white p-8 text-center text-sm text-neutral-500">Belum ada masukan.</div>:
    <div className="space-y-3">{list.map(r=><article key={r.id} className={`rounded-xl border bg-white p-5 ${r.is_read?'':'ring-1 ring-neutral-900/10'}`}>
      <div className="flex flex-wrap items-center gap-2 text-sm"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[r.kind]||TONE.lainnya}`}>{KIND[r.kind]||r.kind}</span>
        {!r.is_read&&<span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-bold text-white">BARU</span>}
        <b>{r.name||'Anonim'}</b><span className="text-xs text-neutral-500">{dtTime(r.created_at)}</span></div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm">{r.message}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        {r.email&&<a href={`mailto:${r.email}?subject=${encodeURIComponent('Re: Masukan untuk FolioKu')}`} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5"><Mail size={14}/>Balas ke {r.email}</a>}
        <button onClick={()=>read(r)} className="underline">{r.is_read?'Tandai belum dibaca':'Tandai dibaca'}</button>
        <button onClick={()=>del(r)} aria-label="Hapus" className="ml-auto text-red-600"><Trash2 size={16}/></button></div></article>)}</div>}
  </div>)
}

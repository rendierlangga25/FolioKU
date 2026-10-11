import {useState} from 'react'
import {Check,Send} from 'lucide-react'
import {sb} from '../../lib/supabase'
import Reveal from '../../components/public/Reveal'
const KINDS=[['saran','Saran'],['fitur','Ide fitur baru'],['masalah','Ada masalah'],['lainnya','Lainnya']]
const KEY='folioku_fb_last'
const inp='w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#111]'
export default function Feedback(){
  const [f,setF]=useState({kind:'saran',name:'',email:'',message:'',website:''}),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[err,setErr]=useState('')
  const set=(k,v)=>setF(s=>({...s,[k]:v}))
  const submit=async e=>{e.preventDefault();setErr('')
    const msg=f.message.trim()
    if(msg.length<5)return setErr('Tulis minimal 5 karakter ya.')
    if(f.email.trim()&&!/^\S+@\S+\.\S+$/.test(f.email.trim()))return setErr('Format email belum benar. Kosongkan saja jika tidak ingin dibalas.')
    if(f.website){setDone(true);return} // kolom jebakan untuk bot
    try{const last=Number(localStorage.getItem(KEY)||0);if(Date.now()-last<30000)return setErr('Tunggu sebentar sebelum mengirim lagi.')}catch{}
    setBusy(true)
    const {error}=await sb.from('feedback').insert({kind:f.kind,name:f.name.trim()||null,email:f.email.trim()||null,message:msg})
    setBusy(false)
    if(error)return setErr('Maaf, pesan belum terkirim. Coba lagi beberapa saat lagi.')
    try{localStorage.setItem(KEY,String(Date.now()))}catch{}
    setDone(true)}
  return(<section id="masukan" className="scroll-mt-16 px-5 py-20">
    <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
      <Reveal><div>
        <p className="text-sm font-semibold text-[#e2561b]">Saran & masukan</p>
        <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight md:text-5xl">Bantu kami jadi lebih baik.</h2>
        <p className="mt-4 max-w-md text-black/60">Ada fitur yang kamu butuhkan, bagian yang membingungkan, atau masalah saat memakai FolioKu? Ceritakan di sini. Setiap pesan dibaca langsung oleh tim kami.</p></div></Reveal>
      <Reveal delay={0.08}><div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 md:p-8">
        {done?<div className="py-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Check size={22}/></span>
          <h3 className="font-display mt-4 text-xl font-semibold">Terima kasih!</h3><p className="mx-auto mt-2 max-w-xs text-sm text-black/60">Masukanmu sudah kami terima dan akan kami baca.</p>
          <button type="button" onClick={()=>{setF({kind:'saran',name:'',email:'',message:'',website:''});setDone(false)}} className="mt-5 text-sm font-medium underline">Kirim masukan lain</button></div>:
        <form onSubmit={submit} className="space-y-4" noValidate>
          <fieldset><legend className="mb-2 text-sm font-medium">Jenis masukan</legend>
            <div className="flex flex-wrap gap-2">{KINDS.map(([k,l])=><button key={k} type="button" aria-pressed={f.kind===k} onClick={()=>set('kind',k)} className={`rounded-full border px-4 py-2 text-sm transition ${f.kind===k?'border-[#111] bg-[#111] text-white':'border-black/15 bg-white hover:border-black/40'}`}>{l}</button>)}</div></fieldset>
          <div><label htmlFor="fb-msg" className="mb-1.5 block text-sm font-medium">Pesanmu</label>
            <textarea id="fb-msg" rows={5} maxLength={1500} required value={f.message} onChange={e=>set('message',e.target.value)} placeholder="Tulis saran, ide, atau masalah yang kamu temui…" className={inp+' resize-y'}/>
            <p className="mt-1 text-right text-xs text-black/40">{f.message.length}/1500</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="fb-name" className="mb-1.5 block text-sm font-medium">Nama <span className="font-normal text-black/40">(opsional)</span></label><input id="fb-name" maxLength={100} value={f.name} onChange={e=>set('name',e.target.value)} className={inp} autoComplete="name"/></div>
            <div><label htmlFor="fb-email" className="mb-1.5 block text-sm font-medium">Email <span className="font-normal text-black/40">(opsional, jika ingin dibalas)</span></label><input id="fb-email" type="email" maxLength={200} value={f.email} onChange={e=>set('email',e.target.value)} className={inp} autoComplete="email"/></div></div>
          <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={e=>set('website',e.target.value)}/></label></div>
          {err&&<p role="alert" className="text-sm text-red-600">{err}</p>}
          <button disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-[#111] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#e2561b] disabled:opacity-50"><Send size={15}/>{busy?'Mengirim…':'Kirim masukan'}</button></form>}
      </div></Reveal>
    </div></section>)
}

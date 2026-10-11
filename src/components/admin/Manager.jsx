import {useEffect,useState} from 'react'
import {FileText,ArrowDown,ArrowUp,Eye,EyeOff,Pencil,Plus,Star,Trash2} from 'lucide-react'
import {sb,upload} from '../../lib/supabase'
import {useToast} from './Toast'
import UploadBtn from './UploadBtn'
import {useAccount} from '../../lib/account'
import {isPdf} from '../../lib/files'
const inp='w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900'
const btn='rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100'
const dark='rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50'
const slug=s=>(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')
const toForm=(f,r)=>{const v=r[f.key];if(f.type==='stats')return (v||[]).map(x=>`${x.n} | ${x.l}`).join('\n');if(f.type==='check')return v??(f.def??true);if(f.type==='choice')return v??f.options[0][0];return v??''}
const fromForm=(f,v)=>{if(f.type==='stats')return v.split('\n').map(l=>l.split('|').map(x=>x.trim())).filter(a=>a[0]).map(a=>({n:a[0],l:a[1]||''}));if(f.type==='number')return v===''?null:Number(v);if(f.type==='select')return v||null;return v}

function Form({fields,row,opts,onSave,onCancel,saving}){
  const toast=useToast()
  const [v,setV]=useState(()=>Object.fromEntries(fields.map(f=>[f.key,toForm(f,row)])))
  const set=(k,x)=>setV(s=>({...s,[k]:x}))
  const up=async(f,file)=>{if(!file)return;if(file.size>8e6)return toast('Ukuran file maksimal 8 MB','err');try{set(f.key,await upload(file,f.folder));toast('File terunggah. Klik Simpan untuk menerapkan.')}catch(e){toast(e.message,'err')}}
  const submit=e=>{e.preventDefault();const p=Object.fromEntries(fields.map(f=>[f.key,fromForm(f,v[f.key])]));if('slug' in p&&!p.slug)p.slug=slug(p.title);onSave(p)}
  return(<form onSubmit={submit} className="space-y-4">
    {fields.map(f=>{const W=(f.type==='image'||f.type==='file'||f.type==='doc')?'div':'label';return <W key={f.key} className="block">
      {f.type==='check'?<span className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={!!v[f.key]} onChange={e=>set(f.key,e.target.checked)}/>{f.label}</span>:<span className="mb-1 block text-sm font-medium">{f.label}</span>}
      {(f.type==='textarea'||f.type==='stats')&&<textarea rows={f.type==='stats'?4:5} className={inp} value={v[f.key]} onChange={e=>set(f.key,e.target.value)}/>}
      {f.type==='select'&&<select className={inp} value={v[f.key]} onChange={e=>set(f.key,e.target.value)}><option value="">— pilih —</option>{(opts[f.key]||[]).map(o=><option key={o.id} value={o.id}>{o[f.show]}</option>)}</select>}
      {f.type==='choice'&&<select className={inp} value={v[f.key]} onChange={e=>setV({...v,[f.key]:e.target.value})}>{f.options.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select>}
        {(f.type==='image'||f.type==='file'||f.type==='doc')&&<div className="space-y-2">{v[f.key]&&((f.type==='image'||(f.type==='doc'&&!isPdf(v[f.key])))?<img src={v[f.key]} alt="" className="h-28 rounded-lg border object-cover"/>:<a href={v[f.key]} target="_blank" rel="noreferrer" className="flex w-fit items-center gap-2 rounded-lg border bg-neutral-50 px-3 py-2 text-sm underline"><FileText size={16}/>{f.type==='doc'?'File PDF terunggah. Klik untuk melihat':'Lihat file saat ini'}</a>)}
        <UploadBtn accept={f.accept||'image/*'} label={f.type==='image'?'foto':f.type==='doc'?'gambar / PDF':'file'} hasValue={!!v[f.key]} onFile={fl=>up(f,fl[0])} onRemove={()=>{set(f.key,'');toast('Dihapus dari form. Klik Simpan untuk menerapkan.')}}/></div>}
      {['text','number','color'].includes(f.type)&&<input type={f.type==='text'?'text':f.type} className={f.type==='color'?'h-10 w-20 cursor-pointer rounded border':inp} value={v[f.key]} onChange={e=>set(f.key,e.target.value)}/>}
      {f.type==='color'&&(v[f.key]?<button type="button" onClick={()=>set(f.key,'')} className="ml-3 cursor-pointer text-sm underline">Reset ke warna bawaan</button>:<span className="ml-3 text-sm text-neutral-500">Memakai warna bawaan</span>)}
      {f.hint&&<span className="mt-1 block text-xs text-neutral-500">{f.hint}</span>}
    </W>})}
    <div className="flex gap-2 pt-1"><button className={dark} disabled={saving}>{saving?'Menyimpan…':'Simpan'}</button>{onCancel&&<button type="button" onClick={onCancel} className={btn}>Batal</button>}</div>
  </form>)
}

export default function Manager({table,title,fields,publishable=false,sortable=true,singleton=false,primary='title',sub,thumb,extra,owned=true}){
  const toast=useToast(),{user}=useAccount(),uid=user?.id
  const [rows,setRows]=useState(null),[modal,setModal]=useState(null),[opts,setOpts]=useState({}),[saving,setSaving]=useState(false)
  const all=publishable&&!fields.some(f=>f.key==='published')?[...fields,{key:'published',label:'Tampilkan di website',type:'check'}]:fields
  const load=async()=>{let q=sb.from(table).select('*');if(owned)q=q.eq('owner_id',uid);q=sortable?q.order('sort_order'):q.order('created_at',{ascending:false});const {data,error}=await q;if(error)toast(error.message,'err');setRows(data||[])}
  const loadOpts=()=>fields.filter(f=>f.type==='select').forEach(async f=>{const {data}=await (owned?sb.from(f.table).select('id,'+f.show).eq('owner_id',uid):sb.from(f.table).select('id,'+f.show)).order('sort_order');setOpts(o=>({...o,[f.key]:data||[]}))})
  const openModal=r=>{loadOpts();setModal(r)}
  useEffect(()=>{setRows(null);load();loadOpts()},[table])
  const save=async(p,row)=>{setSaving(true);let r
    if(row?.id)r=await sb.from(table).update(p).eq('id',row.id)
    else{if(sortable&&!singleton)p.sort_order=rows.reduce((m,x)=>Math.max(m,x.sort_order||0),0)+1;if(owned)p.owner_id=uid;r=await sb.from(table).insert(p)}
    setSaving(false);if(r.error)return toast(r.error.message,'err');toast('Tersimpan');setModal(null);load()}
  const del=async r=>{if(!confirm('Hapus data ini? Tindakan ini tidak bisa dibatalkan.'))return;const {error}=await sb.from(table).delete().eq('id',r.id);if(error)toast(error.message,'err');else{toast('Dihapus');load()}}
  const toggle=async r=>{await sb.from(table).update({published:!r.published}).eq('id',r.id);load()}
  const move=async(i,d)=>{const a=[...rows];if(!a[i+d])return;[a[i],a[i+d]]=[a[i+d],a[i]];await Promise.all(a.map((r,k)=>sb.from(table).update({sort_order:k+1}).eq('id',r.id)));load()}
  if(!rows)return <p className="text-sm text-neutral-500">Memuat…</p>
  if(singleton){const row=rows[0];return <div className="max-w-2xl rounded-xl border bg-white p-5"><Form key={row?.id||'new'} fields={all} row={row||{}} opts={opts} saving={saving} onSave={p=>save(p,row)}/></div>}
  return(<div>
    <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{title}</h2><button className={dark+' flex items-center gap-1.5'} onClick={()=>openModal({})}><Plus size={15}/>Tambah</button></div>
    {rows.length===0?<div className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-neutral-500">Belum ada data. Klik Tambah untuk membuat yang pertama.</div>:
    <div className="divide-y rounded-xl border bg-white">{rows.map((r,i)=><div key={r.id} className="flex items-center gap-3 p-3">
      {thumb&&r[thumb]&&(isPdf(r[thumb])?<span className="grid h-11 w-11 place-items-center rounded-md bg-red-50 text-[10px] font-bold text-red-600">PDF</span>:<img src={r[thumb]} alt="" className="h-11 w-11 rounded-md object-cover"/>)}
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{r[primary]}{r.featured&&<Star size={12} className="ml-1.5 inline fill-amber-400 text-amber-400"/>}{publishable&&!r.published&&<span className="ml-2 rounded bg-neutral-200 px-1.5 py-0.5 text-[10px]">DRAFT</span>}</p>{sub&&<p className="truncate text-xs text-neutral-500">{typeof sub==='function'?sub(r):r[sub]}</p>}</div>
      <div className="flex flex-none items-center gap-0.5 text-neutral-600">
        {sortable&&<><button title="Naik" disabled={i===0} onClick={()=>move(i,-1)} className="p-1.5 disabled:opacity-25"><ArrowUp size={16}/></button><button title="Turun" disabled={i===rows.length-1} onClick={()=>move(i,1)} className="p-1.5 disabled:opacity-25"><ArrowDown size={16}/></button></>}
        {publishable&&<button title={r.published?'Sembunyikan':'Tampilkan'} onClick={()=>toggle(r)} className="p-1.5">{r.published?<Eye size={16}/>:<EyeOff size={16}/>}</button>}
        <button title="Edit" onClick={()=>openModal(r)} className="p-1.5"><Pencil size={16}/></button><button title="Hapus" onClick={()=>del(r)} className="p-1.5 text-red-600"><Trash2 size={16}/></button>
      </div></div>)}</div>}
    {modal&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onMouseDown={e=>e.target===e.currentTarget&&setModal(null)}>
      <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-xl bg-white p-6"><h3 className="mb-4 font-semibold">{modal.id?'Edit':'Tambah'} {title}</h3>
        <Form fields={all} row={modal} opts={opts} saving={saving} onSave={p=>save(p,modal)} onCancel={()=>setModal(null)}/>{modal.id&&extra&&extra(modal)}</div></div>}
  </div>)
}

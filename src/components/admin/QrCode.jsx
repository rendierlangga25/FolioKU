import {useEffect,useState} from 'react'
import {Download} from 'lucide-react'
// QR memuat link tetap /q/<id akun> yang selalu diarahkan ke username terbaru, jadi QR yang sudah dicetak
// tetap valid walau username berubah. Gambar QR dibuat ulang otomatis bila domain berubah. Koreksi error level Q + margin standar agar mudah dipindai.
const OPT={errorCorrectionLevel:'Q',margin:4,color:{dark:'#111111',light:'#ffffff'}}
export default function QrCode({url,name}){
  const [src,setSrc]=useState(''),[err,setErr]=useState(false)
  useEffect(()=>{let off=false;setSrc('');setErr(false)
    import('qrcode').then(Q=>Q.toDataURL(url,{...OPT,width:512})).then(d=>{if(!off)setSrc(d)}).catch(()=>{if(!off)setErr(true)})
    return()=>{off=true}},[url])
  const save=async(kind)=>{
    const Q=await import('qrcode');const a=document.createElement('a')
    if(kind==='png'){a.href=await Q.toDataURL(url,{...OPT,width:1200})}
    else{const svg=await Q.toString(url,{...OPT,type:'svg'});a.href=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}))}
    a.download=`qr-${name||'portofolio'}.${kind}`;document.body.appendChild(a);a.click();a.remove()
    if(kind==='svg')setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
  return(<div className="flex flex-none flex-col items-center gap-2">
    <div className="grid h-36 w-36 place-items-center overflow-hidden rounded-lg border bg-white">
      {src?<img src={src} alt="QR code menuju portofoliomu" className="h-full w-full"/>:<span className="text-xs text-neutral-400">{err?'QR gagal dibuat':'Memuat…'}</span>}</div>
    <div className="flex gap-1.5 text-xs">
      <button type="button" disabled={!src} onClick={()=>save('png')} className="flex items-center gap-1 rounded-lg bg-neutral-900 px-2.5 py-1.5 text-white disabled:opacity-40"><Download size={12}/>PNG</button>
      <button type="button" disabled={!src} onClick={()=>save('svg')} className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 disabled:opacity-40"><Download size={12}/>SVG</button></div></div>)
}

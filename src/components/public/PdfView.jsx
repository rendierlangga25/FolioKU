import {useEffect,useRef,useState} from 'react'
import {FileText} from 'lucide-react'
// Menampilkan PDF sebagai gambar (canvas). thumb = halaman 1 saja (kartu), selain itu semua halaman (maks 8).
// Jika gagal dirender (mis. file rusak / browser lama) tampil kartu dengan tautan buka PDF.
export default function PdfView({url,thumb=false,title=''}){
  const box=useRef(null),[st,setSt]=useState('load')
  useEffect(()=>{let off=false,doc=null;setSt('load')
    ;(async()=>{try{
      const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc=(await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
      doc=await pdfjs.getDocument({url}).promise
      const n=thumb?1:Math.min(doc.numPages,8);const host=box.current;if(off||!host)return;host.innerHTML=''
      for(let i=1;i<=n;i++){
        const pg=await doc.getPage(i);if(off)return
        const vp0=pg.getViewport({scale:1}),scale=Math.min(2,(thumb?600:900)/vp0.width),vp=pg.getViewport({scale})
        const c=document.createElement('canvas');c.width=Math.floor(vp.width);c.height=Math.floor(vp.height)
        c.style.cssText='width:100%;height:auto;display:block;'+(thumb?'':'margin-bottom:12px;border-radius:12px;border:1px solid rgba(0,0,0,.1)')
        c.setAttribute('role','img');c.setAttribute('aria-label',`${title} halaman ${i}`)
        host.appendChild(c);await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise}
      if(!off)setSt('ok')}catch(e){if(!off)setSt('err')}})()
    return()=>{off=true;try{doc&&doc.destroy()}catch{}}},[url,thumb])
  return(<div className="relative">
    <div ref={box} className={st==='ok'?'':'hidden'}/>
    {st==='load'&&<div className="grid place-items-center py-10 text-xs text-[var(--tx)]/45">Memuat PDF…</div>}
    {st==='err'&&<div className="grid place-items-center gap-2 py-10 text-center text-[var(--tx)]/50"><FileText size={thumb?44:32}/><span className="text-xs">Pratinjau PDF tidak tersedia</span></div>}
  </div>)
}

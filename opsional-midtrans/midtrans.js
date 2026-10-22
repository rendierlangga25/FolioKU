import {sb} from './supabase'
const env=import.meta.env.VITE_MIDTRANS_ENV==='production'?'production':'sandbox'
const SRC=env==='production'?'https://app.midtrans.com/snap/snap.js':'https://app.sandbox.midtrans.com/snap/snap.js'
let p
export const loadSnap=()=>p||(p=new Promise((ok,no)=>{
  if(window.snap)return ok(window.snap)
  const s=document.createElement('script');s.src=SRC;s.async=true
  s.setAttribute('data-client-key',import.meta.env.VITE_MIDTRANS_CLIENT_KEY||'')
  s.onload=()=>ok(window.snap);s.onerror=()=>{p=null;no(new Error('Gagal memuat Midtrans'))};document.head.appendChild(s)}))
async function api(path,opt={}){
  const {data:{session}}=await sb.auth.getSession()
  const r=await fetch(path,{...opt,headers:{'Content-Type':'application/json',Authorization:'Bearer '+(session?.access_token||''),...(opt.headers||{})}})
  const j=await r.json().catch(()=>({}))
  if(!r.ok)throw new Error(j.error||'Terjadi kesalahan ('+r.status+')')
  return j
}
export const syncOrder=id=>api('/api/order-status?order_id='+encodeURIComponent(id))
// Membuat pesanan lalu membuka popup pembayaran Midtrans. cb: {onDone(status), onClose()}
export async function checkout(planId,cb={}){
  const o=await api('/api/checkout',{method:'POST',body:JSON.stringify({plan_id:planId})})
  if(!import.meta.env.VITE_MIDTRANS_CLIENT_KEY){location.assign(o.redirect_url);return o}
  const snap=await loadSnap()
  const done=async()=>{let s='pending';try{s=(await syncOrder(o.order_id)).status}catch{};cb.onDone?.(s,o)}
  snap.pay(o.token,{onSuccess:done,onPending:done,onError:done,onClose:()=>cb.onClose?.(o)})
  return o
}

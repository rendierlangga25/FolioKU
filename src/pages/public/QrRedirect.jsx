import {useEffect,useState} from 'react'
import {Link,Navigate,useParams} from 'react-router-dom'
import {sb} from '../../lib/supabase'
// Link tetap untuk QR: /q/<id akun> -> /u/<username terbaru>
export default function QrRedirect(){
  const {id}=useParams(),[st,setSt]=useState({loading:true})
  useEffect(()=>{let off=false
    if(!/^[0-9a-f-]{36}$/i.test(id)){setSt({missing:true});return}
    sb.from('profiles').select('username').eq('owner_id',id).maybeSingle().then(({data,error})=>{if(off)return;if(error)setSt({error:true});else setSt(data?.username?{username:data.username}:{missing:true})})
    return()=>{off=true}},[id])
  if(st.username)return <Navigate to={`/u/${st.username}`} replace/>
  if(st.loading)return <div className="grid min-h-screen place-items-center text-sm text-neutral-500">Memuat…</div>
  return <div className="grid min-h-screen place-items-center bg-[#f3f1ec] p-6 text-center"><div><p className="font-display text-6xl font-semibold text-black/15">{st.error?'Oops':'404'}</p><h1 className="font-display mt-2 text-xl font-semibold">{st.error?'Gagal memuat, coba lagi.':'Portofolio tidak ditemukan.'}</h1><Link to="/" className="mt-4 inline-block text-sm underline">Ke beranda</Link></div></div>
}

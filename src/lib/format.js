export const rp=n=>'Rp\u00a0'+new Intl.NumberFormat('id-ID').format(Math.round(Number(n)||0))
export const dur=p=>p.duration_months==null?'Selamanya':p.duration_months%12===0?`${p.duration_months/12} tahun`:`${p.duration_months} bulan`
export const perMonth=p=>p.duration_months?Math.round(p.price/p.duration_months):null
export const disc=p=>p.original_price&&p.original_price>p.price?Math.round((1-p.price/p.original_price)*100):0
export const dt=d=>d?new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}):'-'
export const daysLeft=d=>Math.max(0,Math.ceil((new Date(d)-new Date())/864e5))
export const waLink=(n,t='Halo, saya mau tanya soal langganan')=>n?`https://wa.me/${String(n).replace(/\D/g,'')}?text=${encodeURIComponent(t)}`:''
export const rpShort=n=>{n=Number(n)||0;const a=Math.abs(n),f=(v,u)=>(Math.round(v*10)/10).toString().replace('.',',')+' '+u;return a>=1e9?f(n/1e9,'M'):a>=1e6?f(n/1e6,'jt'):a>=1e3?f(n/1e3,'rb'):String(Math.round(n))}
export const parseDay=s=>new Date(String(s).slice(0,10)+'T00:00:00')
export const dayLabel=s=>parseDay(s).toLocaleDateString('id-ID',{day:'numeric',month:'short'})
export const monthLabel=s=>parseDay(s).toLocaleDateString('id-ID',{month:'short',year:'2-digit'})
export const dtTime=d=>d?new Date(d).toLocaleString('id-ID',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'-'

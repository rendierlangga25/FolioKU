import {useState} from 'react'
import {Link,NavLink,Outlet,useLocation,useNavigate} from 'react-router-dom'
import {Award,Briefcase,CreditCard,FileText,FolderKanban,GraduationCap,LayoutDashboard,Link2,LogOut,Mail,Menu,Phone,Settings,User,Wrench,X,ExternalLink,Lock,Shield,Tags,Receipt,Users,Megaphone,BarChart3,Wallet,MessageSquare} from 'lucide-react'
import {useAccount} from '../lib/account'
import {usePlans} from '../lib/plans'
import {daysLeft,dt} from '../lib/format'
const USER=[['/app','Dashboard',LayoutDashboard],['/app/billing','Langganan',CreditCard],['/app/profile','Profile',User],['/app/about','About',FileText],['/app/experience','Experience',Briefcase],['/app/projects','Projects',FolderKanban],['/app/certificates','Certificates',Award],['/app/skills','Skills',Wrench],['/app/education','Education',GraduationCap],['/app/contact','Contact',Phone],['/app/social','Social Links',Link2],['/app/settings','Site Settings',Settings],['/app/messages','Messages',Mail]]
const OWNER=[['/owner','Ringkasan',BarChart3],['/owner/plans','Paket & Harga',Tags],['/owner/orders','Pesanan',Receipt],['/owner/methods','Metode Pembayaran',Wallet],['/owner/users','Pelanggan',Users],['/owner/feedback','Saran & Masukan',MessageSquare],['/owner/settings','Pengaturan Landing',Megaphone]]
const FREE=['/app','/app/billing','/app/messages']
export default function AppLayout({owner=false}){
  const [open,setOpen]=useState(false),nav=useNavigate(),loc=useLocation(),a=useAccount(),{app}=usePlans()
  const items=owner?OWNER:USER,out=async()=>{await a.signOut();nav('/')}
  const locked=!owner&&!a.access&&!FREE.includes(loc.pathname.replace(/\/$/,''))
  const sub=a.sub,left=sub&&!sub.is_lifetime&&sub.expires_at?daysLeft(sub.expires_at):null
  const banner=owner?null:!a.access?['bg-red-50 text-red-800',sub?`Langganan berakhir pada ${dt(sub.expires_at)}. Portofoliomu disembunyikan sampai kamu memperpanjang.`:'Langganan belum aktif. Portofoliomu belum tampil di publik.']:(left!==null&&left<=7?['bg-amber-50 text-amber-800',`Langganan berakhir ${left} hari lagi (${dt(sub.expires_at)}). Perpanjang agar portofolio tetap tampil.`]:null)
  const link=to=><NavLink key={to[0]} to={to[0]} end={to[0]==='/app'||to[0]==='/owner'} onClick={()=>setOpen(false)} className={({isActive})=>`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${isActive?'bg-neutral-900 text-white':'text-neutral-600 hover:bg-neutral-100'}`}>{(()=>{const I=to[2];return <I size={17}/>})()}{to[1]}</NavLink>
  return(<div className="min-h-screen bg-neutral-100 text-neutral-900">
    <aside className={`fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r bg-white p-4 transition-transform md:translate-x-0 ${open?'translate-x-0':'-translate-x-full'}`}>
      <Link to="/" className="font-display mb-6 flex items-center gap-2 px-2 text-lg font-semibold"><span className="grid h-8 w-8 place-items-center rounded-full bg-black text-xs text-white">{app.brand_name.slice(0,2)}</span>{owner?'Owner':app.brand_name}</Link>
      <nav className="flex-1 space-y-0.5 overflow-y-auto">{items.map(link)}</nav>
      <div className="mt-3 space-y-0.5 border-t pt-3">{a.isAdmin&&(owner?link(['/app','Dashboard saya',LayoutDashboard]):link(['/owner','Panel Owner',Shield]))}</div></aside>
    {open&&<div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={()=>setOpen(false)}/>}
    <div className="md:pl-60"><header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-white/90 px-4 backdrop-blur">
      <button className="md:hidden" onClick={()=>setOpen(!open)} aria-label="Menu">{open?<X/>:<Menu/>}</button><span className="hidden text-sm text-neutral-500 md:block">{a.user?.email}</span>
      <div className="flex items-center gap-4 text-sm">{a.profile?.username&&!owner&&<a href={`/u/${a.profile.username}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-neutral-600"><ExternalLink size={15}/>Lihat portofolio</a>}<button onClick={out} className="flex items-center gap-1.5 text-neutral-600"><LogOut size={15}/>Keluar</button></div></header>
      {banner&&<div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm ${banner[0]}`}><span>{banner[1]}</span><Link to="/app/billing" className="font-semibold underline">Kelola langganan</Link></div>}
      <main className="p-4 md:p-8">{locked?<div className="mx-auto max-w-md rounded-2xl border bg-white p-8 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-neutral-100"><Lock size={20}/></span><h2 className="font-display mt-4 text-lg font-semibold">Fitur ini perlu langganan aktif</h2><p className="mt-2 text-sm text-neutral-500">Aktifkan paket untuk mengedit dan mempublikasikan portofoliomu. Datamu tetap aman.</p><Link to="/app/billing" className="mt-5 inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white">Pilih paket</Link></div>:<Outlet/>}</main></div></div>)
}

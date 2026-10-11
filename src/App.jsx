import {useEffect} from 'react'
import {BrowserRouter,Routes,Route,Navigate,useNavigate} from 'react-router-dom'
import Landing from './pages/landing/Landing.jsx'
import Legal from './pages/landing/Legal.jsx'
import SignIn from './pages/auth/SignIn.jsx'
import SignUp from './pages/auth/SignUp.jsx'
import Reset from './pages/auth/Reset.jsx'
import Public,{Demo} from './pages/public/Public.jsx'
import QrRedirect from './pages/public/QrRedirect.jsx'
import Dashboard from './pages/admin/Dashboard.jsx'
import Messages from './pages/admin/Messages.jsx'
import * as P from './pages/admin/Pages.jsx'
import Billing from './pages/app/Billing.jsx'
import * as O from './pages/owner/Owner.jsx'
import AppLayout from './layouts/AppLayout.jsx'
import Guard,{OwnerGuard} from './components/admin/Guard.jsx'
import {ToastProvider} from './components/admin/Toast.jsx'
import {AccountProvider} from './lib/account.jsx'
function AuthLinkNotice(){
  const nav=useNavigate()
  useEffect(()=>{
    const h=new URLSearchParams(location.hash.replace(/^#/,''))
    const code=h.get('error_code'),desc=h.get('error_description')
    if(!code&&!desc)return
    const msg=/expired|invalid/i.test(code+' '+desc)
      ?'Tautan di email sudah kedaluwarsa atau pernah dipakai. Jika kamu sudah pernah mengkliknya, akunmu kemungkinan sudah aktif. Coba masuk dengan email dan password.'
      :(desc||'Tautan email tidak valid.').replace(/\+/g,' ')
    history.replaceState(null,'',location.pathname+location.search)
    nav('/masuk',{replace:true,state:{notice:msg}})
  },[])
  return null
}
export default function App(){return(
<BrowserRouter><AuthLinkNotice/><AccountProvider><ToastProvider><Routes>
<Route path="/" element={<Landing/>}/>
<Route path="/masuk" element={<SignIn/>}/><Route path="/daftar" element={<SignUp/>}/><Route path="/reset" element={<Reset/>}/>
<Route path="/syarat" element={<Legal kind="syarat"/>}/><Route path="/privasi" element={<Legal kind="privasi"/>}/>
<Route path="/demo" element={<Demo/>}/><Route path="/u/:username" element={<Public/>}/><Route path="/q/:id" element={<QrRedirect/>}/>
<Route path="/app" element={<Guard><AppLayout/></Guard>}>
<Route index element={<Dashboard/>}/><Route path="billing" element={<Billing/>}/>
<Route path="profile" element={<P.Profile/>}/><Route path="about" element={<P.About/>}/>
<Route path="experience" element={<P.Experience/>}/><Route path="projects" element={<P.Projects/>}/><Route path="certificates" element={<P.Certificates/>}/>
<Route path="skills" element={<P.Skills/>}/><Route path="education" element={<P.Education/>}/>
<Route path="contact" element={<P.Contact/>}/><Route path="social" element={<P.Social/>}/>
<Route path="settings" element={<P.Settings/>}/><Route path="messages" element={<Messages/>}/>
</Route>
<Route path="/owner" element={<OwnerGuard><AppLayout owner/></OwnerGuard>}>
<Route index element={<O.Overview/>}/><Route path="plans" element={<O.Plans/>}/><Route path="orders" element={<O.Orders/>}/><Route path="methods" element={<O.Methods/>}/><Route path="users" element={<O.Users/>}/><Route path="settings" element={<O.AppSettings/>}/><Route path="feedback" element={<O.Feedback/>}/>
</Route>
<Route path="/admin/*" element={<Navigate to="/app" replace/>}/>
<Route path="*" element={<Navigate to="/" replace/>}/>
</Routes></ToastProvider></AccountProvider></BrowserRouter>)}

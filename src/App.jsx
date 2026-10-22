import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Landing from './pages/Landing.jsx';
import { Login, Register, Forgot, ResetPassword } from './pages/AuthPages.jsx';
import Shell from './components/Shell.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Operasional from './pages/Operasional.jsx';
import BiayaLogistic from './pages/BiayaLogistic.jsx';
import LoadingDock from './pages/LoadingDock.jsx';
import Database from './pages/Database.jsx';
import Master from './pages/Master.jsx';
import Users from './pages/Users.jsx';
import ReportLogistic from './pages/ReportLogistic.jsx';
import Pending from './pages/Pending.jsx';

function Splash() {
  return <div className="splash"><div className="spinner" /></div>;
}

function Protected({ children }) {
  const { session, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Splash />;
  if (!session) return <Navigate to="/masuk" state={{ from: loc.pathname }} replace />;
  return children;
}

/** Halaman hanya untuk user yang punya izin `perm` (atau owner-only bila ownerOnly). */
function Gate({ perm, ownerOnly, children }) {
  const { can, isOwner } = useAuth();
  const perms = [].concat(perm || []);          // perm bisa satu atau beberapa (cukup salah satu)
  if (ownerOnly ? !isOwner : !perms.some((k) => can(k))) return <Navigate to="/app" replace />;
  return children;
}

/** /app → arahkan ke halaman pertama yang boleh diakses. */
function AppHome() {
  const { isOwner, can, seeAllHistory } = useAuth();
  if (isOwner || can('dashboard')) return <Navigate to="/app/dashboard" replace />;
  if (can('operasional_driver') || can('riwayat_saya') || seeAllHistory) return <Navigate to="/app/operasional/driver" replace />;
  if (can('biaya_logistic')) return <Navigate to="/app/biaya-logistic" replace />;
  if (can('database_driver')) return <Navigate to="/app/armada" replace />;
  if (can('loading_dock')) return <Navigate to="/app/loading-dock" replace />;
  if (can('master_data')) return <Navigate to="/app/master" replace />;
  return <Pending />;
}

export default function App() {
  const { session, loading } = useAuth();
  const guest = (el) => (!loading && session ? <Navigate to="/app" replace /> : el);
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/masuk" element={guest(<Login />)} />
      <Route path="/daftar" element={guest(<Register />)} />
      <Route path="/lupa-password" element={<Forgot />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/app" element={<Protected><Shell /></Protected>}>
        <Route index element={<AppHome />} />
        <Route path="dashboard" element={<Gate perm="dashboard"><Dashboard /></Gate>} />
        <Route path="operasional/driver" element={<Operasional />} />
        <Route path="biaya-logistic" element={<Gate perm="biaya_logistic"><BiayaLogistic /></Gate>} />
        <Route path="loading-dock" element={<Gate perm="loading_dock"><LoadingDock /></Gate>} />
        <Route path="riwayat" element={<Navigate to="/app/operasional/driver?tab=riwayat" replace />} />
        <Route path="armada" element={<Gate perm="database_driver"><Database /></Gate>} />
        <Route path="database" element={<Navigate to="/app/armada" replace />} />
        <Route path="profil" element={<Navigate to="/app/operasional/driver?tab=profil" replace />} />
        <Route path="report-logistic" element={<Gate ownerOnly><ReportLogistic /></Gate>} />
        <Route path="master" element={<Gate perm="master_data"><Master /></Gate>} />
        <Route path="user" element={<Gate ownerOnly><Users /></Gate>} />
        <Route path="pengguna" element={<Navigate to="/app/user" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

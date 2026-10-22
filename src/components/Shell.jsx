import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import Logo from './Logo.jsx';
import Ic from './MiniIcons.jsx';
import { IcCost, IcDock, IcDriver, IcHome, IcLogout, IcMaster, IcReport, IcTruck, IcUsers } from './Icons.jsx';
import StorageAlert from './StorageAlert.jsx';
import { useStorageUsage } from '../lib/useStorageUsage.js';

export default function Shell() {
  const { profile, can, isOwner, signOut } = useAuth();
  const nav = useNavigate();
  const storage = useStorageUsage(isOwner);   // peringatan penyimpanan hampir penuh khusus developer (owner)
  const storageWarn = Boolean(storage.ev && storage.ev.level !== 'ok');

  // Taskbar bisa ditutup/dibuka: di komputer menyusut jadi deretan ikon, di HP bilah bawah turun/naik.
  // Pilihan diingat per perangkat.
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('raxer.nav.collapsed') === '1'; } catch { return false; } });
  const toggleNav = () => setCollapsed((c) => {
    const n = !c;
    try { localStorage.setItem('raxer.nav.collapsed', n ? '1' : '0'); } catch { /* abaikan */ }
    return n;
  });

  // INPUT, RIWAYAT, PERFORMA, PROFIL adalah tab di dalam menu DRIVER (PERFORMA & PROFIL untuk semua user aktif).
  const items = [
    can('dashboard') && { to: '/app/dashboard', label: 'DASHBOARD', short: 'BERANDA', Ic: IcHome },
    profile?.active !== false && { to: '/app/operasional/driver', label: 'DRIVER', short: 'DRIVER', Ic: IcDriver, group: 'LOGISTIC' },
    can('biaya_logistic') && { to: '/app/biaya-logistic', label: 'BIAYA LOGISTIC', short: 'BIAYA', Ic: IcCost, group: 'LOGISTIC' },
    can('database_driver') && { to: '/app/armada', label: 'ARMADA', short: 'ARMADA', Ic: IcTruck, group: 'LOGISTIC' },
    can('loading_dock') && { to: '/app/loading-dock', label: 'LOADING DOCK', short: 'DOCK', Ic: IcDock, group: 'LOGISTIC' },
    isOwner && { to: '/app/report-logistic', label: 'REPORT LOGISTIC', short: 'REPORT', Ic: IcReport, group: 'REPORT', alert: storageWarn },
    can('master_data') && { to: '/app/master', label: 'MASTER DATA', short: 'MASTER', Ic: IcMaster, group: 'PENGATURAN' },
    isOwner && { to: '/app/user', label: 'USER', short: 'USER', Ic: IcUsers, group: 'PENGATURAN' },
  ].filter(Boolean);

  const logout = async () => { await signOut(); nav('/', { replace: true }); };

  return (
    <div className={'shell' + (collapsed ? ' nav-collapsed' : '')}>
      <aside className="side">
        <div className="side-top">
          <Logo light />
          <button type="button" className="nav-toggle" onClick={toggleNav} aria-expanded={!collapsed}
            aria-label={collapsed ? 'Buka menu' : 'Tutup menu'} title={collapsed ? 'BUKA MENU' : 'TUTUP MENU'}>
            <Ic n="chevl" />
          </button>
        </div>
        <nav className="side-nav" aria-label="Menu utama">
          {items.map((i, idx) => (
            <div key={i.to}>
              {i.group && items[idx - 1]?.group !== i.group && <div className="side-group">{i.group}</div>}
              <NavLink to={i.to} title={i.label} className={({ isActive }) => 'side-link' + (isActive ? ' active' : '')}>
                <span className="ic"><i.Ic /></span><span className="lbl">{i.label}</span>
                {i.alert && <span className="nav-dot" role="img" aria-label="Penyimpanan hampir penuh" />}
              </NavLink>
            </div>
          ))}
        </nav>
        <div className="side-user">
          <div className="avatar">{(profile?.nama || '?').slice(0, 1).toUpperCase()}</div>
          <div className="who"><b>{profile?.nama}</b><small>{isOwner ? 'DEVELOPER' : (profile?.user_type || 'DRIVER')}</small></div>
          <button className="btn-icon" onClick={logout} title="KELUAR" aria-label="Keluar"><IcLogout /></button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <Logo />
          <div className="topbar-user">
            <small>{profile?.nama}</small>
            <button className="btn btn-ghost btn-sm" onClick={logout}>KELUAR</button>
          </div>
        </header>
        <div className="content">{isOwner && <StorageAlert ev={storage.ev} />}<Outlet /></div>
      </div>

      <nav className="tabbar" aria-label="Menu">
        <button type="button" className="tab-toggle" onClick={toggleNav} aria-expanded={!collapsed}
          aria-label={collapsed ? 'Buka menu' : 'Tutup menu'}><Ic n="chev" /></button>
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
            <span aria-hidden="true"><i.Ic /></span>{i.short}{i.alert && <span className="nav-dot" aria-hidden="true" />}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

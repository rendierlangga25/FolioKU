import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { api } from './lib/api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const [settings, setSettings] = useState({});

  const loadProfile = useCallback(async (s) => {
    if (!s) { setProfile(null); setSettings({}); return; }
    try { setProfile(await api.getProfile(s.user.id)); } catch { setProfile(null); }
    try { setSettings((await api.getSettings()) || {}); } catch { /* pakai bawaan */ }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await api.getSession();
      if (!alive) return;
      setSession(s);
      await loadProfile(s);
      if (alive) setLoading(false);
    })();
    const off = api.onAuthChange(async (event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(s);
      await loadProfile(s);
    });
    return () => { alive = false; off(); };
  }, [loadProfile]);

  const value = useMemo(() => {
    const isOwner = profile?.role === 'owner' && profile?.active !== false;
    const can = (k) => Boolean(profile?.active !== false && (isOwner || profile?.permissions?.[k]));
    // RIWAYAT seluruh driver terbuka untuk semua posisi / semua user aktif
    const seeAllHistory = profile?.active !== false && Boolean(profile);
    return {
      session, profile, loading, recovery, isOwner, can, seeAllHistory, settings,
      refresh: () => loadProfile(session),
      saveSetting: async (k, v) => { await api.saveSetting(k, v); setSettings((x) => ({ ...x, [k]: v })); },
      signOut: () => api.signOut(),
    };
  }, [session, profile, loading, recovery, loadProfile, settings]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

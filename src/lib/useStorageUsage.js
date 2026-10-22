import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { evaluate } from './storageUsage.js';

const KEY = 'raxer.storage.cache.v1', TTL = 15 * 60 * 1000, EVT = 'raxer:storage';
const readCache = () => { try { const c = JSON.parse(sessionStorage.getItem(KEY)); if (c && Date.now() - c.at < TTL) return c.usage; } catch { /* abaikan */ } return null; };

/**
 * Penggunaan database & penyimpanan foto (hanya developer/owner). Hasil disimpan 15 menit per tab supaya
 * berpindah halaman tidak memanggil database terus-menerus; reload() memaksa data baru dan memberi tahu komponen lain.
 */
export function useStorageUsage(enabled) {
  const [usage, setUsage] = useState(() => (enabled ? readCache() : null));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (force) => {
    if (!enabled) return;
    if (!force) { const c = readCache(); if (c) { setUsage(c); return; } }
    setLoading(true);
    try {
      const u = await api.storageUsage();
      try { sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), usage: u })); } catch { /* abaikan */ }
      setUsage(u); setError('');
      window.dispatchEvent(new Event(EVT));
    } catch (e) { setError(e.message || 'Gagal membaca penggunaan penyimpanan'); } finally { setLoading(false); }
  }, [enabled]);

  useEffect(() => { load(false); }, [load]);
  useEffect(() => {
    const on = () => { const c = readCache(); if (c) setUsage(c); };
    window.addEventListener(EVT, on); return () => window.removeEventListener(EVT, on);
  }, []);

  return { usage, ev: usage ? evaluate(usage) : null, error, loading, reload: () => load(true) };
}

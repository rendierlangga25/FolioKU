import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

/** Daftar pilihan LOADING DOCK: nama perusahaan & nama expedisi (dropdown + bisa diketik manual). */
export function useDockOptions() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    // opsional: bila tabelnya belum dibuat, form tetap jalan (isi manual)
    try { setList(await api.listDockOptions()); } catch { setList([]); } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const names = useMemo(() => ({
    perusahaan: list.filter((o) => o.tipe === 'perusahaan' && o.aktif).map((o) => o.nama),
    expedisi: list.filter((o) => o.tipe === 'expedisi' && o.aktif).map((o) => o.nama),
    perusahaanAll: list.filter((o) => o.tipe === 'perusahaan').map((o) => o.nama),
    expedisiAll: list.filter((o) => o.tipe === 'expedisi').map((o) => o.nama),
  }), [list]);

  return { list, loading, reload, ...names };
}

export const normDock = (s) => String(s || '').trim().replace(/\s+/g, ' ').toUpperCase();

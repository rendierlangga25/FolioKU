import { useEffect, useState } from 'react';
import { api } from './api.js';

/** Statistik bulanan semua driver (bahan XP, tier, peringkat). rows = null saat memuat. */
export function useDriverStats() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let alive = true;
    api.driverMonthlyStats().then((r) => alive && setRows(r)).catch((e) => {
      if (!alive) return; setRows([]);
      setErr(/driver_monthly_stats|function/i.test(e.message) ? 'Fungsi statistik belum ada di database. Jalankan supabase/migrations/2026-10-revisi-profil.sql.' : e.message);
    });
    return () => { alive = false; };
  }, []);
  return { rows, err };
}

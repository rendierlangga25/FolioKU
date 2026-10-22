import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

/** Memuat data master (driver, mobil, harga BBM) + peta id → objek. */
export function useMaster() {
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [fuel, setFuel] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const [d, v, f, dest] = await Promise.all([
        api.listDrivers(), api.listVehicles(), api.listFuel(),
        // daftar tujuan opsional: bila tabelnya belum dibuat, form tetap jalan (tujuan ketik manual)
        api.listDestinations().catch(() => []),
      ]);
      setDrivers(d); setVehicles(v); setFuel(f); setDestinations(dest); setError('');
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const maps = useMemo(() => ({
    driver: Object.fromEntries(drivers.map((d) => [d.id, d])),
    vehicle: Object.fromEntries(vehicles.map((v) => [v.id, v])),
    price: Object.fromEntries(fuel.map((f) => [f.jenis, +f.harga])),
  }), [drivers, vehicles, fuel]);

  return { drivers, vehicles, fuel, destinations, loading, error, reload, ...maps };
}

export const vehicleLabel = (v) => (v ? `${v.nama} · ${v.plat}` : '—');

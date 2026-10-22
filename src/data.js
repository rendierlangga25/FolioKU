import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase.js'

export function useMaster() {
  const [drivers, setDrivers] = useState([]); const [vehicles, setVehicles] = useState([]); const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    const [d, v] = await Promise.all([
      supabase.from('drivers').select('*').order('name'),
      supabase.from('vehicles').select('*').order('name').order('plate'),
    ])
    setDrivers(d.data || []); setVehicles(v.data || []); setLoading(false)
  }, [])
  useEffect(() => { reload() }, [reload])
  return { drivers, vehicles, loading, reload }
}

export function useTrips({ from, to }) {
  const [trips, setTrips] = useState([]); const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('trips').select('*').order('trip_date', { ascending: false }).order('created_at', { ascending: false }).limit(5000)
    if (from) q = q.gte('trip_date', from)
    if (to) q = q.lte('trip_date', to)
    const { data } = await q
    setTrips(data || []); setLoading(false)
  }, [from, to])
  useEffect(() => { reload() }, [reload])
  return { trips, loading, reload }
}

export const monthRange = (ym) => {  // 'YYYY-MM' -> {from,to}
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` }
}

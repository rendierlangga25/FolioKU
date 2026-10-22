import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const configured = Boolean(url && key)

// "Ingat saya": ON  -> sesi disimpan di localStorage (tetap login setelah browser ditutup)
//               OFF -> sesi hanya di sessionStorage (hilang saat tab/browser ditutup)
const FLAG = 'raxer_remember'
export const setRemember = (v) => { try { localStorage.setItem(FLAG, v ? '1' : '0') } catch {} }
export const getRemember = () => { try { return localStorage.getItem(FLAG) !== '0' } catch { return true } }

const storage = {
  getItem: (k) => { try { return localStorage.getItem(k) ?? sessionStorage.getItem(k) } catch { return null } },
  setItem: (k, v) => {
    try {
      if (getRemember()) { localStorage.setItem(k, v); sessionStorage.removeItem(k) }
      else { sessionStorage.setItem(k, v); localStorage.removeItem(k) }
    } catch {}
  },
  removeItem: (k) => { try { localStorage.removeItem(k); sessionStorage.removeItem(k) } catch {} },
}

export const supabase = configured
  ? createClient(url, key, { auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null

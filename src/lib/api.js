// Memilih backend: Supabase bila env tersedia, kalau tidak → mode demo (localStorage).
const hasSupabase = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

export const api = hasSupabase
  ? (await import('./api.supabase.js')).api
  : (await import('./api.local.js')).api;

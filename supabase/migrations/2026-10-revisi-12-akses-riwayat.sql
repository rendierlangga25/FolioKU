-- REVISI 12: akses RIWAYAT semua driver dipilih per user (MASTER DATA > AKSES RIWAYAT SEMUA DRIVER).
-- Jalankan SETELAH revisi-10. Aman dijalankan berulang. Jalankan SEKALI di Supabase > SQL Editor.

-- Daftar id user yang dipilih developer (menggantikan saklar "semua user")
insert into public.app_settings (key, value) values ('riwayat_user_ids', '[]'::jsonb)
  on conflict (key) do nothing;

create or replace function public.history_open() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active)
     and coalesce((select value ? auth.uid()::text from app_settings where key = 'riwayat_user_ids'), false);
$$;

notify pgrst, 'reload schema';

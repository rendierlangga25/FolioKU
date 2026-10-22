-- REVISI 5: jenis USER (DRIVER / SPV / ADMIN / MANAGER) + peringkat performa per rentang tanggal.
-- Aman dijalankan berulang. Jalankan SEKALI di Supabase > SQL Editor.

-- 1) Jenis user. Akun lama otomatis = DRIVER (owner tidak memakai kolom ini).
alter table public.profiles add column if not exists user_type text not null default 'DRIVER';
alter table public.profiles drop constraint if exists profiles_user_type_check;
alter table public.profiles add constraint profiles_user_type_check check (user_type in ('DRIVER','SPV','ADMIN','MANAGER'));

-- 2) Statistik driver pada rentang tanggal (bahan PERFORMA dengan filter tanggal).
--    Agregat saja (tanpa biaya/foto) → aman dibuka ke semua user aktif. jarak & liter penuh (tidak dibagi 2 driver).
create or replace function public.driver_range_stats(p_from date, p_to date)
returns table (driver_id uuid, trips integer, jarak numeric, liter numeric)
language sql stable security definer set search_path = public as $$
  with x as (
    select d.driver_id,
           greatest(t.km_akhir - t.km_awal, 0) as jarak,
           case when t.harga_liter > 0 then t.bbm_rp / t.harga_liter else 0 end as liter
    from trips t cross join lateral (values (t.driver1_id), (t.driver2_id)) d(driver_id)
    where d.driver_id is not null
      and (p_from is null or t.tanggal >= p_from) and (p_to is null or t.tanggal <= p_to)
  )
  select driver_id, count(*)::integer, sum(jarak), sum(liter)
  from x
  where exists (select 1 from profiles where id = auth.uid() and active)
  group by 1;
$$;
revoke all on function public.driver_range_stats(date, date) from public;
grant execute on function public.driver_range_stats(date, date) to authenticated;

-- Muat ulang struktur tabel di API Supabase agar kolom/izin baru langsung terbaca
notify pgrst, 'reload schema';

-- REVISI 4: profil driver, XP/tier, peringkat efisiensi.
-- Aman dijalankan berulang. Sudah punya database lama? Jalankan file ini saja (tanpa schema.sql).

alter table public.drivers  add column if not exists nama_lengkap text;
alter table public.drivers  add column if not exists id_karyawan  text;
alter table public.drivers  add column if not exists departemen   text;
alter table public.drivers  add column if not exists jabatan      text;
alter table public.drivers  add column if not exists foto         text;   -- JPEG 320x320 (data-URL), tampil untuk semua user
alter table public.profiles add column if not exists driver_id uuid references public.drivers(id) on delete set null;
-- profiles hanya bisa diubah owner (policy yang sudah ada) → user tidak bisa menautkan dirinya ke driver lain.

-- Statistik bulanan per driver. Agregat saja (tanpa data biaya/foto), jadi aman dibuka ke semua user aktif.
-- jarak & liter = penuh (tidak dibagi 2 driver) supaya peringkat KM/L adil untuk driver yang jalan berdua.
create or replace function public.driver_monthly_stats()
returns table (driver_id uuid, ym text, trips integer, jarak numeric, liter numeric)
language sql stable security definer set search_path = public as $$
  with x as (
    select d.driver_id, t.tanggal,
           greatest(t.km_akhir - t.km_awal, 0) as jarak,
           case when t.harga_liter > 0 then t.bbm_rp / t.harga_liter else 0 end as liter
    from trips t cross join lateral (values (t.driver1_id), (t.driver2_id)) d(driver_id)
    where d.driver_id is not null
  )
  select driver_id, to_char(tanggal, 'YYYY-MM'), count(*)::integer, sum(jarak), sum(liter)
  from x
  where exists (select 1 from profiles where id = auth.uid() and active)
  group by 1, 2;
$$;
revoke all on function public.driver_monthly_stats() from public;
grant execute on function public.driver_monthly_stats() to authenticated;

-- Driver mengganti FOTO miliknya sendiri (data diri lain hanya bisa diubah owner di Master Data).
create or replace function public.set_my_driver_photo(p_foto text) returns void
language plpgsql security definer set search_path = public as $$
declare did uuid;
begin
  select driver_id into did from profiles where id = auth.uid() and active;
  if did is null then raise exception 'Akun belum terhubung ke data driver. Minta owner menghubungkannya di menu USER.'; end if;
  if p_foto is not null and length(p_foto) > 250000 then raise exception 'Foto terlalu besar'; end if;
  update drivers set foto = p_foto where id = did;
end $$;
revoke all on function public.set_my_driver_photo(text) from public;
grant execute on function public.set_my_driver_photo(text) to authenticated;

-- Muat ulang struktur tabel di API Supabase agar kolom/izin baru langsung terbaca
notify pgrst, 'reload schema';

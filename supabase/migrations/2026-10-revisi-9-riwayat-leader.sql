-- REVISI 9: jenis user LEADER + RIWAYAT seluruh driver untuk OWNER / LEADER / SPV / ADMIN / MANAGER.
-- Aman dijalankan berulang. Jalankan SEKALI di Supabase > SQL Editor.

-- 1) Tambah jenis user LEADER
alter table public.profiles drop constraint if exists profiles_user_type_check;
alter table public.profiles add constraint profiles_user_type_check
  check (user_type in ('DRIVER','LEADER','SPV','ADMIN','MANAGER'));

-- 2) Siapa yang boleh melihat riwayat semua driver
create or replace function public.can_see_all_history() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and active
      and (role = 'owner' or user_type in ('LEADER','SPV','ADMIN','MANAGER'))
  );
$$;

-- 3) Kebijakan baca data pengiriman
drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips for select to authenticated using (
  public.has_perm('database_driver')
  or public.has_perm('biaya_logistic')
  or public.can_see_all_history()
  or (created_by = auth.uid() and public.has_perm('riwayat_saya'))
);

notify pgrst, 'reload schema';

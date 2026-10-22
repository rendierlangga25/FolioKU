-- REVISI 10: foto sisa bar bensin + saklar RIWAYAT untuk semua user (MASTER DATA).
-- Jalankan SETELAH revisi-9. Aman dijalankan berulang. Jalankan SEKALI di Supabase > SQL Editor.

-- Foto sisa bar bensin setelah pengiriman (opsional, satu foto per pengiriman)
alter table public.trips add column if not exists foto_sisa_bbm text;

-- Pengaturan aplikasi (dikelola di MASTER DATA)
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings for select to authenticated using (true);
drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings for all to authenticated
  using (public.has_perm('master_data')) with check (public.has_perm('master_data'));
insert into public.app_settings (key, value) values ('riwayat_semua_user', 'false'::jsonb)
  on conflict (key) do nothing;

-- RIWAYAT terbuka untuk semua user aktif? (saklar di MASTER DATA)
create or replace function public.history_open() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::boolean from app_settings where key = 'riwayat_semua_user'), false)
     and exists (select 1 from profiles where id = auth.uid() and active);
$$;

-- Siapa yang boleh melihat riwayat semua driver: DEVELOPER (role owner), LEADER/SPV/ADMIN/MANAGER, atau semua user bila saklar menyala
create or replace function public.can_see_all_history() returns boolean
language sql stable security definer set search_path = public as $$
  select public.history_open() or exists (
    select 1 from profiles
    where id = auth.uid() and active
      and (role = 'owner' or user_type in ('LEADER','SPV','ADMIN','MANAGER'))
  );
$$;

-- Foto di storage ikut terbaca oleh yang boleh melihat riwayat
drop policy if exists km_photos_select on storage.objects;
create policy km_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'km-photos' and (
    public.has_perm('database_driver') or public.can_see_all_history()
    or (storage.foldername(name))[1] = auth.uid()::text));

-- Pemilik data (pembuat input) atau DEVELOPER boleh memasang/menghapus foto sisa bar bensin
create or replace function public.set_trip_sisa_bbm(p_trip uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and active) then
    raise exception 'Akun tidak aktif';
  end if;
  if p_path is not null and (storage.foldername(p_path))[1] <> auth.uid()::text then
    raise exception 'Path foto tidak valid';
  end if;
  update trips set foto_sisa_bbm = p_path
   where id = p_trip and (created_by = auth.uid() or public.is_owner());
  if not found then raise exception 'Anda tidak berhak mengubah data ini'; end if;
end $$;
revoke all on function public.set_trip_sisa_bbm(uuid, text) from public;
grant execute on function public.set_trip_sisa_bbm(uuid, text) to authenticated;

notify pgrst, 'reload schema';

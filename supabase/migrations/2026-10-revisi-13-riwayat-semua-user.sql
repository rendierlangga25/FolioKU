-- REVISI 13: RIWAYAT terbuka untuk semua user + foto sisa bar bensin oleh DRIVER / ADMIN / SPV.
-- Jalankan SETELAH revisi-12. Aman dijalankan berulang. Jalankan SEKALI di Supabase > SQL Editor.

-- Semua user aktif boleh melihat riwayat seluruh driver (data input + foto)
create or replace function public.can_see_all_history() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active);
$$;

-- Boleh mengunggah foto sisa bar bensin: owner, ADMIN, SPV, DRIVER (user_type kosong dianggap DRIVER)
create or replace function public.can_upload_sisa_bbm() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active
    and (role = 'owner' or coalesce(user_type, 'DRIVER') in ('DRIVER','ADMIN','SPV')));
$$;

drop policy if exists km_photos_insert on storage.objects;
create policy km_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'km-photos'
              and (public.has_perm('operasional_driver') or public.has_perm('loading_dock') or public.can_upload_sisa_bbm())
              and (storage.foldername(name))[1] = auth.uid()::text);

-- owner & ADMIN/SPV: semua pengiriman · DRIVER: hanya pengiriman yang dia input sendiri
create or replace function public.set_trip_sisa_bbm(p_trip uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
declare tp text;
begin
  select coalesce(user_type, 'DRIVER') into tp from profiles where id = auth.uid() and active;
  if tp is null then raise exception 'Akun tidak aktif'; end if;
  if p_path is not null and (storage.foldername(p_path))[1] <> auth.uid()::text then
    raise exception 'Path foto tidak valid';
  end if;
  update trips set foto_sisa_bbm = p_path
   where id = p_trip and (
     public.is_owner() or tp in ('ADMIN','SPV') or (tp = 'DRIVER' and created_by = auth.uid()));
  if not found then raise exception 'Anda tidak berhak mengubah data ini'; end if;
end $$;
revoke all on function public.set_trip_sisa_bbm(uuid, text) from public;
grant execute on function public.set_trip_sisa_bbm(uuid, text) to authenticated;

notify pgrst, 'reload schema';

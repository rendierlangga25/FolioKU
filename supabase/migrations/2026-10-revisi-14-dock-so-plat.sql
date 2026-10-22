-- REVISI 14: foto sisa bar bensin oleh DRIVER/LEADER/SPV/ADMIN di semua pengiriman,
-- 1 upload loading dock = banyak SO (kolom items), plat mobil loading dock internal.
-- Jalankan SETELAH revisi-13. Aman dijalankan berulang. Jalankan SEKALI di Supabase > SQL Editor.

alter table public.dock_uploads add column if not exists plat text;
alter table public.dock_uploads add column if not exists items jsonb;  -- [{so, perusahaan}, ...]

create or replace function public.can_upload_sisa_bbm() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active
    and (role = 'owner' or coalesce(user_type, 'DRIVER') in ('DRIVER','LEADER','SPV','ADMIN')));
$$;

create or replace function public.set_trip_sisa_bbm(p_trip uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_upload_sisa_bbm() then raise exception 'Anda tidak berhak mengubah foto ini'; end if;
  if p_path is not null and (storage.foldername(p_path))[1] <> auth.uid()::text then
    raise exception 'Path foto tidak valid';
  end if;
  update trips set foto_sisa_bbm = p_path where id = p_trip;
  if not found then raise exception 'Data tidak ditemukan'; end if;
end $$;
revoke all on function public.set_trip_sisa_bbm(uuid, text) from public;
grant execute on function public.set_trip_sisa_bbm(uuid, text) to authenticated;

notify pgrst, 'reload schema';

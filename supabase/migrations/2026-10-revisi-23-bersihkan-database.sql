-- REVISI 23: BERSIHKAN DATABASE (khusus developer) — catatan riwayat pembersihan.
-- Hapus/ubah data & foto sudah dibatasi RLS (hanya owner). Jalankan SEKALI di Supabase > SQL Editor. Aman diulang.

create table if not exists public.cleanup_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  by_user uuid default auth.uid() references auth.users(id) on delete set null,
  by_name text,
  kind text not null,                 -- foto_pengiriman | pengiriman | dock
  before_date date not null,          -- data sebelum tanggal ini yang dibersihkan
  rows integer not null default 0,
  photos integer not null default 0
);
alter table public.cleanup_log enable row level security;
drop policy if exists cleanup_log_owner on public.cleanup_log;
create policy cleanup_log_owner on public.cleanup_log for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Pastikan owner boleh menghapus/ubah data & file (sudah ada di instalasi lama; dibuat ulang bila belum)
drop policy if exists km_photos_delete on storage.objects;
create policy km_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'km-photos' and public.is_owner());
drop policy if exists dock_uploads_delete on public.dock_uploads;
create policy dock_uploads_delete on public.dock_uploads for delete to authenticated using (public.is_owner());

notify pgrst, 'reload schema';

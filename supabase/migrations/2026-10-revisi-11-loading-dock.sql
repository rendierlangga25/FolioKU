-- REVISI 11: menu LOADING DOCK (tab INTERNAL, EKSTERNAL, RIWAYAT) + daftar perusahaan & expedisi.
-- Jalankan SETELAH revisi-10. Aman dijalankan berulang. Jalankan SEKALI di Supabase > SQL Editor.

-- Daftar pilihan dropdown: nama perusahaan & nama expedisi (dikelola developer di MASTER DATA;
-- nama baru yang diketik user otomatis masuk, sumber = 'user'). Nama disimpan HURUF BESAR.
create table if not exists public.dock_options (
  id uuid primary key default gen_random_uuid(),
  tipe text not null check (tipe in ('perusahaan','expedisi')),
  nama text not null,
  aktif boolean not null default true,
  sumber text not null default 'owner' check (sumber in ('owner','user')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tipe, nama)
);

-- Data upload loading dock.
--  internal  → kategori reguler (no_so + perusahaan + foto) · otomotif / movestock (expedisi + perusahaan + foto)
--  eksternal → expedisi + perusahaan + tanggal + foto loading + foto surat jalan bertanda tangan
create table if not exists public.dock_uploads (
  id uuid primary key default gen_random_uuid(),
  jenis text not null check (jenis in ('internal','eksternal')),
  kategori text check (kategori in ('reguler','otomotif','movestock')),
  tanggal date not null default current_date,
  no_so text,
  perusahaan text not null,
  expedisi text,
  foto_loading text[] not null default '{}',
  foto_sj text[] not null default '{}',
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  check ((jenis = 'internal' and kategori is not null) or (jenis = 'eksternal' and kategori is null)),
  check (kategori is distinct from 'reguler' or coalesce(no_so, '') <> ''),
  check (jenis = 'internal' and kategori = 'reguler' or coalesce(expedisi, '') <> ''),
  check (array_length(foto_loading, 1) >= 1),
  check (jenis = 'internal' or array_length(foto_sj, 1) >= 1)
);
create index if not exists dock_uploads_tanggal_idx on public.dock_uploads(tanggal desc);

alter table public.dock_options enable row level security;
alter table public.dock_uploads enable row level security;

-- dock_options: semua user aktif boleh baca; pemegang izin loading_dock boleh MENAMBAH nama baru (sumber 'user');
-- ubah/hapus hanya developer / izin master_data.
drop policy if exists dock_options_read on public.dock_options;
create policy dock_options_read on public.dock_options for select to authenticated using (true);
drop policy if exists dock_options_insert on public.dock_options;
create policy dock_options_insert on public.dock_options for insert to authenticated
  with check (public.has_perm('master_data') or (public.has_perm('loading_dock') and sumber = 'user'));
drop policy if exists dock_options_update on public.dock_options;
create policy dock_options_update on public.dock_options for update to authenticated
  using (public.has_perm('master_data')) with check (public.has_perm('master_data'));
drop policy if exists dock_options_delete on public.dock_options;
create policy dock_options_delete on public.dock_options for delete to authenticated
  using (public.has_perm('master_data'));

-- dock_uploads: pemegang izin loading_dock membaca semua & menambah (atas namanya sendiri); hapus hanya developer.
drop policy if exists dock_uploads_select on public.dock_uploads;
create policy dock_uploads_select on public.dock_uploads for select to authenticated
  using (public.has_perm('loading_dock'));
drop policy if exists dock_uploads_insert on public.dock_uploads;
create policy dock_uploads_insert on public.dock_uploads for insert to authenticated
  with check (created_by = auth.uid() and public.has_perm('loading_dock'));
drop policy if exists dock_uploads_delete on public.dock_uploads;
create policy dock_uploads_delete on public.dock_uploads for delete to authenticated
  using (public.is_owner());

-- Foto loading dock memakai bucket km-photos yang sama: pemegang izin loading_dock boleh mengunggah
-- (ke folder miliknya) dan melihat foto loading dock semua orang.
drop policy if exists km_photos_insert on storage.objects;
create policy km_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'km-photos'
              and (public.has_perm('operasional_driver') or public.has_perm('loading_dock'))
              and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists km_photos_select on storage.objects;
create policy km_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'km-photos' and (
    public.has_perm('database_driver') or public.can_see_all_history() or public.has_perm('loading_dock')
    or (storage.foldername(name))[1] = auth.uid()::text));

notify pgrst, 'reload schema';

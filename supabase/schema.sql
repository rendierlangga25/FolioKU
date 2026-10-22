-- RAXER ERP — skema Supabase. Jalankan sekali di Supabase > SQL Editor.
-- User pertama yang mendaftar otomatis jadi OWNER. User berikutnya = driver tanpa akses
-- sampai owner memberi akses dari menu "USER".

create extension if not exists pgcrypto;

-- ───────── Tabel ─────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nama text,
  role text not null default 'driver' check (role in ('owner','driver')),
  active boolean not null default true,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.fuel_prices (
  jenis text primary key,
  harga numeric not null check (harga > 0)
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  nama text not null,            -- jenis mobil, mis. DUTRO
  plat text not null unique,     -- mis. B 9075 PCR
  bbm_jenis text not null references public.fuel_prices(jenis) on update cascade,
  aktif boolean not null default true,
  created_at timestamptz not null default now()
);

-- Daftar tujuan untuk dropdown form driver. Owner menambah/rapikan; tujuan baru yang diketik driver
-- masuk otomatis (sumber = 'driver'). Nama disimpan HURUF BESAR agar tidak dobel.
create table if not exists public.destinations (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  aktif boolean not null default true,
  sumber text not null default 'owner' check (sumber in ('owner','driver')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null,
  vehicle_id uuid not null references public.vehicles(id),
  driver1_id uuid not null references public.drivers(id),
  driver2_id uuid references public.drivers(id),
  tujuan text[] not null check (array_length(tujuan,1) >= 1),
  bbm_rp numeric not null check (bbm_rp > 0),
  tol_rp numeric not null default 0,
  parkir_rp numeric not null default 0,
  parkir_cash_rp numeric not null default 0,
  kuli_bongkar_rp numeric not null default 0,
  security_rp numeric not null default 0,
  total_rp numeric not null,
  kartu4 text not null check (kartu4 ~ '^[0-9]{4}$'),
  km_awal numeric not null,
  km_isi numeric not null,
  km_akhir numeric not null check (km_akhir >= km_awal),
  foto_path text,                              -- foto KM awal
  foto_km_isi text,                            -- foto KM saat isi BBM
  foto_km_akhir text,                          -- foto KM akhir
  foto_serah_terima text[] not null default '{}',  -- bukti serah terima ke customer
  foto_surat_jalan text[] not null default '{}',   -- surat jalan yang sudah ditandatangani
  foto_kendala text[] not null default '{}',       -- (opsional) foto kendala pengiriman
  kendala_ket text,                                -- (opsional) keterangan kendala
  harga_liter numeric not null,   -- harga/liter saat input (snapshot)
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  check (driver2_id is null or driver2_id <> driver1_id)
);
create index if not exists trips_tanggal_idx on public.trips(tanggal desc);
create index if not exists trips_creator_idx on public.trips(created_by);

-- ───────── Fungsi bantu ─────────
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'owner' and active);
$$;

create or replace function public.has_perm(k text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_owner() or exists (
    select 1 from profiles
    where id = auth.uid() and active
      and coalesce((permissions ->> k)::boolean, false)
  );
$$;

-- User pertama = owner
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, nama, role, permissions)
  values (
    new.id, new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'nama',''), split_part(new.email,'@',1)),
    case when exists (select 1 from profiles) then 'driver' else 'owner' end,
    '{}'::jsonb
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────── Row Level Security ─────────
alter table public.profiles    enable row level security;
alter table public.drivers     enable row level security;
alter table public.fuel_prices enable row level security;
alter table public.vehicles    enable row level security;
alter table public.destinations enable row level security;
alter table public.trips       enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_owner());
drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
drop policy if exists profiles_owner_delete on public.profiles;
create policy profiles_owner_delete on public.profiles for delete to authenticated
  using (public.is_owner() and id <> auth.uid());

-- data master: semua user aktif boleh baca, hanya owner / izin master_data boleh ubah
do $$
declare t text;
begin
  foreach t in array array['drivers','fuel_prices','vehicles'] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format('create policy %I_write on public.%I for all to authenticated using (public.has_perm(''master_data'')) with check (public.has_perm(''master_data''))', t, t);
  end loop;
end $$;

-- destinations: semua user aktif boleh baca; driver (izin operasional_driver) boleh MENAMBAH tujuan baru;
-- hanya owner / izin master_data yang boleh mengubah & menghapus
drop policy if exists destinations_read on public.destinations;
create policy destinations_read on public.destinations for select to authenticated using (true);
drop policy if exists destinations_insert on public.destinations;
create policy destinations_insert on public.destinations for insert to authenticated
  with check (public.has_perm('master_data') or (public.has_perm('operasional_driver') and sumber = 'driver'));
drop policy if exists destinations_update on public.destinations;
create policy destinations_update on public.destinations for update to authenticated
  using (public.has_perm('master_data')) with check (public.has_perm('master_data'));
drop policy if exists destinations_delete on public.destinations;
create policy destinations_delete on public.destinations for delete to authenticated
  using (public.has_perm('master_data'));

-- trips
drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips for select to authenticated using (
  public.has_perm('database_driver')
  or public.has_perm('biaya_logistic')
  or (created_by = auth.uid() and public.has_perm('riwayat_saya'))
);
drop policy if exists trips_insert on public.trips;
create policy trips_insert on public.trips for insert to authenticated
  with check (created_by = auth.uid() and public.has_perm('operasional_driver'));
drop policy if exists trips_update on public.trips;
create policy trips_update on public.trips for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
drop policy if exists trips_delete on public.trips;
create policy trips_delete on public.trips for delete to authenticated
  using (public.is_owner());

-- ───────── Storage foto KM (private) ─────────
insert into storage.buckets (id, name, public) values ('km-photos', 'km-photos', false)
  on conflict (id) do nothing;

drop policy if exists km_photos_insert on storage.objects;
create policy km_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'km-photos' and public.has_perm('operasional_driver')
              and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists km_photos_select on storage.objects;
create policy km_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'km-photos' and (
    public.has_perm('database_driver') or (storage.foldername(name))[1] = auth.uid()::text));
drop policy if exists km_photos_delete on storage.objects;
create policy km_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'km-photos' and public.is_owner());

-- ───────── Data awal (boleh diubah owner dari aplikasi) ─────────
insert into public.fuel_prices (jenis, harga) values ('Pertalite', 10000), ('Solar', 6800)
  on conflict (jenis) do nothing;

insert into public.drivers (nama)
select n from unnest(array['DICKY','AHYAR','RANTA','ARIF','CEPI','IRFAN']) n
where not exists (select 1 from public.drivers);

insert into public.vehicles (nama, plat, bbm_jenis) values
  ('DUTRO',      'B 9073 PCR', 'Solar'),
  ('DUTRO',      'B 9075 PCR', 'Solar'),
  ('RANGER',     'B 9262 PCR', 'Solar'),
  ('RANGER',     'B 9392 PCS', 'Solar'),
  ('DYNA',       'B 9561 PCF', 'Solar'),
  ('MITSUBISHI', 'B 9481 PXE', 'Solar'),
  ('SUZUKI CARRY','B 1996 PZQ','Pertalite'),
  ('GRANDMAX',   'B 9522 PCJ', 'Pertalite'),
  ('GRANDMAX',   'B 9636 PCJ', 'Pertalite')
on conflict (plat) do nothing;

insert into public.destinations (nama, sumber)
select n, 'owner' from unnest(array['ADM SUNTER','JKM ROXY','MAP SUDIRMAN','MOVESTOCK DEPO']) n
on conflict (nama) do nothing;


-- ───────── REVISI 4: profil driver, XP/tier, peringkat ─────────
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


-- ───────── REVISI 5 (instalasi baru: sudah termasuk di sini) ─────────
-- 1) Jenis user. Akun lama otomatis = DRIVER (owner tidak memakai kolom ini).
alter table public.profiles add column if not exists user_type text not null default 'DRIVER';
alter table public.profiles drop constraint if exists profiles_user_type_check;
alter table public.profiles add constraint profiles_user_type_check check (user_type in ('DRIVER','LEADER','SPV','ADMIN','MANAGER'));

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


-- ───────── REVISI 9 (instalasi baru: sudah termasuk di sini) ─────────
-- RIWAYAT seluruh driver untuk OWNER / LEADER / SPV / ADMIN / MANAGER.
create or replace function public.can_see_all_history() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and active
      and (role = 'owner' or user_type in ('LEADER','SPV','ADMIN','MANAGER'))
  );
$$;
drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips for select to authenticated using (
  public.has_perm('database_driver')
  or public.has_perm('biaya_logistic')
  or public.can_see_all_history()
  or (created_by = auth.uid() and public.has_perm('riwayat_saya'))
);
notify pgrst, 'reload schema';


-- ───────── REVISI 10 (instalasi baru: sudah termasuk di sini) ─────────
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
insert into public.app_settings (key, value) values ('riwayat_user_ids', '[]'::jsonb)
  on conflict (key) do nothing;

-- User yang dipilih developer (MASTER DATA > AKSES RIWAYAT SEMUA DRIVER) boleh melihat riwayat semua driver
create or replace function public.history_open() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active)
     and coalesce((select value ? auth.uid()::text from app_settings where key = 'riwayat_user_ids'), false);
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


-- ───────── REVISI 11: LOADING DOCK (instalasi baru: sudah termasuk di sini) ─────────
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


-- ───────── REVISI 13 (instalasi baru: sudah termasuk di sini) ─────────

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


-- ───────── REVISI 14 (instalasi baru: sudah termasuk di sini) ─────────

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


-- ───────── REVISI 15 (instalasi baru: sudah termasuk di sini) ─────────
-- hapus aturan lama "expedisi wajib" untuk semua jenis, ganti: expedisi hanya wajib untuk EKSTERNAL
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.dock_uploads'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%expedisi%'
  loop execute format('alter table public.dock_uploads drop constraint %I', c.conname); end loop;
end $$;
alter table public.dock_uploads add constraint dock_uploads_expedisi_ck check (jenis = 'internal' or coalesce(expedisi, '') <> '');

notify pgrst, 'reload schema';

-- ───────── REVISI 16: REPORT LOGISTIC (penggunaan penyimpanan) ─────────
-- 1) Penggunaan saat ini: ukuran database, ukuran & jumlah foto, tabel terbesar, pertambahan foto per bulan, batas yang diset.
create or replace function public.storage_usage() returns jsonb
language plpgsql stable security definer set search_path = public, storage as $$
declare r jsonb; tabs jsonb := '[]'::jsonb; rec record; n bigint;
begin
  if not public.is_owner() then raise exception 'Hanya developer/owner yang boleh melihat penggunaan penyimpanan'; end if;
  -- jumlah baris dihitung eksak (perkiraan reltuples bernilai 0 untuk tabel yang belum pernah di-analyze)
  for rec in
    select c.relname, pg_total_relation_size(c.oid) as bytes
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relkind = 'r' order by 2 desc
  loop
    execute format('select count(*) from public.%I', rec.relname) into n;
    tabs := tabs || jsonb_build_object('name', rec.relname, 'bytes', rec.bytes, 'rows', n);
  end loop;
  select jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'storage_bytes', coalesce((select sum((metadata ->> 'size')::bigint) from storage.objects where bucket_id = 'km-photos'), 0),
    'photo_count', (select count(*) from storage.objects where bucket_id = 'km-photos'),
    'tables', tabs,
    'monthly', (select coalesce(jsonb_agg(m order by m.ym), '[]'::jsonb) from (
                  select to_char(created_at, 'YYYY-MM') as ym, count(*) as files, coalesce(sum((metadata ->> 'size')::bigint), 0) as bytes
                  from storage.objects where bucket_id = 'km-photos' and created_at >= date_trunc('month', now()) - interval '11 months' group by 1) m),
    'limits', coalesce((select value from app_settings where key = 'storage_limits'), 'null'::jsonb),
    'checked_at', now()
  ) into r;
  return r;
end $$;
revoke all on function public.storage_usage() from public;
grant execute on function public.storage_usage() to authenticated;

-- 2) Batas paket & ambang peringatan (hanya owner). Default = paket gratis Supabase: 500 MB database, 1 GB file.
--    Setelah upgrade (mis. Pro: 8 GB / 100 GB) ubah angkanya di halaman REPORT LOGISTIC.
create or replace function public.set_storage_limits(p_db_mb numeric, p_storage_mb numeric, p_warn integer, p_crit integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'Hanya developer/owner yang boleh mengubah batas penyimpanan'; end if;
  if p_db_mb < 50 or p_storage_mb < 50 then raise exception 'Batas minimal 50 MB'; end if;
  if p_warn < 50 or p_warn > 98 or p_crit <= p_warn or p_crit > 100 then raise exception 'Ambang tidak valid (peringatan 50–98%%, kritis di atasnya sampai 100%%)'; end if;
  insert into app_settings (key, value, updated_at)
  values ('storage_limits', jsonb_build_object('db_mb', p_db_mb, 'storage_mb', p_storage_mb, 'warn_pct', p_warn, 'crit_pct', p_crit), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;
revoke all on function public.set_storage_limits(numeric, numeric, integer, integer) from public;
grant execute on function public.set_storage_limits(numeric, numeric, integer, integer) to authenticated;

notify pgrst, 'reload schema';

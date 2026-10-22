-- MIGRASI — jalankan SEKALI di Supabase > SQL Editor bila database SUDAH berjalan (bukan instalasi baru).
-- Instalasi baru cukup menjalankan schema.sql. Aman dijalankan ulang (idempoten); data lama tidak berubah.
--
-- Isi: foto KM isi & KM akhir, bukti serah terima, surat jalan, kendala (opsional), dan daftar tujuan (dropdown).

-- 1) Kolom baru di tabel trips
alter table public.trips add column if not exists foto_km_isi text;
alter table public.trips add column if not exists foto_km_akhir text;
alter table public.trips add column if not exists foto_serah_terima text[] not null default '{}';
alter table public.trips add column if not exists foto_surat_jalan text[] not null default '{}';
alter table public.trips add column if not exists foto_kendala text[] not null default '{}';
alter table public.trips add column if not exists kendala_ket text;
-- foto_path (yang sudah ada) sekarang = foto KM awal.

-- 2) Daftar tujuan
create table if not exists public.destinations (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  aktif boolean not null default true,
  sumber text not null default 'owner' check (sumber in ('owner','driver')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.destinations enable row level security;

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

-- 3) Isi awal daftar tujuan dari tujuan yang sudah pernah diinput driver (sekali jalan)
insert into public.destinations (nama, sumber)
select distinct upper(btrim(regexp_replace(t, '\s+', ' ', 'g'))), 'owner'
from public.trips, unnest(tujuan) as t
where btrim(t) <> ''
on conflict (nama) do nothing;

-- 4) Biaya tambahan: parkir cash, kuli bongkar, security (opsional, default 0 — data lama tidak berubah)
alter table public.trips add column if not exists parkir_cash_rp numeric not null default 0;
alter table public.trips add column if not exists kuli_bongkar_rp numeric not null default 0;
alter table public.trips add column if not exists security_rp numeric not null default 0;

-- 5) Menu baru LOGISTIC › BIAYA LOGISTIC: pengguna dengan izin 'biaya_logistic' boleh MEMBACA data perjalanan
--    (owner mengaktifkannya per pengguna di menu Pengguna & Akses).
drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips for select to authenticated using (
  public.has_perm('database_driver')
  or public.has_perm('biaya_logistic')
  or (created_by = auth.uid() and public.has_perm('riwayat_saya'))
);

-- Muat ulang struktur tabel di API Supabase agar kolom/izin baru langsung terbaca
notify pgrst, 'reload schema';

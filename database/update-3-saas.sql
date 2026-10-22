-- =====================================================================
-- UPDATE 3 (SaaS / Langganan)  --  Jalankan SEKALI di Supabase > SQL Editor
-- Prasyarat: schema.sql dan update-2.sql sudah pernah dijalankan.
-- Isi: multi-pengguna (owner_id), username, paket langganan, pesanan,
--      keamanan (RLS) per pengguna, storage per pengguna, fungsi owner.
-- Data portofolio lama kamu otomatis menjadi milik akun admin (username: rendi).
-- =====================================================================
create extension if not exists pgcrypto;

-- 1. Kolom pemilik di semua tabel konten -------------------------------
do $$ declare t text; begin
  foreach t in array array['profiles','site_settings','experiences','projects','project_images','skill_categories','skills','education','social_links','certificates','contact_messages'] loop
    execute format('alter table %I add column if not exists owner_id uuid references auth.users(id) on delete cascade default auth.uid()', t);
    execute format('create index if not exists %I on %I(owner_id)', t||'_owner_idx', t);
  end loop;
end $$;
alter table profiles add column if not exists username text;

-- 2. Pindahkan data lama ke akun admin --------------------------------
do $$ declare a uuid; t text; begin
  select user_id into a from admin_users limit 1;
  if a is not null then
    foreach t in array array['profiles','site_settings','experiences','projects','project_images','skill_categories','skills','education','social_links','certificates','contact_messages'] loop
      execute format('update %I set owner_id = $1 where owner_id is null', t) using a;
    end loop;
    update profiles set username = 'rendi' where owner_id = a and username is null;
  end if;
end $$;

create unique index if not exists profiles_username_key on profiles(lower(username)) where username is not null;
create unique index if not exists profiles_owner_key on profiles(owner_id) where owner_id is not null;
create unique index if not exists site_settings_owner_key on site_settings(owner_id) where owner_id is not null;

-- 3. Tabel baru -----------------------------------------------------------
create table if not exists plans (
  id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), updated_at timestamptz default now(),
  code text unique, name text not null, description text,
  duration_months int,            -- KOSONG = Lifetime
  price bigint not null default 0, original_price bigint, features text,
  is_popular boolean default false, active boolean default true, sort_order int default 0);

create table if not exists app_settings (
  id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), updated_at timestamptz default now(),
  brand_name text default 'FolioKu', tagline text, hero_title text, hero_subtitle text,
  support_whatsapp text, support_email text, sample_username text, announcement text);

create table if not exists subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id uuid, plan_name text, is_lifetime boolean default false,
  started_at timestamptz default now(), expires_at timestamptz, updated_at timestamptz default now());

create table if not exists orders (
  id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), updated_at timestamptz default now(),
  order_id text unique not null, user_id uuid references auth.users(id) on delete cascade,
  plan_id uuid, plan_name text, amount bigint not null,
  status text not null default 'pending',  -- pending | paid | failed | expired | refunded
  payment_type text, snap_token text, redirect_url text, paid_at timestamptz);
create index if not exists orders_user_idx on orders(user_id, created_at desc);

-- 4. Fungsi bantu ---------------------------------------------------------
create or replace function has_access(uid uuid) returns boolean language sql security definer stable set search_path = public as $$
  select uid is not null and (
    exists (select 1 from admin_users where user_id = uid)
    or exists (select 1 from subscriptions s where s.user_id = uid and (s.is_lifetime or s.expires_at > now())))
$$;

create or replace function username_available(p text) returns boolean language sql security definer stable set search_path = public as $$
  select p ~ '^[a-z0-9][a-z0-9-]{2,29}$'
    and p not in ('admin','app','owner','api','u','demo','masuk','daftar','reset','syarat','privasi','harga','login','signup','www','support','help','blog','static','assets')
    and not exists (select 1 from profiles where lower(username) = lower(p))
$$;
grant execute on function username_available(text) to anon, authenticated;

create or replace function claim_username(p_username text, p_name text) returns text language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); n text := lower(trim(p_username)); nm text := coalesce(nullif(trim(p_name), ''), n); cur text;
begin
  if u is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  select username into cur from profiles where owner_id = u;
  if cur is not null then return cur; end if;
  if n !~ '^[a-z0-9][a-z0-9-]{2,29}$' then raise exception 'Username 3-30 karakter: huruf kecil, angka, dan tanda minus'; end if;
  if not username_available(n) then raise exception 'Username sudah dipakai, coba yang lain'; end if;
  insert into profiles (owner_id, username, name, headline, hero_title, hero_subtitle, bio, contact_title, stats)
    values (u, n, nm, 'Tulis headline singkat kamu di sini', 'Halo, saya ' || nm || '.',
      'Ceritakan dirimu dalam satu atau dua kalimat. Ubah teks ini lewat menu Profile.',
      'Tulis biografi singkat kamu di menu About.', 'Mari bekerja sama.', '[]')
    on conflict (owner_id) where owner_id is not null do update set username = excluded.username;
  insert into site_settings (owner_id, site_title, meta_description, logo_text, footer_text)
    values (u, nm || ' | Portofolio', 'Portofolio online ' || nm, upper(left(nm, 2)), '© ' || extract(year from now())::int || ' ' || nm)
    on conflict (owner_id) where owner_id is not null do nothing;
  return n;
end $$;
grant execute on function claim_username(text, text) to authenticated;

create or replace function admin_list_users() returns table (id uuid, email text, created_at timestamptz, username text, plan_name text, expires_at timestamptz, is_lifetime boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from admin_users where user_id = auth.uid()) then raise exception 'Hanya owner'; end if;
  return query select u.id, u.email::text, u.created_at, p.username, s.plan_name, s.expires_at, coalesce(s.is_lifetime, false)
    from auth.users u left join profiles p on p.owner_id = u.id left join subscriptions s on s.user_id = u.id
    order by u.created_at desc limit 500;
end $$;
grant execute on function admin_list_users() to authenticated;

create or replace function admin_stats() returns json language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from admin_users where user_id = auth.uid()) then raise exception 'Hanya owner'; end if;
  return json_build_object(
    'users', (select count(*) from auth.users),
    'active', (select count(*) from subscriptions where is_lifetime or expires_at > now()),
    'orders_paid', (select count(*) from orders where status = 'paid'),
    'revenue', coalesce((select sum(amount) from orders where status = 'paid'), 0),
    'revenue_30d', coalesce((select sum(amount) from orders where status = 'paid' and paid_at > now() - interval '30 days'), 0));
end $$;
grant execute on function admin_stats() to authenticated;

-- 5. Keamanan (RLS) ----------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['profiles','site_settings','experiences','projects','project_images','skill_categories','skills','education','social_links','certificates'] loop
    execute format('drop policy if exists "admin penuh" on %I', t);
    execute format('drop policy if exists "publik baca" on %I', t);
    execute format('drop policy if exists "publik baca terpublikasi" on %I', t);
    execute format('drop policy if exists "pemilik kelola" on %I', t);
    execute format('drop policy if exists "pemilik baca" on %I', t);
    execute format('create policy "pemilik kelola" on %I for all to authenticated using (owner_id = auth.uid() and has_access(auth.uid())) with check (owner_id = auth.uid() and has_access(auth.uid()))', t);
    execute format('create policy "pemilik baca" on %I for select to authenticated using (owner_id = auth.uid())', t);
  end loop;
  foreach t in array array['profiles','site_settings','project_images','skill_categories','skills'] loop
    execute format('create policy "publik baca" on %I for select using (has_access(owner_id))', t);
  end loop;
  foreach t in array array['experiences','projects','education','social_links','certificates'] loop
    execute format('create policy "publik baca terpublikasi" on %I for select using (published and has_access(owner_id))', t);
  end loop;
end $$;

-- Pesan kontak: pengunjung mengirim ke pemilik portofolio, pemilik membaca
drop policy if exists "admin penuh" on contact_messages;
drop policy if exists "publik kirim pesan" on contact_messages;
drop policy if exists "pemilik kelola pesan" on contact_messages;
create policy "pemilik kelola pesan" on contact_messages for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "publik kirim pesan" on contact_messages for insert to anon, authenticated
  with check (owner_id is not null and has_access(owner_id) and char_length(message) between 1 and 2000 and char_length(name) <= 100 and char_length(email) <= 200);

-- Paket, pengaturan aplikasi, langganan, pesanan
alter table plans enable row level security;
alter table app_settings enable row level security;
alter table subscriptions enable row level security;
alter table orders enable row level security;
drop policy if exists "publik baca paket" on plans; drop policy if exists "admin penuh" on plans;
create policy "publik baca paket" on plans for select using (active);
create policy "admin penuh" on plans for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "publik baca" on app_settings; drop policy if exists "admin penuh" on app_settings;
create policy "publik baca" on app_settings for select using (true);
create policy "admin penuh" on app_settings for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "baca sendiri" on subscriptions; drop policy if exists "admin penuh" on subscriptions;
create policy "baca sendiri" on subscriptions for select to authenticated using (user_id = auth.uid());
create policy "admin penuh" on subscriptions for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "baca sendiri" on orders; drop policy if exists "admin penuh" on orders;
create policy "baca sendiri" on orders for select to authenticated using (user_id = auth.uid());
create policy "admin penuh" on orders for all to authenticated using (is_admin()) with check (is_admin());
-- (Penulisan langganan & pesanan dari pembayaran dilakukan server via service role, bukan dari browser.)

do $$ declare t text; begin
  foreach t in array array['plans','app_settings','subscriptions','orders'] loop
    execute format('drop trigger if exists set_updated on %I', t);
    execute format('create trigger set_updated before update on %I for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- 6. Storage: tiap pengguna hanya boleh mengelola folder miliknya ({user_id}/...)
drop policy if exists "media pemilik kelola" on storage.objects;
create policy "media pemilik kelola" on storage.objects for all to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text and has_access(auth.uid()))
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text and has_access(auth.uid()));

-- 7. Data awal paket & pengaturan (HARGA CONTOH - ubah lewat menu Owner > Paket)
insert into plans (code, name, description, duration_months, price, original_price, features, is_popular, sort_order) values
 ('3-bulan', '3 Bulan', 'Pas untuk melamar kerja atau magang dalam waktu dekat.', 3, 99000, 149000,
  E'Link portofolio pribadi (/u/namakamu)\nProyek, sertifikat & skill tanpa batas\nUpload foto, galeri & CV\nPesan dari pengunjung masuk ke dashboard\nUbah warna & tampilan sesuka hati\nSEO & pratinjau saat dibagikan', false, 1),
 ('1-tahun', '1 Tahun', 'Paling banyak dipilih. Hemat dan tenang sepanjang tahun.', 12, 249000, 396000,
  E'Semua fitur paket 3 Bulan\nHemat lebih dari 35%\nPerpanjang kapan saja, masa aktif ditambahkan\nPrioritas bantuan via WhatsApp', true, 2),
 ('lifetime', 'Lifetime', 'Bayar sekali, portofolio aktif selamanya.', null, 499000, 899000,
  E'Semua fitur paket 1 Tahun\nTanpa biaya perpanjangan\nAkses semua pembaruan fitur\nPrioritas bantuan via WhatsApp', false, 3)
on conflict (code) do nothing;

insert into app_settings (brand_name, tagline, hero_title, hero_subtitle, support_whatsapp, support_email, sample_username)
select 'FolioKu', 'Portofolio online profesional', 'Portofolio online yang bikin kamu dilirik, jadi dalam 10 menit.',
  'Tanpa coding. Isi data, upload karya, dapatkan link portofolio yang rapi dan siap dibagikan ke HRD, klien, atau dosen.', '', '', 'rendi'
where not exists (select 1 from app_settings);

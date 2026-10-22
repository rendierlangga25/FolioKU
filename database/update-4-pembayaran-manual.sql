-- =====================================================================
-- UPDATE 4 (Pembayaran manual: QRIS, e-wallet, bank)  --  Jalankan SEKALI
-- Prasyarat: update-3-saas.sql sudah dijalankan.
-- Tidak memerlukan payment gateway. Pelanggan transfer/scan QRIS, upload bukti,
-- lalu owner menyetujui di /owner/orders.
-- =====================================================================

-- 1. Akun pembayaran yang diatur owner
create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), updated_at timestamptz default now(),
  type text not null default 'bank',   -- qris | ewallet | bank
  label text not null,                 -- contoh: QRIS, GoPay, BCA
  account_name text, account_number text, image_url text, instructions text,
  active boolean default true, sort_order int default 0);
alter table payment_methods enable row level security;
drop policy if exists "publik baca aktif" on payment_methods; drop policy if exists "admin penuh" on payment_methods;
create policy "publik baca aktif" on payment_methods for select using (active);
create policy "admin penuh" on payment_methods for all to authenticated using (is_admin()) with check (is_admin());
drop trigger if exists set_updated on payment_methods;
create trigger set_updated before update on payment_methods for each row execute function set_updated_at();

-- contoh awal (NONAKTIF; isi datanya lalu aktifkan di Owner > Metode Pembayaran)
insert into payment_methods (type, label, account_name, account_number, instructions, active, sort_order)
select * from (values
  ('qris','QRIS','', '', 'Scan QRIS dengan aplikasi e-wallet atau m-banking, lalu masukkan nominal sesuai total pembayaran.', false, 1),
  ('ewallet','GoPay','', '', 'Kirim ke nomor GoPay di atas sesuai total pembayaran.', false, 2),
  ('bank','BCA','', '', 'Transfer sesuai total pembayaran (termasuk 3 digit kode unik).', false, 3)
) v(type,label,account_name,account_number,instructions,active,sort_order)
where not exists (select 1 from payment_methods);

-- 2. Kolom tambahan
alter table orders add column if not exists base_amount bigint, add column if not exists unique_code int default 0,
  add column if not exists method_id uuid, add column if not exists method_label text, add column if not exists proof_path text, add column if not exists note text;
alter table app_settings add column if not exists verify_time text default 'maksimal 1x24 jam';
update app_settings set verify_time = 'maksimal 1x24 jam' where verify_time is null;
-- status pesanan: pending (menunggu bayar) | review (bukti dikirim) | paid | rejected | cancelled

-- 3. Bukti pembayaran (bucket privat)
insert into storage.buckets (id, name, public) values ('proofs', 'proofs', false) on conflict do nothing;
drop policy if exists "bukti unggah sendiri" on storage.objects; drop policy if exists "bukti baca" on storage.objects;
create policy "bukti unggah sendiri" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "bukti baca" on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));

-- 4. Fungsi (semua penulisan pesanan lewat sini, bukan langsung dari browser)
create or replace function create_order(p_plan_id uuid) returns json language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); pl plans%rowtype; o orders%rowtype; code int; tries int := 0; oid text;
begin
  if u is null then raise exception 'Silakan masuk terlebih dahulu'; end if;
  select * into pl from plans where id = p_plan_id and active;
  if not found then raise exception 'Paket tidak ditemukan'; end if;
  if pl.price < 1000 then raise exception 'Harga paket belum valid. Hubungi admin.'; end if;
  if exists (select 1 from subscriptions where user_id = u and is_lifetime) then raise exception 'Akun kamu sudah Lifetime, tidak perlu membeli lagi.'; end if;
  select * into o from orders where user_id = u and plan_id = pl.id and status = 'pending' and created_at > now() - interval '3 days' order by created_at desc limit 1;
  if found then return row_to_json(o); end if;
  loop
    code := 11 + floor(random() * 889)::int;
    exit when not exists (select 1 from orders where status in ('pending','review') and created_at > now() - interval '3 days' and amount = pl.price + code);
    tries := tries + 1; if tries > 60 then code := 0; exit; end if;
  end loop;
  oid := 'INV-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
  insert into orders (order_id, user_id, plan_id, plan_name, amount, base_amount, unique_code, status)
    values (oid, u, pl.id, pl.name, pl.price + code, pl.price, code, 'pending') returning * into o;
  return row_to_json(o);
end $$;
grant execute on function create_order(uuid) to authenticated;

create or replace function submit_proof(p_order text, p_method uuid, p_path text) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_path is null or split_part(p_path, '/', 1) <> auth.uid()::text then raise exception 'Berkas bukti tidak valid'; end if;
  update orders set proof_path = p_path, method_id = p_method, status = 'review', note = null,
      method_label = (select label from payment_methods where id = p_method)
    where order_id = p_order and user_id = auth.uid() and status in ('pending','review','rejected');
  if not found then raise exception 'Pesanan tidak ditemukan atau sudah selesai'; end if;
end $$;
grant execute on function submit_proof(text, uuid, text) to authenticated;

create or replace function cancel_order(p_order text) returns void language plpgsql security definer set search_path = public as $$
begin
  update orders set status = 'cancelled' where order_id = p_order and user_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Pesanan tidak bisa dibatalkan'; end if;
end $$;
grant execute on function cancel_order(text) to authenticated;

create or replace function admin_approve_order(p_order text) returns void language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; pl plans%rowtype; s subscriptions%rowtype; base timestamptz;
begin
  if not exists (select 1 from admin_users where user_id = auth.uid()) then raise exception 'Hanya owner'; end if;
  select * into o from orders where order_id = p_order for update;
  if not found then raise exception 'Pesanan tidak ditemukan'; end if;
  if o.status = 'paid' then return; end if;
  select * into pl from plans where id = o.plan_id;
  if not found then raise exception 'Paket pesanan ini sudah dihapus'; end if;
  update orders set status = 'paid', paid_at = now(), note = null where id = o.id;
  select * into s from subscriptions where user_id = o.user_id;
  if pl.duration_months is null then
    insert into subscriptions (user_id, plan_id, plan_name, is_lifetime, expires_at) values (o.user_id, pl.id, pl.name, true, null)
      on conflict (user_id) do update set plan_id = excluded.plan_id, plan_name = excluded.plan_name, is_lifetime = true, expires_at = null;
  elsif coalesce(s.is_lifetime, false) then
    null;
  else
    base := case when s.expires_at is not null and s.expires_at > now() then s.expires_at else now() end;
    insert into subscriptions (user_id, plan_id, plan_name, is_lifetime, expires_at) values (o.user_id, pl.id, pl.name, false, base + make_interval(months => pl.duration_months))
      on conflict (user_id) do update set plan_id = excluded.plan_id, plan_name = excluded.plan_name, is_lifetime = false, expires_at = excluded.expires_at;
  end if;
end $$;
grant execute on function admin_approve_order(text) to authenticated;

create or replace function admin_reject_order(p_order text, p_note text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from admin_users where user_id = auth.uid()) then raise exception 'Hanya owner'; end if;
  update orders set status = 'rejected', note = nullif(trim(p_note), '') where order_id = p_order and status in ('pending','review');
  if not found then raise exception 'Pesanan tidak bisa ditolak'; end if;
end $$;
grant execute on function admin_reject_order(text, text) to authenticated;

create or replace function admin_stats() returns json language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from admin_users where user_id = auth.uid()) then raise exception 'Hanya owner'; end if;
  return json_build_object(
    'users', (select count(*) from auth.users),
    'active', (select count(*) from subscriptions where is_lifetime or expires_at > now()),
    'orders_paid', (select count(*) from orders where status = 'paid'),
    'to_review', (select count(*) from orders where status = 'review'),
    'revenue', coalesce((select sum(coalesce(base_amount, amount)) from orders where status = 'paid'), 0),
    'revenue_30d', coalesce((select sum(coalesce(base_amount, amount)) from orders where status = 'paid' and paid_at > now() - interval '30 days'), 0));
end $$;

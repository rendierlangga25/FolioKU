-- =====================================================================
-- UPDATE 5 (Balas pesan + Ringkasan Owner)  --  Jalankan SEKALI di Supabase > SQL Editor
-- Prasyarat: update-3-saas.sql dan update-4-pembayaran-manual.sql sudah dijalankan.
-- Aman dijalankan ulang (tidak menghapus data).
-- Isi:
--   1. Kolom riwayat balasan di pesan kontak (replied_at, reply_text)
--   2. Fungsi admin_overview(): data grafik & statistik untuk Panel Owner
-- =====================================================================

-- 1. Riwayat balasan pesan ------------------------------------------------
alter table contact_messages add column if not exists replied_at timestamptz;
alter table contact_messages add column if not exists reply_text text;

-- 2. Ringkasan Owner ------------------------------------------------------
-- p_days: 7, 30, 90 (grafik harian) atau 365 (grafik 12 bulan terakhir).
-- Semua tanggal dihitung dengan zona waktu Asia/Jakarta.
-- Pendapatan = harga paket (tanpa kode unik), konsisten dengan admin_stats().
create or replace function admin_overview(p_days int default 30) returns json
language plpgsql security definer set search_path = public as $$
declare
  tz constant text := 'Asia/Jakarta';
  d int := least(greatest(coalesce(p_days, 30), 7), 365);
  monthly boolean := (least(greatest(coalesce(p_days, 30), 7), 365) >= 365);
  today date := (now() at time zone 'Asia/Jakarta')::date;
  c_from date;
  len int;
  p_to date;
  p_from date;
  res json;
begin
  if not exists (select 1 from admin_users where user_id = auth.uid()) then
    raise exception 'Hanya owner';
  end if;

  if monthly then
    c_from := (date_trunc('month', today::timestamp) - interval '11 months')::date;
  else
    c_from := today - (d - 1);
  end if;
  len := today - c_from + 1;
  p_to := c_from - 1;
  p_from := c_from - len;

  with
  paid as (
    select o.user_id,
           coalesce(o.base_amount, o.amount)::bigint as amt,
           o.plan_name,
           o.method_label,
           (coalesce(o.paid_at, o.created_at) at time zone tz)::date as day
    from orders o
    where o.status = 'paid'
  ),
  firstpaid as (
    select user_id, min(day) as day from paid where user_id is not null group by user_id
  ),
  su as (
    select u.id, u.email::text as email, (u.created_at at time zone tz)::date as day, u.created_at
    from auth.users u
  ),
  buckets as (
    select g::date as b
    from generate_series(
      c_from::timestamp,
      today::timestamp,
      case when monthly then interval '1 month' else interval '1 day' end
    ) g
  ),
  series as (
    select b.b as bucket,
      coalesce((select sum(p.amt) from paid p where (case when monthly then date_trunc('month', p.day::timestamp)::date else p.day end) = b.b), 0) as revenue,
      (select count(*) from paid p where (case when monthly then date_trunc('month', p.day::timestamp)::date else p.day end) = b.b) as orders,
      (select count(*) from su s where (case when monthly then date_trunc('month', s.day::timestamp)::date else s.day end) = b.b) as signups,
      (select count(*) from firstpaid f where (case when monthly then date_trunc('month', f.day::timestamp)::date else f.day end) = b.b) as customers
    from buckets b
  )
  select json_build_object(
    'days', d,
    'monthly', monthly,
    'from', c_from,
    'to', today,
    'kpi', json_build_object(
      'users',              (select count(*) from su),
      'signups',            (select count(*) from su where day between c_from and today),
      'signups_prev',       (select count(*) from su where day between p_from and p_to),
      'revenue',            (select coalesce(sum(amt), 0) from paid where day between c_from and today),
      'revenue_prev',       (select coalesce(sum(amt), 0) from paid where day between p_from and p_to),
      'revenue_total',      (select coalesce(sum(amt), 0) from paid),
      'orders',             (select count(*) from paid where day between c_from and today),
      'orders_prev',        (select count(*) from paid where day between p_from and p_to),
      'customers_new',      (select count(*) from firstpaid where day between c_from and today),
      'customers_new_prev', (select count(*) from firstpaid where day between p_from and p_to),
      'customers_total',    (select count(*) from firstpaid),
      'active',             (select count(*) from subscriptions where coalesce(is_lifetime, false) or expires_at > now()),
      'lifetime',           (select count(*) from subscriptions where coalesce(is_lifetime, false)),
      'expiring',           (select count(*) from subscriptions where not coalesce(is_lifetime, false) and expires_at > now() and expires_at <= now() + interval '14 days'),
      'expired',            (select count(*) from subscriptions where not coalesce(is_lifetime, false) and expires_at <= now()),
      'mrr',                (select coalesce(round(sum(pl.price::numeric / pl.duration_months)), 0)
                               from subscriptions s join plans pl on pl.id = s.plan_id
                              where not coalesce(s.is_lifetime, false) and s.expires_at > now() and coalesce(pl.duration_months, 0) > 0),
      'to_review',          (select count(*) from orders where status = 'review')
    ),
    'series', (select coalesce(json_agg(json_build_object('bucket', bucket, 'revenue', revenue, 'orders', orders, 'signups', signups, 'customers', customers) order by bucket), '[]'::json) from series),
    'plans', (
      select coalesce(json_agg(x order by x.revenue desc, x.active desc), '[]'::json) from (
        select coalesce(a.name, r.name, 'Tanpa nama') as name,
               coalesce(a.active, 0) as active,
               coalesce(r.orders, 0) as orders,
               coalesce(r.revenue, 0) as revenue
        from (select plan_name as name, count(*) as active from subscriptions
               where coalesce(is_lifetime, false) or expires_at > now() group by plan_name) a
        full join (select plan_name as name, count(*) as orders, sum(amt) as revenue from paid group by plan_name) r
               on r.name = a.name
      ) x),
    'methods', (
      select coalesce(json_agg(m order by m.revenue desc), '[]'::json) from (
        select coalesce(method_label, 'Tidak tercatat') as name, count(*) as orders, sum(amt) as revenue
        from paid where day between c_from and today group by 1
      ) m),
    'status', (select coalesce(json_object_agg(status, n), '{}'::json) from (select status, count(*) as n from orders group by status) t),
    'funnel', json_build_object(
      'users',   (select count(*) from su),
      'ordered', (select count(distinct user_id) from orders where status <> 'cancelled'),
      'paid',    (select count(*) from firstpaid)
    ),
    'expiring_list', (
      select coalesce(json_agg(e order by e.expires_at), '[]'::json) from (
        select u.email::text as email, p.username, s.plan_name, s.expires_at
        from subscriptions s
        join auth.users u on u.id = s.user_id
        left join profiles p on p.owner_id = s.user_id
        where not coalesce(s.is_lifetime, false) and s.expires_at > now() and s.expires_at <= now() + interval '14 days'
        order by s.expires_at limit 10
      ) e),
    'recent_users', (
      select coalesce(json_agg(r order by r.created_at desc), '[]'::json) from (
        select u.email::text as email, p.username, u.created_at, s.plan_name,
               (coalesce(s.is_lifetime, false) or coalesce(s.expires_at > now(), false)) as active
        from auth.users u
        left join profiles p on p.owner_id = u.id
        left join subscriptions s on s.user_id = u.id
        order by u.created_at desc limit 6
      ) r)
  ) into res
  from (select 1) _;

  return res;
end $$;
grant execute on function admin_overview(int) to authenticated;

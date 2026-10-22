-- (Diperbarui: jumlah baris tabel kini dihitung eksak. Sudah pernah menjalankan file ini? Jalankan ulang — aman.)
-- REVISI 16: REPORT LOGISTIC — pemantauan penggunaan database & penyimpanan foto (hanya developer/owner).
-- Aman dijalankan berulang. Jalankan SEKALI di Supabase > SQL Editor (setelah revisi-15).

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

-- REVISI 15: kategori OTOMOTIF / MOVESTOCK tidak lagi memakai expedisi.
-- Jalankan SETELAH revisi-14. Aman dijalankan berulang. Jalankan SEKALI di Supabase > SQL Editor.

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

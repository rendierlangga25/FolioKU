-- =====================================================================
-- UPDATE 6 (Saran & Masukan dari landing page)  --  Jalankan SEKALI di Supabase > SQL Editor
-- Aman dijalankan ulang (tidak menghapus data).
-- Isi: tabel "feedback". Siapa saja boleh MENGIRIM, hanya owner (admin_users) yang boleh MEMBACA/MENGHAPUS.
-- =====================================================================
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null default 'saran',
  name text,
  email text,
  message text not null,
  is_read boolean not null default false
);
alter table feedback enable row level security;

drop policy if exists "publik kirim masukan" on feedback;
create policy "publik kirim masukan" on feedback for insert to anon, authenticated
  with check (
    kind in ('saran', 'fitur', 'masalah', 'lainnya')
    and char_length(btrim(message)) between 5 and 1500
    and coalesce(char_length(name), 0) <= 100
    and coalesce(char_length(email), 0) <= 200
    and is_read = false
  );

drop policy if exists "owner baca masukan" on feedback;
create policy "owner baca masukan" on feedback for select to authenticated
  using (exists (select 1 from admin_users where user_id = auth.uid()));

drop policy if exists "owner ubah masukan" on feedback;
create policy "owner ubah masukan" on feedback for update to authenticated
  using (exists (select 1 from admin_users where user_id = auth.uid()))
  with check (exists (select 1 from admin_users where user_id = auth.uid()));

drop policy if exists "owner hapus masukan" on feedback;
create policy "owner hapus masukan" on feedback for delete to authenticated
  using (exists (select 1 from admin_users where user_id = auth.uid()));

create index if not exists feedback_created_idx on feedback(created_at desc);

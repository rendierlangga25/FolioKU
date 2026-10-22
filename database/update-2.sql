-- Jalankan SEKALI di Supabase > SQL Editor (untuk yang sudah menjalankan schema.sql sebelumnya)
alter table site_settings
  add column if not exists bg_color text, add column if not exists card_color text, add column if not exists text_color text,
  add column if not exists dark_color text, add column if not exists nav_color text, add column if not exists navtext_color text;

create table if not exists certificates (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), updated_at timestamptz default now(),
  title text, issuer text, issued_at text, description text, image_url text, credential_url text, published boolean default true, sort_order int default 0);
alter table certificates enable row level security;
create policy "admin penuh" on certificates for all to authenticated using (is_admin()) with check (is_admin());
create policy "publik baca terpublikasi" on certificates for select using (published);
create trigger set_updated before update on certificates for each row execute function set_updated_at();

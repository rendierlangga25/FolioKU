-- Jalankan SEKALI di Supabase > SQL Editor. Tabel lama (portfolio) tidak diubah.
create extension if not exists pgcrypto;

create table admin_users (user_id uuid primary key references auth.users(id) on delete cascade);
alter table admin_users enable row level security;
create policy "baca baris sendiri" on admin_users for select to authenticated using (user_id = auth.uid());

create function is_admin() returns boolean language sql security definer stable set search_path = public
as $$ select exists (select 1 from admin_users where user_id = auth.uid()) $$;
create function set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create table profiles (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), updated_at timestamptz default now(),
  name text, headline text, hero_title text, hero_subtitle text, bio text, location text, email text, whatsapp text,
  avatar_url text, cv_url text, education_text text, focus_text text, stats jsonb default '[]', contact_title text);
create table site_settings (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), updated_at timestamptz default now(),
  site_title text, meta_description text, og_image_url text, favicon_url text, logo_text text default 'RE', accent_color text default '#e2561b', footer_text text, bg_color text, card_color text, text_color text, dark_color text, nav_color text, navtext_color text);
create table experiences (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), updated_at timestamptz default now(),
  company text, role text, period text, bullets text, sort_order int default 0, published boolean default true);
create table projects (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), updated_at timestamptz default now(),
  title text, slug text, description text, category text, thumbnail_url text, technologies text, project_url text, github_url text,
  featured boolean default false, published boolean default true, sort_order int default 0);
create table project_images (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), updated_at timestamptz default now(),
  project_id uuid references projects(id) on delete cascade, url text, sort_order int default 0);
create table skill_categories (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), updated_at timestamptz default now(),
  name text, sort_order int default 0);
create table skills (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), updated_at timestamptz default now(),
  name text, category_id uuid references skill_categories(id) on delete set null, sort_order int default 0);
create table education (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), updated_at timestamptz default now(),
  institution text, degree text, field text, start_year text, end_year text, description text, logo_url text, sort_order int default 0, published boolean default true);
create table social_links (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), updated_at timestamptz default now(),
  platform text, url text, sort_order int default 0, published boolean default true);
create table certificates (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), updated_at timestamptz default now(),
  title text, issuer text, issued_at text, description text, image_url text, credential_url text, published boolean default true, sort_order int default 0);
create table contact_messages (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), updated_at timestamptz default now(),
  name text not null, email text not null, message text not null, is_read boolean default false);

do $$ declare t text; begin
  foreach t in array array['profiles','site_settings','experiences','projects','project_images','skill_categories','skills','education','social_links','certificates','contact_messages'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "admin penuh" on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
    execute format('create trigger set_updated before update on %I for each row execute function set_updated_at()', t);
  end loop;
  foreach t in array array['profiles','site_settings','project_images','skill_categories','skills'] loop
    execute format('create policy "publik baca" on %I for select using (true)', t);
  end loop;
  foreach t in array array['experiences','projects','education','social_links','certificates'] loop
    execute format('create policy "publik baca terpublikasi" on %I for select using (published)', t);
  end loop;
end $$;

create policy "publik kirim pesan" on contact_messages for insert to anon, authenticated
  with check (char_length(message) between 1 and 2000 and char_length(name) <= 100 and char_length(email) <= 200);

insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict do nothing;
create policy "media publik baca" on storage.objects for select using (bucket_id = 'media');
create policy "media admin kelola" on storage.objects for all to authenticated
  using (bucket_id = 'media' and is_admin()) with check (bucket_id = 'media' and is_admin());

-- Jadikan akun kamu admin
insert into admin_users (user_id) select id from auth.users where email = 'rendierlangga2508@gmail.com' on conflict do nothing;

-- Data awal (semua bisa diubah lewat dashboard)
insert into profiles (name, headline, hero_title, hero_subtitle, bio, location, education_text, focus_text, stats, contact_title) values (
 'Rendi Erlangga', 'Management Student | Warehouse & Supply Chain | Digital Enthusiast', 'Building Better Systems, One Step at a Time.',
 'I''m Rendi Erlangga, a Management student with professional experience in warehouse operations, supply chain administration, and a growing interest in technology and digital systems.',
 'I''m a Management student at Universitas Pamulang with hands-on experience in finished goods warehouse administration, from stock monitoring and delivery documentation to operational reporting.' || E'\n\n' || 'I''m now deepening my digital skills, including building internal tools with Google Apps Script so warehouse work stays organized and well documented.',
 '', 'S1 Manajemen, Universitas Pamulang', 'Management, Warehouse, Supply Chain & Technology',
 '[{"n":"S1","l":"Management, Universitas Pamulang"},{"n":"5","l":"Projects and programs"},{"n":"SCM","l":"Warehouse & supply chain focus"}]',
 'Let''s Build Something Meaningful.');
insert into site_settings (site_title, meta_description, footer_text) values (
 'Rendi Erlangga | Management Student, Warehouse & Supply Chain',
 'Portfolio of Rendi Erlangga: Management student with experience in warehouse operations, supply chain administration, and digital systems.',
 '© 2026 Rendi Erlangga');
insert into experiences (company, role, period, bullets, sort_order) values ('PT Servvo Fire Indonesia', 'Admin Warehouse / Finished Goods', '',
 E'Warehouse administration\nStock monitoring\nInventory control\nDelivery documentation\nDistribution coordination\nOperational reporting', 1);
insert into projects (title, slug, category, description, technologies, featured, sort_order) values
 ('WH-FG Department Management System','wh-fg-management-system','Web App','Web app built on Google Apps Script to manage WH-FG department operations: stock, deliveries, fleet, petty cash, and vouchers.','Google Apps Script, Google Sheets',true,1),
 ('Inventory & Stock Monitoring System','inventory-stock-monitoring','Operations','A stock monitoring system supporting inventory control and warehouse reporting.','Inventory, Reporting',false,2),
 ('University Schedule Extension','university-schedule-extension','Productivity','An extension that helps manage university class schedules.','Extension',false,3),
 ('PKM: Financial Literacy Program','pkm-financial-literacy','Program','A Student Creativity Program (PKM) focused on financial literacy.','PKM, Financial Literacy',false,4),
 ('Personal Data & Analytics Projects','personal-data-analytics','Data','A collection of personal projects in data analysis and reporting.','Data Analysis, Excel',false,5);
insert into skill_categories (name, sort_order) values ('Management',1),('Digital',2),('Professional',3);
insert into skills (name, category_id, sort_order)
select s.n, (select id from skill_categories where name = s.c), s.o from (values
 ('Supply Chain','Management',1),('Warehouse Management','Management',2),('Inventory Control','Management',3),('Financial Management','Management',4),
 ('Microsoft Excel','Digital',5),('Google Sheets','Digital',6),('Apps Script','Digital',7),('Data Analysis','Digital',8),('Web Development','Digital',9),
 ('Problem Solving','Professional',10),('Communication','Professional',11),('Adaptability','Professional',12),('Team Coordination','Professional',13)) as s(n,c,o);
insert into education (institution, degree, field, sort_order) values ('Universitas Pamulang','S1','Manajemen',1);
insert into social_links (platform, url, sort_order) values ('linkedin','',1),('github','',2),('instagram','',3);

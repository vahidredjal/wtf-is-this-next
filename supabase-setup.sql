-- Run this once in Supabase's SQL Editor (Project → SQL Editor → New query)

create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  headline text not null,
  dek text default '',
  byline text not null,
  category text not null,
  image_url text,
  image_position text default 'center',
  tldr text default '',
  body_html text not null default '',
  read_time text default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);

create table if not exists site_settings (
  id boolean primary key default true check (id),
  hero_article_id uuid references articles(id) on delete set null
);

insert into site_settings (id, hero_article_id)
values (true, null)
on conflict (id) do nothing;

alter table articles enable row level security;
alter table site_settings enable row level security;

drop policy if exists "public read published articles" on articles;
create policy "public read published articles" on articles
  for select using (status = 'published' or auth.role() = 'authenticated');

drop policy if exists "authenticated write articles" on articles;
create policy "authenticated write articles" on articles
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "public read settings" on site_settings;
create policy "public read settings" on site_settings
  for select using (true);

drop policy if exists "authenticated write settings" on site_settings;
create policy "authenticated write settings" on site_settings
  for update using (auth.role() = 'authenticated');

-- Storage bucket for article images (real hosted URLs, replacing the old
-- base64-embedded approach — no size limit headaches, no billing needed).
insert into storage.buckets (id, name, public)
values ('article-images', 'article-images', true)
on conflict (id) do nothing;

drop policy if exists "public read article images" on storage.objects;
create policy "public read article images" on storage.objects
  for select using (bucket_id = 'article-images');

drop policy if exists "authenticated upload article images" on storage.objects;
create policy "authenticated upload article images" on storage.objects
  for insert with check (bucket_id = 'article-images' and auth.role() = 'authenticated');

drop policy if exists "authenticated update article images" on storage.objects;
create policy "authenticated update article images" on storage.objects
  for update using (bucket_id = 'article-images' and auth.role() = 'authenticated');

drop policy if exists "authenticated delete article images" on storage.objects;
create policy "authenticated delete article images" on storage.objects
  for delete using (bucket_id = 'article-images' and auth.role() = 'authenticated');

-- Added later: per-article choice of how the photo fills its box.
alter table articles add column if not exists image_fit text default 'cover';

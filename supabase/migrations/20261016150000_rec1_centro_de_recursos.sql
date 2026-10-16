-- REC-1 · Centro de recursos: PDFs e infografías con acceso segmentado.
--
-- Cada recurso dice QUIÉN lo ve con una audiencia (`audience`, el mismo jsonb
-- `Restriccion` de GRU-2/FRM-5, más la condición de rol). Sin audiencia, el
-- recurso NO está publicado: solo lo ve quien gestiona recursos. Es a
-- propósito: un manual interno subido sin elegir audiencia no puede quedar a
-- la vista de todo el que tenga cuenta por olvido.
--
-- El archivo vive en el bucket PRIVADO `resources`. Nadie lo lee directo: la
-- app valida la audiencia en el servidor y entrega una URL firmada corta.

create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(btrim(title)) between 1 and 200),
  description text check (description is null or length(description) <= 2000),
  category    text check (category is null or length(btrim(category)) between 1 and 80),
  file_path   text not null unique,
  file_name   text not null,
  mime_type   text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')),
  size_bytes  integer not null check (size_bytes > 0 and size_bytes <= 15 * 1024 * 1024),
  audience    jsonb,
  uploaded_by uuid references public.members(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists resources_category_idx on public.resources (category);
create index if not exists resources_uploaded_by_idx on public.resources (uploaded_by);

comment on table public.resources is
  'REC-1 · Biblioteca de recursos. audience null = sin publicar (solo gestión).';

-- SEC-3: sin políticas. Todo pasa por la app con la llave de servicio.
alter table public.resources enable row level security;

-- El bucket, privado. Sin policies: el service role ignora el RLS de storage
-- y nadie más llega sin pasar por las rutas de la app.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resources', 'resources', false, 15 * 1024 * 1024,
        array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- El rol nuevo. El CHECK de member_roles enumera los roles: sin esto, darlo
-- desde Accesos falla con 23514. Se reescribe la definición VIVA en vez de
-- escribir la lista a mano (el patrón de SOP-1).
do $$
declare
  def text;
begin
  select pg_get_constraintdef(oid) into def
    from pg_constraint where conrelid = 'public.member_roles'::regclass and contype = 'c' and conname = 'member_roles_role_check';
  if def is not null and def not like '%''recursos''%' then
    execute 'alter table public.member_roles drop constraint member_roles_role_check';
    execute 'alter table public.member_roles add constraint member_roles_role_check ' ||
      replace(def, ']))', ', ''recursos''::text]))');
  end if;
end $$;

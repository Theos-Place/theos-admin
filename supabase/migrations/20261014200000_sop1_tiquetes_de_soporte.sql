-- SOP-1 · Tiquetes de soporte desde la puerta + rol que los resuelve.
--
-- Pedido en la reunión del 2026-09-30: quien atiende la mesa de información
-- en un evento se encuentra con «mi correo está mal», «mi hija aparece en otra
-- familia», «no me deja entrar». Hoy eso se resuelve a gritos por WhatsApp y
-- se pierde. El tiquete es a propósito SIMPLE: quién lo levanta (automático),
-- cuándo (automático) y un texto. Sin categorías, sin adjuntos — decidido.
--
-- Lo resuelve el rol nuevo `soporte_tecnico`, que llega solo por el puesto
-- «Soporte Técnico» del Comité de Tecnología de Información (position-roles).

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),

  -- Quién lo levantó: el operador logueado. Dueño del tiquete.
  created_by uuid not null references public.members(id) on delete cascade,

  -- A quién se refiere, si el operador lo tenía a mano. Opcional a propósito:
  -- el texto lo dice y no vale la pena trabar la creación buscando la ficha.
  member_id uuid references public.members(id) on delete set null,

  -- Desde qué evento se levantó (contexto, no requisito).
  event_id uuid references public.events(id) on delete set null,

  details text not null,

  status text not null default 'open',
  reviewed_by uuid references public.members(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint support_tickets_status_check check (status in ('open','in_review','resolved','rejected')),
  constraint support_tickets_details_check check (length(btrim(details)) >= 10)
);

create index if not exists idx_support_tickets_status on public.support_tickets (status, created_at desc);
create index if not exists idx_support_tickets_created_by on public.support_tickets (created_by);

-- Mismo molde que evaluation_ticket_status_history: RequestBoard lo pinta tal cual.
create table if not exists public.support_ticket_status_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.members(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_ticket_history_ticket
  on public.support_ticket_status_history (ticket_id, created_at);

-- SEC-3: sin políticas. Todo pasa por la app con la llave de servicio.
alter table public.support_tickets enable row level security;
alter table public.support_ticket_status_history enable row level security;

-- El rol nuevo. El CHECK de member_roles enumera los roles: sin esto el sync
-- por puesto falla en silencio (gotcha documentado en la memoria del proyecto).
do $$
declare
  def text;
begin
  select pg_get_constraintdef(oid) into def
    from pg_constraint where conrelid = 'public.member_roles'::regclass and contype = 'c' and conname = 'member_roles_role_check';
  if def is not null and def not like '%soporte_tecnico%' then
    execute 'alter table public.member_roles drop constraint member_roles_role_check';
    execute 'alter table public.member_roles add constraint member_roles_role_check ' ||
      replace(def, ']))', ', ''soporte_tecnico''::text]))');
  end if;
end $$;

-- INF-2: el helper de RLS del padrón enumera los roles con alcance total
-- sobre «miembros». soporte_tecnico entra; rls-helpers.test.ts lo compara
-- contra roles.ts y falla si las dos listas no dicen lo mismo.
create or replace function private.ve_padron()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select private.has_any_role(ARRAY['admin','direccion','solo_lectura','editor_perfiles',
    'comunicaciones','coordinador_dirigentes','coordinador_estudios','encargado_staff',
    'coordinador_servidores','finanzas','soporte_tecnico']);
$$;

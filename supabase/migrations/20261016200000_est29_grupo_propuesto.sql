-- EST-29 · Demanda declarada: el grupo que se abrió para atender una solicitud.
--
-- Cuando coordinación abre un grupo desde un clúster de la pantalla de
-- demanda, las solicitudes de ese clúster quedan VINCULADAS al grupo nuevo.
-- No es `resolved_group_id`: ese dice que la solicitud ya se resolvió (y en
-- una reubicación, que la persona ya quedó matriculada). Esto solo dice «se
-- abrió un grupo pensando en ella»; resolverla sigue siendo el paso de siempre
-- en la cola, después de avisarle. No se auto-matricula a nadie.

alter table public.study_requests
  add column if not exists grupo_propuesto_id uuid references public.study_groups(id) on delete set null;

create index if not exists study_requests_grupo_propuesto_idx
  on public.study_requests (grupo_propuesto_id) where grupo_propuesto_id is not null;

comment on column public.study_requests.grupo_propuesto_id is
  'EST-29 · Grupo abierto desde la pantalla de demanda pensando en esta solicitud. No la resuelve.';

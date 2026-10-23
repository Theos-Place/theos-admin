-- SRV-20 (etapa 4, parte A) · Invitación a llenar el perfil S.I.R.V.E. desde
-- el grupo de Sirviendo como Jesús. Decisiones de Floriana, 2026-10-21.
--
-- 1) `sirve_form_invites`: a quién se le mandó la invitación y por cuál
--    grupo. Es el dedupe POR PERSONA: un segundo clic no repite a quien ya
--    recibió, solo ofrece reenviar a quienes aún no llenaron el perfil
--    (`member_spiritual_data.editado_en_sistema_at is null`). FEA-1 dedupea
--    por formulario con una sola clave; acá eso no alcanza porque la lista de
--    matriculados cambia y el reenvío es a un subconjunto.
--
-- 2) La plantilla del correo, `sirve_invitacion`, como las demás del sistema
--    (se edita desde Comunicaciones → Plantillas; esto es el texto inicial).

create table if not exists public.sirve_form_invites (
  member_id   uuid not null references public.members(id) on delete cascade,
  group_id    uuid not null references public.study_groups(id) on delete cascade,
  sent_at     timestamptz not null default now(),
  sent_by     uuid references auth.users(id) on delete set null,
  /** Cuántas veces se le ha mandado (1 = primera, 2+ = reenvíos). */
  veces       int not null default 1,
  primary key (member_id, group_id)
);

comment on table public.sirve_form_invites is
  'SRV-20 · A quién se le envió la invitación a llenar el perfil S.I.R.V.E., por grupo de SCJ. Dedupe por persona; reenvío solo a quien no ha llenado.';

alter table public.sirve_form_invites enable row level security;
revoke all on table public.sirve_form_invites from anon, authenticated;
-- SEC-4: el GRANT a service_role va explícito en la migración que crea la tabla.
grant select, insert, update, delete on public.sirve_form_invites to service_role;

INSERT INTO public.message_templates (name, channel, subject, body, body_format, category, is_system, system_key, is_active, available_variables)
SELECT
  'Perfil S.I.R.V.E. (invitación del grupo)', 'email',
  'Contanos tu perfil S.I.R.V.E.',
  '<p>Hola {{nombre}},</p>

   <p>Estás en <strong>{{nombre_grupo}}</strong> de Sirviendo como Jesús. Como parte del
   curso te pedimos llenar tu perfil S.I.R.V.E.: tus dones, tu estilo, tus habilidades y
   dónde te gustaría servir. Es lo que usa el equipo de servidores para encontrarte un
   lugar.</p>

   <p>Toma unos minutos y lo que ya tengamos guardado viene lleno; solo revisalo y corregí
   lo que cambió. Cada cambio se guarda solo.</p>

   <div class="cta-wrapper"><a class="cta-button" href="{{link_form}}">Llenar mi perfil S.I.R.V.E. →</a></div>

   <p>Atentamente,<br><strong>Área de Estudios · Theos Place</strong></p>',
  'html', 'transactional', true, 'sirve_invitacion', true,
  '["nombre","nombre_grupo","nombre_dirigente","link_form"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.message_templates WHERE system_key = 'sirve_invitacion');

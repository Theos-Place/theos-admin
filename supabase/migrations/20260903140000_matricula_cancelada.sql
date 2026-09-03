-- Una matrícula cancelada no es un retiro, y menos una reprobación.
--
-- Todo lo que se cortaba caía en 'dropped', y la ficha del miembro traducía
-- `dropped: 'Reprobó'`. O sea que a alguien que canceló su matrícula —o a
-- quien se le venció el plazo del comprobante— el historial le decía que
-- REPROBÓ un estudio que nunca llevó.
--
-- Caso real (2026-09-02): a Karina Padilla se le liberó el cupo por no subir
-- el comprobante en 24 horas y en su ficha aparecía "Reprobó Cómo Tomar
-- Buenas Decisiones".
--
-- 'cancelada' es el estado nuevo: la matrícula no llegó a darse. No cuenta
-- como resultado de nada y no sale en el historial de estudios.
-- 'dropped' queda para el retiro de verdad: empezó a cursar y se fue.

alter table public.study_enrollments drop constraint if exists study_enrollments_status_check;
alter table public.study_enrollments add constraint study_enrollments_status_check
  check (status = any (array[
    'enrolled', 'waitlist', 'completed', 'dropped', 'transferred',
    'pendiente_de_pago', 'expirada', 'reprobado', 'en_revision', 'cancelada'
  ]));

comment on column public.study_enrollments.status is
  'cancelada = la matrícula nunca se dio (canceló, venció el plazo, se inscribió por error). dropped = cursaba y se retiró. Ver close-result-read.ts.';

-- Reclasificar lo que existe. Los "Retirado en cierre" son retiros de verdad:
-- esa persona cursó y el dirigente registró su salida al cerrar. Todo lo demás
-- —pruebas, inscripciones por error, cambios de grupo, el barrido de las 24
-- horas— es una matrícula que no ocurrió.
update public.study_enrollments
set status = 'cancelada', updated_at = now()
where status = 'dropped'
  and coalesce(drop_reason, '') not ilike 'Retirado en cierre%';

-- Evento PÚBLICO vs INTERNO (pedido 2026-08-27).
--
-- Hasta ahora todos los eventos eran públicos: /api/public/events leía la misma
-- fuente que el calendario interno, y su propio comentario lo decía ("la tabla
-- events NO tiene columna is_public"). O sea que cualquier evento creado para
-- adentro aparecía en el calendario embebido en el sitio de la iglesia.
--
-- DEFAULT true a propósito: los 3.508 eventos que ya existen se quedan como
-- están. Ponerlos en false vaciaría el calendario público de un golpe, y quien
-- pidió el cambio quiere elegir en los NUEVOS, no reclasificar el histórico.
--
-- Interno NO significa secreto: se sigue pudiendo compartir por su link directo
-- (/calendario/<id>), que es como se reparte por WhatsApp o QR. Lo que cambia es
-- que no se LISTA: no sale en el calendario público ni en el de los miembros.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.events.is_public IS
  'true = se lista en el calendario público y en el de los miembros. false = interno: solo se llega por su link directo, o lo ve quien gestiona eventos.';

-- El calendario público filtra por esta columna en cada carga.
CREATE INDEX IF NOT EXISTS idx_events_is_public_starts_at
  ON public.events (is_public, starts_at DESC);

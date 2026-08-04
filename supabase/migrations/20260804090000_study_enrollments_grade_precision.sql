-- grade pasa de numeric(4,2) a numeric(5,2).
--
-- numeric(4,2) topa en 99.99, y un 100 en Panorama es una nota normal: de las 261
-- notas del export de CCB, 22 no caben (18 son exactamente 100, y hay 100.1, 101,
-- 102 y 105.2 — los puntos extra de esa evaluación pueden pasar de 100).
--
-- Ampliar la precisión no toca ningún dato existente (hoy no hay ni una fila con
-- grade) y no cambia el tipo para nadie: numeric(5,2) acepta todo lo que aceptaba
-- numeric(4,2).

ALTER TABLE "public"."study_enrollments"
  ALTER COLUMN "grade" TYPE numeric(5,2);

COMMENT ON COLUMN "public"."study_enrollments"."grade" IS
  'Nota final del estudio, 0–999.99. Panorama puede pasar de 100 por puntos extra.';

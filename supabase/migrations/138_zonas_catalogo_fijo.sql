-- Catálogo de zonas fijo (2026-07-17). La creación/edición de grupos solo permite
-- elegir de este catálogo (la UI quitó la opción de crear zonas nuevas). Se agregan
-- las 17 sedes faltantes y se desactivan las 9 que quedaron fuera de la lista
-- oficial de 23. Los grupos viejos que usaban las desactivadas conservan su
-- etiqueta, porque sedeLabel resuelve contra el catálogo completo (activas +
-- inactivas). Idempotente.
INSERT INTO sedes (code, name, is_active, is_historical) VALUES
  ('san-rafael-de-alajuela', 'San Rafael de Alajuela', true, false),
  ('belen',                  'Belén',                   true, false),
  ('este-sj',                'Este SJ',                 true, false),
  ('oeste-sj',               'Oeste SJ',                true, false),
  ('casona-escalante',       'Casona Escalante',        true, false),
  ('casona-pedregal',        'Casona Pedregal',         true, false),
  ('ciudad-colon',           'Ciudad Colón',            true, false),
  ('curridabat',             'Curridabat',              true, false),
  ('escazu',                 'Escazú',                  true, false),
  ('finca-sasso',            'Finca Sasso',             true, false),
  ('limon',                  'Limón',                   true, false),
  ('lindora',                'Lindora',                 true, false),
  ('la-sabana',              'La Sabana',               true, false),
  ('la-uruca',               'La Uruca',                true, false),
  ('santa-ana',              'Santa Ana',               true, false),
  ('san-pedro',              'San Pedro',               true, false),
  ('tres-rios',              'Tres Ríos',               true, false)
ON CONFLICT (code) DO UPDATE SET is_active = true, is_historical = false;

UPDATE sedes SET is_active = false
WHERE code IN ('antares', 'guapiles', 'heredia-youth', 'home', 'madrid',
               'meridiano', 'pedregal', 'united', 'united-youth');

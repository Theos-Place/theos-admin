-- Ajuste del catálogo de sedes activas (2026-07-21, pedido de dirección): solo
-- 11 sedes quedan activas; el resto se desactiva (sin borrarlas ni marcarlas
-- históricas). Afecta a todo el sistema (reportes, perfiles, folletos).

-- 1) Desactivar todo y activar solo las vigentes.
update public.sedes set is_active = false;
update public.sedes set is_active = true
where name in (
  'Meridiano', 'Antares', 'Liberia', 'Guápiles', 'Cartago',
  'Pérez Zeledón', 'Potrero', 'Alajuela', 'Madrid', 'Pedregal'
);

-- 2) Meridiano pasa a dos días (Martes y Miércoles 7:30pm).
update public.sedes
set day = 'Martes / Miércoles', time = '7:30pm | 7:30pm'
where name = 'Meridiano';

-- 3) Madrid Home: sede nueva (activa), aparte de Madrid.
insert into public.sedes (code, name, is_active, is_historical)
select 'madrid-home', 'Madrid Home', true, false
where not exists (select 1 from public.sedes where code = 'madrid-home' or name = 'Madrid Home');
update public.sedes set is_active = true, is_historical = false where name = 'Madrid Home';

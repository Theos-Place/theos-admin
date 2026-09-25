-- Ocho grupos activos se llamaban por una zona que no era la suya.
--
-- Por convención el grupo se llama «SCJ — Este SJ», con la zona escrita a mano.
-- Cuando el grupo se muda nadie renombra, y el nombre queda mintiendo. El
-- 2026-09-24 se hizo que las pantallas mostraran la zona del CAMPO al lado, y
-- ayudó, pero el nombre sigue siendo lo que se lee primero — en la ficha del
-- dirigente, bajo «Dando ahora», es lo único grande. Floriana lo reportó dos
-- veces con el grupo de Stanley Benavides antes de que quedara claro que el
-- arreglo de pantalla no alcanzaba.
--
-- EN LOS OCHO, LA UBICACIÓN LE DA LA RAZÓN A LA ZONA Y NO AL NOMBRE. No se está
-- adivinando: «SCJ — Este SJ» se reúne en Pavas, «SCJ — Oeste SJ» en Pozos de
-- Santa Ana, «RDM — Casona Escalante» en San Miguel de Santo Domingo. El nombre
-- nuevo es el código del plan más el nombre de la zona que el grupo ya tiene.
--
-- SOBRE LOS NOMBRES REPETIDOS. Mi primera versión de este comentario decía que
-- no quedaba ninguno, y era falso: HOY YA HAY SIETE nombres duplicados entre
-- los grupos activos —«SCJ — Heredia», «SCJ — Este SJ», «N1 — Alajuela»,
-- «N1 — Casona Escalante», «DIS1 — Este SJ», «SCJ — Oeste SJ» y
-- «EXP — Santa Ana»—, porque la convención «CÓDIGO — Zona» no puede
-- distinguir dos grupos del mismo estudio en la misma zona.
--
-- Este cambio BAJA los duplicados de 7 a 3. El que queda en «SCJ — Este SJ» son
-- dos grupos que de verdad están los dos en Este SJ: uno en Betania los lunes y
-- otro en Guadalupe los miércoles. Para separarlos haría falta meter el día en
-- el nombre, que es otra decisión y no esta.
--
-- Por ID y no por nombre: el nombre es texto que alguien puede repetir o
-- editar, y acá justamente se está editando.
--
-- Idempotente: el WHERE exige el nombre viejo.

update study_groups g
   set name = v.nuevo, updated_at = now()
  from (values
    ('c193e22b-1720-46df-a38c-302eec6748d2'::uuid, 'DIS1 — Sede Alajuela',        'DIS1 — Este SJ'),
    ('ebd0f330-452c-4332-a1c7-005dd675ca14'::uuid, 'N1 — San Rafael de Alajuela', 'N1 — Alajuela'),
    ('39975cac-383e-4b2d-9570-dba7feb9bec6'::uuid, 'PAN — Casona Escalante',      'PAN — Este SJ'),
    ('31fe011d-b01a-4867-811a-ac9cb660d990'::uuid, 'RDM — Santo Domingo',         'RDM — Casona Escalante'),
    ('96abae5a-bb01-4f6b-a426-c37bf0353c58'::uuid, 'SCJ — La Sabana',             'SCJ — Este SJ'),
    ('f9fb64b1-e42f-4a3f-950e-1200480ac5c7'::uuid, 'SCJ — Santo Domingo',         'SCJ — Heredia'),
    ('d1ac37eb-65d3-41c9-8e9d-119ba77ce175'::uuid, 'SCJ — Santa Ana',             'SCJ — Oeste SJ'),
    ('f0aacf6f-7014-4d93-ba46-ccc1fb0e54c5'::uuid, 'SCJ — Este SJ',               'SCJ — Oeste SJ')
  ) as v(id, nuevo, viejo)
 where g.id = v.id
   and g.name = v.viejo;

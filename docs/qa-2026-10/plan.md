# QA-2 y QA-3 · Plan de ejecución (2026-10-15)

Dos auditorías independientes. Se pueden correr en dos sesiones a la vez: QA-3
es sobre el código y no toca ningún ambiente; QA-2 corre contra **staging** y
necesita el dev server y las cuentas de prueba.

Las dos tienen la misma regla que QA-1: **levantar el mapa, no arreglar**. El
producto es un informe con hallazgos CRÍTICO / MEDIO / MENOR, cada uno con
`archivo:línea` (o URL + rol + paso), evidencia medida y un fix propuesto de una
línea. Los arreglos salen después, en tandas, con su propio commit cada una. La
única excepción: si un hallazgo es un **riesgo de seguridad activo en
producción** (dato expuesto sin guard, escritura sin autorización), se reporta
de inmediato en el chat y se deja marcado como P0 arriba del informe, sin
esperar a terminar.

Lo que QA-1 ya cubrió y NO se repite: consistencia estática de UI (fechas a
mano, `PageContainer`, botón compartido, títulos de pestaña), axe y móvil en
las páginas públicas. Ver `docs/qa-2026-09/informe-automatizado.md`.

---

## QA-3 · Auditoría de código: endpoints, llamados a la BD y rendimiento

**Sesión:** Opus, sin dev server, sin cuentas. Solo lectura del repo más
consultas de **solo lectura** a producción para medir (conteos, `EXPLAIN`).

**Informe:** `docs/qa-2026-10/informe-codigo.md`.

**Tamaño real hoy:** 299 `route.ts` en `src/app/api`, 130 `page.tsx`, 35 hooks,
474 módulos en `src/lib`, baseline SQL de 7.629 líneas más ~90 migraciones
posteriores.

### Prompt

```
QA-3 · Auditoría de código de theos-admin. LEVANTAR EL MAPA, NO ARREGLAR.
Informe a docs/qa-2026-10/informe-codigo.md con hallazgos CRÍTICO/MEDIO/MENOR,
cada uno con archivo:línea, evidencia MEDIDA y fix propuesto de una línea.
No tocar src/. No tocar la base: solo SELECT y EXPLAIN. Leé primero AGENTS.md
(la sección «Seguridad en rutas API» es el criterio de autorización) y
docs/qa-2026-09/informe-automatizado.md (para no repetir lo que ya se midió).

Para medir contra producción usá `scripts/madre-2026-09/lib.cjs` → nuevoCliente()
con un setTimeout de tope (process.exit(2) a los 60s) y cerrá siempre la conexión:
los procesos colgados agotan el pooler.

1. CENSO DE ENDPOINTS. Una tabla por cada route.ts de src/app/api/**:
   ruta → métodos → guard (requireRoles(...) con qué roles / requireModuleView /
   requireRoles() a secas = solo sesión / ninguno) → validación del body
   (zod / a mano / ninguna) → consultas a la BD por request (contadas en el
   código) → ¿usa reportarError en el catch?
   Marcar:
   · SIN guard: CRÍTICO, salvo los públicos a propósito (cotejar contra
     PUBLIC_PREFIXES en src/proxy.ts, los crons con CRON_SECRET, los webhooks
     con firma y /api/public/**). Para cada excepción decir POR QUÉ es válida.
   · Escrituras (POST/PUT/PATCH/DELETE) que solo exigen sesión (requireRoles()
     sin roles) sin una decisión documentada en el handler: MEDIO.
   · Body sin zod: MEDIO si escribe, MENOR si solo lee.
   · Endpoints que reciben member_id por query/body sin resolveTargetMemberId
     ni chequeo de pertenencia (IDOR): CRÍTICO.
   Después del censo, correr `node scripts/sec3/auditar.cjs` y pegar el resultado.

2. PATRONES DE BD CAROS. Buscar sistemáticamente en src/lib/supabase/queries y
   src/app/api:
   · N+1: await de supabase dentro de for/map/forEach. Listar con el loop.
   · El tope de 1.000 filas de PostgREST: TODA consulta sin .range()/.limit()
     sobre tablas que hoy superan 1.000 filas. Medir primero con
     `select relname, n_live_tup from pg_stat_user_tables order by 2 desc` y
     cruzar: cada consulta sin paginar sobre una tabla >1.000 es un hallazgo con
     el conteo real al lado. (Ya mordió en REP-7 y en DAT-14.)
   · select('*') o embeds anchos donde el código usa 2 campos.
   · Traer el padrón/las matrículas completas al server para filtrar en JS
     cuando el filtro cabía en la query.
   · Consultas repetidas en el mismo request (mismo dato pedido dos veces).
   · Índices faltantes: para las 15 consultas más frecuentes (por ruta más
     visitada: pagos, donaciones, matrícula, check-in, dirigentes, grupos)
     correr EXPLAIN (ANALYZE, BUFFERS) en prod y listar los Seq Scan sobre tablas
     >5.000 filas. Cruzar contra los índices del baseline y de las migraciones.
     Cada candidato con su consulta de evidencia y el costo medido.

3. RENDIMIENTO DE PÁGINA (estático). Páginas que cargan todo al montar sin
   paginar (grep de pageSize=500/1000/2000 y de fetch sin page); imports que
   meten librerías pesadas al bundle del cliente (correr `npx next build` y leer
   el tamaño de First Load JS por ruta; las 10 más pesadas con qué las infla);
   cadenas de useEffect que disparan fetch en cascada (un efecto que setea
   estado que dispara otro efecto que hace fetch).

4. TRANSVERSALES.
   · Código muerto: exports de src/lib y src/components sin ningún importador
     (script con grep; excluir tests y los que exporta un index).
   · Reglas de negocio duplicadas: la misma constante o condición escrita en
     dos lados (ya pasó con la ventana de donante y con quién ve montos).
     Buscar: listas de roles repetidas en handlers, ventanas de horas/días,
     mapas de etiquetas de estado, cálculos de costo.
   · TODO/FIXME/XXX con más de un mes (git blame).
   · Funciones SQL en public con EXECUTE abierto (lo cubre sec3/auditar; pegar).

5. FORMATO DEL INFORME.
   · Arriba: resumen en 10 líneas con los números (endpoints sin guard,
     consultas sin paginar sobre tablas grandes, N+1, índices candidatos,
     exports muertos) y los 5 hallazgos que más importan.
   · Luego CRÍTICO, MEDIO, MENOR. Cada hallazgo: título, archivo:línea,
     evidencia (el número, el EXPLAIN, el grep), fix de una línea, esfuerzo
     (S/M/L).
   · Al final: «Lo que pasa limpio» (qué se revisó y está bien) y «Lo que este
     informe NO dice» (qué no se pudo medir y por qué).
   · El censo completo de endpoints va en docs/qa-2026-10/censo-endpoints.md
     aparte, para que el informe se pueda leer.

REGLA DE LA CASA: medir antes de afirmar. Ningún hallazgo de rendimiento sin
número. Un «parece lento» no es un hallazgo.
Al terminar: commit del informe a staging (solo docs/), y una lista de 5
tandas propuestas para los arreglos, ordenadas por riesgo/esfuerzo.
```

---

## QA-2 · QA autenticado completo, desde staging

**Sesión:** Opus con el navegador integrado. Dev server de staging:
`preview_start name "theos-admin (staging)"` (puerto 3001, apunta al Supabase
de staging, banner STAGING). **Nunca contra producción.**

**Informe:** `docs/qa-2026-10/informe-autenticado.md`, datos crudos en
`docs/qa-2026-10/axe/*.json`, capturas en `docs/qa-2026-10/capturas/`.

### Cuentas y roles

Las cuentas de staging están en `docs/staging.md` (contraseña en
`SEED_TEST_PASSWORD` de `.env.staging.local`). Para probar un rol que ninguna
cuenta tiene, el patrón que ya se usó en esta base: darle el rol a la cuenta
de prueba `coord.dirigentes@prueba.theosplace.invalid`
(member `659baf3b-9d3f-4a55-ba18-96e4c1c9ce22`) con un POST a
`/rest/v1/member_roles` usando la service key de `.env.staging.local`, y
**borrar esa fila al terminar**. Nunca dejar roles temporales puestos.

Los roles a cubrir, uno por recorrido: `admin`, `finanzas`, `direccion`,
`coordinador_estudios`, `coordinador_dirigentes`, `dirigente`,
`encargado_eventos`, `editor_perfiles`, `revision_pagos`, `becas`,
`soporte_tecnico`, `colaborador_finanzas` (adelantos), `comunicaciones` y
`miembro` sin ningún rol (el autoservicio).

### Prompt

```
QA-2 · QA autenticado de theos-admin contra STAGING. LEVANTAR EL MAPA, NO
ARREGLAR. Informe a docs/qa-2026-10/informe-autenticado.md, hallazgos
CRÍTICO/MEDIO/MENOR con URL + rol + paso para reproducir, evidencia (captura,
salida de axe, conteo de clics) y fix propuesto de una línea. No tocar src/.
Leé primero docs/qa-2026-10/plan.md (este archivo), docs/staging.md,
docs/qa-2026-09/informe-automatizado.md y
`Theos Place Design System/accessibility.md` (es el criterio: WCAG 2.1 AA,
texto mínimo text-navy-light/80, 13px mínimo, aria-label en botones solo-ícono,
modales solo con Modal.tsx, todo operable con teclado).

Herramientas: el navegador integrado (preview_start "theos-admin (staging)"),
`@axe-core/playwright` (ya instalado; scripts/qa/auditar-publicas.ts es el
molde: copiarlo a scripts/qa/auditar-autenticadas.ts y hacer que inicie
sesión con una cuenta y recorra una lista de rutas), y resize_window para
móvil (375px) y teclado.

0. PREPARACIÓN. Levantar el dev server de staging. Verificar que el banner
   diga STAGING y que /api/auth/me devuelva la cuenta esperada. Si falta una
   cuenta o un rol, crearla con scripts/staging/crear-usuario.mjs o con el rol
   temporal; anotar cada cosa que se creó para borrarla al final.

1. AXE EN TODAS LAS PANTALLAS AUTENTICADAS. Con la cuenta admin (ve todo),
   correr axe sobre cada page.tsx de src/app/(admin) (130 páginas; las
   dinámicas con un id real de staging). Guardar el JSON por ruta. Resumen:
   violaciones por regla (color-contrast, label, button-name, landmark…) con
   las 10 rutas peores. Cada violación «serious» o «critical» es un hallazgo
   MEDIO; las de contraste en texto informativo, MEDIO; en decorativo, MENOR.

2. MÓVIL (375px) EN LAS PANTALLAS DE USO DIARIO. Las que se usan desde un
   teléfono de verdad: check-in (/eventos/checkin y /eventos/[id]/checkin),
   /matricula, /mis-pagos, /mi-perfil con el tab Dirigente, /eventos (las 3
   vistas), el formulario público de un evento, /servidores/mi-comite,
   /finanzas/adelantos, /empleados/viajes. Buscar: desborde horizontal
   (scrollWidth > clientWidth), texto cortado, botones de menos de 44px de
   alto táctil, modales que no se cierran, tablas sin versión móvil. Captura
   de cada hallazgo en capturas/.

3. TECLADO Y FOCO en los 6 flujos críticos. Sin mouse, solo Tab/Enter/Esc:
   a) miembro se matricula en un grupo con costo y sube comprobante;
   b) encargado hace check-in de una persona y de una familia;
   c) dirigente cierra su grupo (wizard de 2 pasos, modal «escribir cerrar»);
   d) finanzas aprueba un comprobante en /finanzas/pagos;
   e) coordinación resuelve una reubicación (RequestBoard + picker);
   f) soporte levanta y resuelve un tiquete.
   Por flujo: ¿se ve siempre dónde está el foco? ¿el modal atrapa el foco y
   Esc lo cierra? ¿hay algún control que solo se abre con hover? ¿se puede
   terminar el flujo sin tocar el mouse?

4. RECORRIDO HEURÍSTICO POR ROL. Entrar con cada rol de la lista y hacer lo que
   ese rol hace a diario. En cada pantalla contestar cuatro preguntas y anotar
   cuando la respuesta es no:
   · ¿Sé dónde estoy? (título, migas, menú marcado)
   · ¿Sé qué hacer? (la acción principal es obvia; el estado vacío dice qué
     hacer, no solo «no hay datos»)
   · ¿El error me dice cómo salir? (provocar uno: guardar vacío, subir un
     archivo malo, repetir una acción)
   · ¿Cuántos clics costó? (contar desde el dashboard; más de 4 para una tarea
     diaria es hallazgo MENOR)
   Y lo que NO debería ver: para cada rol, intentar abrir 3 rutas de otro módulo
   por URL directa y 3 endpoints por fetch; anotar si alguno pasa (CRÍTICO).
   Rutas sugeridas por rol:
   · miembro sin rol: /miembros, /finanzas, /api/finance/payments,
     /api/members?pageSize=5.
   · encargado_eventos: /finanzas/reportes, /estudios/dirigentes,
     /api/finance/donations.
   · dirigente: /finanzas/pagos, /api/studies/groups de un grupo ajeno.
   · revision_pagos: montos de donaciones (/api/finance/donations debe venir
     con amounts_visible=false), /empleados/viajes.
   · soporte_tecnico: /finanzas, /reportes, /estudios (403 los tres).
   · colaborador_finanzas: /finanzas/adelantos de una sede ajena (debe decir
     «Esa sede no es tuya»).

5. LO QUE SE APRENDIÓ ESTA SEMANA Y HAY QUE VERIFICAR A PROPÓSITO:
   · Abrir el check-in por URL directa (QR) ya no manda al dashboard.
   · /finanzas/donaciones redirige a /finanzas/reportes y la pestaña trae todo.
   · Los montos de donación los ve admin y dirección sin el rol finanzas.
   · Las tres pestañas de Reportes se ven iguales (misma barra, tarjetas,
     tabla) a 1440 y a 375.
   · Un cambio de grupo con pago previo NO genera un cobro nuevo (mover a
     alguien de prueba entre dos grupos del mismo costo y mirar /mis-pagos).
   · El tiquete de soporte solo lo levanta quien opera el check-in.

6. FORMATO DEL INFORME. Igual que QA-1: resumen de 10 líneas con números
   (pantallas auditadas, violaciones por severidad, flujos que no se completan
   con teclado, rutas que un rol pudo abrir sin deber), CRÍTICO/MEDIO/MENOR
   con URL + rol + pasos + evidencia + fix de una línea + esfuerzo, «Lo que pasa
   limpio» y «Lo que este informe NO dice».

AL TERMINAR: borrar todo lo que se creó (roles temporales, miembros, grupos,
eventos, pagos de prueba) y listar en el informe qué se borró. Commit del
informe y del script a staging (docs/ y scripts/qa/ solamente). Proponer las
tandas de arreglo ordenadas por riesgo/esfuerzo.
```

---

## Después de los dos informes

Con los dos informes en mano se arma UNA cola de arreglos (no dos): se cruzan
los hallazgos —un endpoint sin paginar que además tiene su pantalla lenta es un
solo ítem— y se ordenan por riesgo primero y esfuerzo después. Cada tanda es un
commit a staging verificado antes de pedir prod, como siempre.

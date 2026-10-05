# Plan de desarrollo — pendientes

> **Solo lo que falta.** Lo ya entregado está en
> [`plan-desarrollo-cerrado.md`](plan-desarrollo-cerrado.md) — 203 ítems con
> sus notas de implementación y sus decisiones. No es relleno: ahí está el
> porqué y la trampa medida de cada área, y conviene buscar ahí ANTES de
> tocar algo que ya se tocó o de reabrir una discusión ya resuelta.
>
> Se limpió dos veces: el 2026-09-10 (96 ítems) y el 2026-10-01 (107 más),
> cuando este archivo tenía 6.152 líneas y el 80% era historia.

## Fase 13 — Cola nueva (pedida 2026-09-10)

### [~] DAT-5 · Grupos finalizados con gente sin resultado — REENCUADRADO 2026-09-28

**LA PREMISA DEL ÍTEM ESTABA CORRIDA, y medirla de nuevo lo mostró.** Decía
que 11.420 personas quedaron «sin nota numérica Y sin la etiqueta
aprobado/reprobado». La etiqueta no falta: en este modelo `completed` YA
significa aprobado y la reprobación se guarda aparte. Lo único que faltaba era
el número.

**Y el número NO SE PUEDE RECUPERAR.** Los planes que exigen nota son solo N1
a N4 (2.920 sin nota en N4, 217 en N2, 134 en N3, 113 en N1). Se revisaron
todos los archivos de import: el formulario de fin de nivel de CCB pedía
«Lista de estudiantes que aprobaron» y «Lista de estudiantes que reprobaron»,
nombres a mano en texto libre — **ninguna columna de nota, calificación ni
puntaje**. La única «Nota Panorama» que aparece (179 registros) es de un plan
que no exige nota, y viene sucia: mezcla `100`, `98`, `reprobo` y `no hay
info, dirigente`.

**DECISIÓN (Floriana, 2026-09-28): la nota NO es obligatoria; el RESULTADO
sí.** Exigir la nota volvería imposible cerrar un grupo cuyo dirigente no
tiene de dónde sacarla. Lo que no puede faltar es el desenlace.

**HECHO**: `missingReasons` bloquea el cierre cuando alguien quedó sin marcar
(`sin_resultado`), con el mensaje «falta marcar si aprobó, reprobó o se
retiró». La nota sigue siendo opcional, fijado por su propio test. Dos cebos
muerden.

**PENDIENTE — las 10 personas ya colgadas.** Quedaron en `en_revision` dentro
de un grupo cerrado: ni aprobadas ni reprobadas. Son de 8 grupos, entre
diciembre 2025 y julio 2026, y solo el dirigente que las tuvo puede decir qué
pasó. Lista entregada en xlsx con el dirigente, su correo, y la asistencia de
cada persona al grupo para ayudar a reconstruirlo. Ocho de las diez son del
cierre del 10 de julio.

**Lo que el ítem tenía bien**: cero personas quedaron en `enrolled` dentro de
un grupo cerrado.

**Medido el 2026-09-10.** Buena noticia primero: **nadie quedó `enrolled` en un
grupo cerrado** — el cierre siempre resuelve el estado de la inscripción. Lo que
falta es el RESULTADO: 1.738 grupos con 11.420 personas quedaron `completed` sin
nota numérica y sin la etiqueta aprobado/reprobado.

De esos, casi todo es el histórico importado de CCB, que nunca trajo notas
(2010–2025). **Lo accionable son los 63 grupos con 313 personas que se cerraron
en 2026, ya dentro de la app.** Ahí sí hubo un dirigente que cerró y no puso el
resultado.

Antes de perseguir a nadie hay que ver por qué se pudo cerrar sin resultado: si
la pantalla de cierre lo permite, el arreglo es del formulario, no de los datos.
Absorbe a DAT-3 (los 48 grupos sin una sola nota son un subconjunto).

Script: `scripts/cierre-2026-09/pendientes-de-nota.ts`.

### [ ] EVE-11 · Google Wallet y Apple Wallet

Que el pase del evento se pueda guardar en la billetera del teléfono, en vez de
depender del QR en un correo. Las dos plataformas piden cuenta de desarrollador
y firma de los pases; hay que ver el costo y quién administra las credenciales
antes de escribir código.

### [ ] FIN-5 · Tilopay

Pasarela de pago. Hay que revisar qué reemplaza y qué convive con lo que ya
existe, y si entra en el mismo flujo que FIN-4.

## Fase 14 — Pedido el 2026-09-10 (tarde)

> Nota 2026-09-15: REP-2 quedó HECHO — existen `SemanaDetallePanel` y el deep link
> `?semana=`. (La nota del 2026-09-10 decía lo contrario y ya no aplica.)

### [~] LINT-1 · De 93 a 57 warnings — quedan los hooks paginados

Van cuatro tandas (93 → 70 → 60 → 57). El techo del gate bajó a **57**.

**Tanda 4 (2026-09-22): los tres de `react-hooks/purity`.** Eran tres
`Date.now()`, y resultaron ser dos cosas distintas.

**Dos eran un bug de verdad, no un detalle de pureza.** El de "grupos que
cierran en 30 días" y el de "hace X minutos" del dashboard leían el reloj
DENTRO de un `useMemo`, que solo se recalcula cuando cambian los datos. O sea
que el valor se congelaba: un dashboard abierto toda la mañana seguía diciendo
"hace 2 min" de algo de hace tres horas, y la ventana de 30 días no se movía
aunque pasara la medianoche. Se arreglaron con `useReloj` (`useHoyCR` y
`useMinutoActual`), que vuelve el tiempo un valor reactivo.

El hook se re-renderiza lo mínimo, y eso es lo que hay que cuidar: el tic
interno es de 30 s, pero lo que React compara es la INSTANTÁNEA. `useHoyCR`
devuelve un `'YYYY-MM-DD'` —render solo a la medianoche— y `useMinutoActual`
redondea al minuto. Sin ese redondeo serían dos renders por minuto en cada
pantalla. Un solo temporizador compartido para todos los suscriptores, y
ninguno si nadie está suscrito.

**El tercero era un falso positivo.** El `Date.now()` del escáner de QR está en
`handleScan`, que es el manejador del evento y no corre en render. Ahí leer el
reloj es lo correcto: es el antirrebote que evita registrar dos veces el mismo
QR cuando la cámara lo lee en ráfaga. Queda con un `eslint-disable` de una sola
línea y el porqué escrito — un valor estable rompería el antirrebote, que es lo
contrario de lo que la regla busca.

**La pieza nueva es `useCargaRemota`** (`src/hooks/`), con la regla pura y
testeada en `lib/hooks/estado-de-carga.ts`. La idea: se guarda UN estado con el
SELLO de la petición que lo produjo, así que "cargando" es una comparación —"lo
que tengo no es de la petición que quiero"— y no un booleano que alguien tiene
que acordarse de apagar. De paso desaparece la clase entera de bug en que
`loading` se queda en true porque una rama del `try` se olvidó del `finally`.

Migrados (10 hooks, −10 avisos): useForms, useEmployees, useCommunications,
useStudyPlans, useGroup, useEventTypes, useMember, useFinance, useServers,
useStudies. Ninguno cambió la forma de lo que devuelve, así que **ninguna
pantalla se tocó**.

**Dos cosas que casi se rompen en silencio y ahora tienen test:**
 · `recargar()` devuelve una PROMESA. Hay pantallas que hacen `await refetch()`
   y recién después navegan (p. ej. editar un grupo); con un recargar que solo
   dispara y se olvida, la navegación pasaba antes de que llegaran los datos.
   Lo cazó el compilador, no yo.
 · La CLAVE tiene que ser un string estable. Un objeto o un `?? []` cambia de
   identidad en cada render y deja la pantalla en bucle. Hay un test que revisa
   todas las llamadas y un inventario explícito de las claves de hoy.

**Lo que falta (60):**
 · **57 `set-state-in-effect`.** Los hooks que quedan son los PAGINADOS
   —useDonations, useMembers, usePaginatedList, useEvents, useDashboard,
   useDirigentes—: acumulan páginas con `setDatos(prev => [...prev, ...])`, que
   no encaja con un estado derivado y pide pensar el caso aparte. El resto son
   ~45 avisos repartidos en pantallas, cada uno con su forma propia (sincronizar
   un formulario con lo que llegó, resetear un filtro): no hay una pieza que los
   cubra a todos.
 · **3 `purity`**, que son `Date.now()` en render y hay que hacerlos junto con
   estos: anclar el reloj pide guardarlo en estado desde un efecto, o sea un
   `set-state-in-effect` nuevo.

**Ojo con el camino corto**: reordenar el async NO los apaga. Está comprobado
que la regla marca igual un `useCallback` async cuyo único `setState` va después
del `await`, y solo se calla si el `setState` vive dentro de un `.then(...)`.
Convertir `await` en `.then` sería maquillaje —el `setState` corre en el mismo
tick— así que el arreglo real es derivar el estado o moverlo a un manejador.

**Verificación pendiente:** tsc, lint, los tests y el build pasan, y la regla
pura tiene sus tests, pero **no hay render tests en el repo** (vitest corre en
`node`), así que los 10 hooks no se probaron contra el navegador. Conviene
abrir una vez cada pantalla afectada: estudios, finanzas, servidores,
comunicaciones, empleados, formularios, la ficha de un miembro y tipos de
evento.

## Fase 16 — Pedido el 2026-09-14

### [~] FAM-2 · Familias desde CCB + reglas de menores — PARTE A HECHA · PARTE B EN PAUSA, esperando correos

> **EN PAUSA hasta que CHK-5 junte los correos (decidido 2026-09-22).** Lo que
> falta de la parte B no se puede empezar: los 3 que califican para la
> invitación no tienen correo, y de los 65 que cumplieron 18 solo 1 lo tiene.
> No hay cómo invitarlos. El camino es la puerta: CHK-5 le pide el correo a
> todo adulto que no lo tenga, así que esto se destraba solo a medida que la
> gente vaya pasando por el check-in. **No retomar hasta entonces.**


**PARTE A · APLICADA 2026-09-15.** De las 1.578 familias de CCB, 1.210 ya
estaban completas. Se crearon **205 familias** y se sumaron **191 personas** a
familias existentes; cero fusiones de hogares, porque el diagnóstico no
encontró ninguna familia repartida en dos unidades. 31 personas de CCB no
tienen ficha y se reportaron sin crearlas
(`data-import/familias-sin-ficha-2026-09-15.csv`).

De 1.379 unidades y 3.465 integrantes se pasó a **1.584 y 4.124**. El script
aborta con rollback si alguien quedara en dos familias.

Gotcha: dos filas de CCB pueden resolver a la MISMA ficha (dos registros que
después se fusionaron acá). Se deduplican conservando la posición más
específica; si no, el insert choca contra el único de `family_members`.

**PARTE B · el código, HECHO:**
 · A un menor no se le crea cuenta. El guard vive DENTRO de
   `inviteMemberToCompleteProfile`, que es por donde pasan los tres caminos que
   crean cuentas; el endpoint además responde 403 con `menor_sin_cuenta`, y la
   ficha explica por qué en vez de esconder el botón.
 · Correo y teléfono dejan de ser obligatorios para menores. **Se unificó el
   umbral**: `EDAD_MINIMA_PARA_CUENTA` era 12 (AUTH-1) y ahora es la mayoría de
   edad. Con dos umbrales, a un chico de 15 el endpoint le negaba la cuenta
   mientras el formulario le seguía exigiendo el correo que servía para crearla.
 · Sin fecha de nacimiento (3.260 fichas) NO se asume menor: bloquear por las
   dudas rompería el alta de miles de adultos. Quedan en el reporte.

**PARTE B · lo que falta, y es decisión del usuario:**
 · [x] **166 teléfonos y 1 correo prestados** — APLICADO 2026-09-15. Los
   menores con teléfono propio bajaron de 461 a 295 y el correo de 256 a 255.
   Verificado después: **cero** teléfonos de menor siguen siendo iguales a los
   de un adulto de su familia. Lista en
   `data-import/menores-datos-prestados-2026-09-15.csv`.
 · [x] **197 menores con cuenta** — RESUELTO 2026-09-15. Las 196 de chicos de
   12 a 17 años, ninguna usada jamás, quedaron deshabilitadas con un ban largo:
   no se borran ni se desligan, así que al cumplir 18 basta con quitar el ban
   (borrarlas dejaría el correo ocupado por un usuario huérfano).
   La 197 no era lo que parecía: la "cuenta de menor" de Miguel Andrés Álvarez,
   8 años, tenía el correo de su mamá Karin Buscemi y el login era de ELLA,
   que no tenía cuenta propia porque ese usuario le ocupaba el correo.
   Deshabilitarla la habría dejado sin acceso: se le MUDÓ la cuenta a su ficha.
 · [~] **66 cumplieron 18 sin cuenta** en el último año. Nada automatizado, como
   pide el brief — `data-import/cumplieron-18-sin-cuenta-2026-09-15.csv`.

   **Filtro decidido el 2026-09-18:** solo se invita a quien haya asistido a una
   charla al menos DOS veces en 2026. Medido (`scripts/fam2/charlas.cjs`):
   **solo 4 califican** —Salome Bermudez 14×, Jose Ángel Guido 5×, Camila Chaves
   3×, Gabriel Gonzalez 3×—. Seis fueron una vez y 56 ninguna.

   **Y ninguno de los 4 tiene correo.** No es casualidad: solo 1 de los 66 lo
   tiene. Es consecuencia directa de este mismo pendiente —se les quitó el correo
   POR SER MENORES— y ahora deja incomunicados justo a los que se quiere invitar.
   La invitación no se puede mandar hasta conseguirlo: Camila y Gabriel tienen
   familia con correos de adultos a quienes pedírselo (no usarlos para la cuenta:
   es el enredo de Miguel Andrés y Karin Buscemi); Salome y Jose Ángel tienen
   teléfono propio.

   Esto se repite cada mes: cada quien que cumple 18 queda sin correo por diseño.
   Valdría la pena avisarlo al cumplirlos en vez de descubrirlo un año después.
 · [ ] Quedan **281 menores sin familia vinculada**, o sea sin vía de contacto.
   Se cruza con DAT-8. **Pero 48 de esos probablemente NO son menores**: tienen
   la fecha de nacimiento mal (pista del usuario, 15-set). Las señales, en
   `scripts/familias-2026-09-15/menores-con-fecha-sospechosa.cjs` y el CSV
   `data-import/menores-fecha-sospechosa-2026-09-15.csv`:
     · **33 llevaron estudios de adulto.** Marietta Hernández figura con 7 años
       y completó Nivel 1, 2, 3 y 4; Cindy Marín con 9 y lleva cinco estudios.
     · **14 tienen cédula registrada.** A un menor casi nunca se le anota, y la
       de Valeria Sánchez (5 años) es 19554062 — formato viejo, de otra época.
     · **19 tienen la fecha de nacimiento A DÍAS de cuando se creó su ficha.**
       Daniela Céspedes "nació" el mismo día que se registró y Vanessa Fernández
       un día antes. No son recién nacidos: es la fecha de REGISTRO metida en el
       campo de nacimiento.
   **Los 19 del último grupo quedaron con la fecha VACÍA (aplicado 2026-09-15).**
   La fecha real no está en ninguna fuente, y una falsa hace daño activo: les
   quita la cuenta y los saca de los formularios que piden correo. NULL solo
   dice la verdad. Los 19 tienen correo o teléfono propio —varios corporativos,
   `bzuniga@specialized.co.cr`, `fherrera@jaamcr.com`— y 8 llevaron estudios:
   ninguno es un bebé. Sin esa segunda señal no se tocó a nadie, porque una
   iglesia sí registra recién nacidos. Menores activos 1.107 → 1.088, menores
   sin familia 281 → 262.

   Respaldo en `data-import/fechas-vaciadas-2026-09-15.csv` **y solo ahí**: el
   trigger `audit_members` guarda `old_data` en null, así que para un vaciado el
   audit_log no sirve de respaldo. Comprobado sobre este mismo cambio.

   **Regla del usuario (15-set): con estudios NO se puede tener menos de 12 —
   los estudios arrancan a esa edad, "eso ni aplica".** Con eso se vaciaron 7
   fichas más, en TODO el padrón y no solo las sin familia. Cuatro tienen prueba
   propia además de la regla: se matricularon con menos de 3 "años" de edad —
   Cindy Marín figura nacida el 2017-03-18 y matriculada el 2017-06-01, tres
   meses después. Menores activos 1.088 → 1.081.
   `data-import/fechas-vaciadas-por-estudios-2026-09-15.csv`.

   Samantha Cubillo dio una vuelta: se revirtió y se volvió a vaciar. El usuario
   confirmó que los estudios (Nivel 1, 2, 3 y Transformados) SÍ son de ella, así
   que la que está mal es la fecha. Es la única de las 7 sin prueba propia —las
   otras seis se matricularon con 3 años o menos— y por eso valía preguntarla.

   Quedan **~22 con señales de adulto** (cédula, o estudios pero con 12+ años)
   sin una prueba dura: esos hay que preguntarlos uno por uno.

### [ ] DAT-9 · `member_por_external_id()` existe y nadie la llama

La función y la regla en AGENTS.md quedaron listas el 2026-09-15, pero hoy no
hay ningún import de CCB dentro de `src/` que la use — son todos scripts
puntuales. Cuando se escriba el próximo import, tiene que entrar por ahí.

**No es trabajo pendiente: es una nota para el próximo import.** SEC-3
(2026-09-17) la dejó ejecutable solo con la llave de servicio, que es como la
llamaría ese import de todos modos.

## Fase 21 — QA integral (pedido 2026-09-22, reordenado el mismo día)

**Orden decidido por Floriana**: NO se re-siembran cuentas de prueba en producción.
Primero lo que no necesita cuentas (QA-1), después staging (INF-1) con las cuentas
sembradas ahí, y desde staging el QA autenticado completo (QA-2).

### [ ] QA-2 · QA autenticado completo, desde staging (después de INF-1)

Con las cuentas de staging: axe + mobile + teclado sobre las pantallas de cada módulo,
y el recorrido heurístico por rol (dirigente cerrando grupo, finanzas aprobando pagos,
encargado en la puerta, miembro matriculándose desde el celular): ¿sé dónde estoy? ¿sé
qué hacer? ¿el error me dice cómo salir? ¿cuántos clics costó? El prompt se detalla
cuando staging exista, sumando lo aprendido en QA-1.

### [ ] QA-3 · Auditoría de código: endpoints, llamados a la BD y rendimiento

No necesita cuentas ni staging — es sobre el código. Puede correr en paralelo con QA-1.

Prompt para Claude Code:

```
QA PARTE 3 · Auditoría de código: los ~340 endpoints y sus llamados a la base

MISMO ESPÍRITU QUE QA-1: LEVANTAR EL MAPA, NO ARREGLAR. Informe a
docs/qa-2026-09/informe-codigo.md, hallazgos CRÍTICO/MEDIO/MENOR con archivo:línea y fix
propuesto de una línea. Los fixes salen después en tandas.

1. CENSO DE ENDPOINTS (todo src/app/api/**): tabla ruta → método → autorización
   (requireRoles/requireModuleView/ninguna) → validación de entrada (zod/a mano/ninguna)
   → cuántas consultas a la BD hace. Marcar: endpoints SIN autorización (crítico salvo
   los públicos a propósito — cotejar con PUBLIC_PREFIXES), sin validación de entrada,
   y los que no usan reportarError en sus catch.

2. PATRONES DE BD CAROS — buscar sistemáticamente:
   - N+1: consultas dentro de loops (for/map con await de supabase adentro).
   - El bug de las 1.000 filas de PostgREST (ya mordió en REP-7): TODA consulta que pueda
     devolver >1.000 filas sin .range()/paginación — censarlas, es un patrón repetido.
   - SELECT * o embeds anchos donde se usan 2 campos; consultas sin filtro de sede/estado
     que traen el padrón entero al server para filtrar en JS.
   - Consultas repetidas en el mismo request (mismo dato pedido 2+ veces sin caché).
   - Falta de índices: cruzar las columnas más filtradas/ordenadas en queries contra los
     índices del baseline SQL; listar candidatos con su consulta de evidencia.
3. RENDIMIENTO DE PÁGINA (estático): páginas que cargan todo al montar sin paginación,
   imports pesados que entran al bundle del cliente (revisar con next build --profile o
   @next/bundle-analyzer si está), useEffect en cascada (patrón que ya costó renders en
   matrícula).
4. HALLAZGOS TRANSVERSALES: código muerto evidente (exports sin importadores en src/),
   duplicaciones de reglas de negocio (la misma regla escrita en dos lados — riesgo de
   divergencia, como pasó con las definiciones de donante), y TODOs/FIXMEs con más de un
   mes.
MEDIR ANTES DE AFIRMAR (regla de la casa): cada hallazgo de rendimiento con evidencia
(conteo de filas, número de consultas por request, tamaño de bundle), no impresiones.
```

## Fase 23 — Reuniones de estudios y dirigentes (2026-09-24, dos llamadas grabadas)

Decisiones tomadas con Yeya, Fabiola (dirigentes) y Ariana (estudios). Minuta
completa en `docs/minutas/estudios-2026-09-24.md`. Orden sugerido: RET-1 y
SRV-10 son urgentes (privacidad); EST-14 es el grande y se prueba en staging
antes de producción (dicho en la reunión).

### [~] EST-14 · Niveles en dos bloques — FASES 1-3 HECHAS 2026-09-30 · LA TRANSICIÓN LA REVISA FLORIANA CON DENISE

Reglas decididas:
- Matricularse a Nivel 1 cubre N1+N2 (₡5.000): el paso 1→2 sigue automático y
  sin cobro nuevo. Folletos de 1 y 2 se entregan juntos al inicio.
- Al terminar N2 hay CORTE: matrícula nueva para N3+N4 (₡10.000, se paga junto,
  como discípulos). Folletos de 3 y 4 juntos al matricular N3.
- En el CIERRE de N2 el dirigente responde: "¿El grupo continúa a nivel 3-4?"
  · SÍ → se crea el grupo sucesor (mismo dirigente/horario/zona), los
    estudiantes actuales quedan matriculados automáticamente CON su cobro de
    ₡10.000 generado, y los cupos libres quedan en matrícula abierta ~2
    semanas (el break decidido entre N2 y N3). Inicio del grupo: fecha que
    elige el dirigente.
  · NO → el grupo cierra y NO se genera el N3: queda a mano del comité de
    estudios crear los grupos correspondientes para esos estudiantes. Al
    cerrarse así, el sistema manda UN CORREO INTERNO al comité de estudios y
    de dirigentes (roles coordinador_estudios y coordinador_dirigentes)
    planteando el cierre y la necesidad de crear un grupo nuevo en la misma
    zona, con los datos que necesitan para decidir: grupo cerrado, dirigente
    (que no continúa), zona/horario, y la lista/conteo de estudiantes que
    quedaron sin sucesor. Correo interno de operación — no toca a los
    miembros y respeta EMAIL_SILENT_MODE con el mismo criterio de los avisos
    internos existentes. Los estudiantes luego se matriculan por la oferta
    abierta de niveles 3 (lista tipo capacitaciones).
- La creación automática de grupo sucesor queda SOLO para 1→2 y 3→4. De 2→3
  únicamente vía "el grupo continúa".
- FOLLETOS — ajustar el proceso completo al esquema nuevo:
  · El cierre N1→N2 y N3→N4 NO genera pedido de folletos (ya los tienen: se
    entregan en pares 1+2 y 3+4 al matricular).
  · El disparador de folletos pasa a ser la MATRÍCULA de cada bloque: grupo
    de N1 (folletos 1+2) y grupo de N3 (folletos 3+4) — mismo mecanismo
    actual de generación por cupo lleno / fin de matrícula, pero con el par
    de folletos del bloque.
  · Cuando el dirigente dice SÍ en el cierre de N2, el grupo N3 generado
    entra al flujo de folletos normal (3+4) con sus matriculados automáticos
    + los que entren en las 2 semanas de cupos libres.
  · Revisar el bloque/lote de folletos (folleto-blocks) y el tiquete del
    dirigente para que cuenten pares, no niveles sueltos.
- El registro del estudiante conserva niveles individuales (N1, N2, N3, N4
  por separado — clave para reubicaciones y elegibilidad).
- TRANSICIÓN: los grupos en curso siguen el esquema viejo; los que arrancan
  ahora (octubre) entran al nuevo. Los ~11 grupos de N2 actuales: contacto
  puntual a sus dirigentes (Ari/Fabi). Quienes pagaron paquete completo
  (₡13-15k): lista para ajuste de finanzas (pinpoint, son poquitos).

Prompt para Claude Code: (armarlo conmigo cuando se vaya a correr — es
grande y toca planes, precios, folletos, cierres y matrícula; el diseño de
arriba es la spec. DRY-RUN de los cambios de catálogo de planes y staging
antes de producción.)


**Lo medido antes de empezar, que cambió el alcance:**

- El total no cambia: hoy son ₡5.000 al entrar a N2, N3 y N4 = ₡15.000, y con
  bloques son ₡5.000 + ₡10.000 = lo mismo. Cambia CUÁNDO se paga, no cuánto.
- **«Quienes pagaron paquete completo (₡13-15k)» NO era de niveles**: esos
  ₡15.000 son de DIS1 (38 pagos). En niveles nunca hubo un pago así.
  Confirmado por Floriana — esa parte de la transición salió del alcance.
- Son **10** grupos de N2 vivos, no ~11, con 81 estudiantes. De esos 81,
  **ninguno** había pagado en N1 y solo 2 de 25 cobros de N2 estaban pagados.

**FASE 1-2 · El corte y el cobro por par.** El catálogo NO se toca (decisión
de Floriana): lo que se mueve es cuándo se cobra. El monto se SUMA del
catálogo en vez de escribirse, así que si mañana sube un nivel el bloque sube
solo — un ₡10.000 a mano se quedaría viejo sin que nadie lo note.

Cerrar N2 exige responder si la cohorte continúa, sin default ni siquiera
«sí»: un default reproduce el problema que esto resuelve, que hoy el sucesor
se crea SIEMPRE y aparecen grupos de N3 que nadie pidió con gente matriculada
y cobrada. Si dice que no, le llega un correo a coordinación de estudios y de
dirigentes con los datos para armar el grupo.

**EL ERROR MÁS CARO ESTABA ESCONDIDO:** el cobro del paso automático se genera
en `payments.ts`, no en el cierre. Con `np.cost` a secas, pasar de N1 a N2
cobraba ₡5.000 POR SEGUNDA VEZ. No se veía leyendo el endpoint.

**FASE 3 · Folletos en pares.** Un tiquete POR FOLLETO: un grupo de N1 pide
N1 y N2, uno de N3 pide N3 y N4, y N2/N4 no piden nada. **El cierre no hizo
falta tocarlo** — ya pedía los folletos del grupo SUCESOR, y como el sucesor
de N1 es un N2 que no pide nada, el pedido por cierre desaparece solo para
1→2 y 3→4; y cuando el dirigente dice que sigue, el sucesor es un N3 que pide
el par. Las dos reglas del ítem salieron de una función.

El índice único pasó de `(source_group_id)` a
`(source_group_id, target_level_code)`. Sin eso el segundo tiquete del par
chocaba con 23505 y el código lo trataba como «ya existe»: el grupo se
quedaba con el folleto de N1 y sin el de N2, EN SILENCIO. Probado en staging:
acepta el par y sigue rechazando el duplicado.

**FASE 4 · UN BUG DE TRANSICIÓN QUE EL ÍTEM NO PREVEÍA.** Los grupos que
arrancaron con el esquema viejo pidieron UN folleto. Con bloques, el del
nivel siguiente ya no se pide al cerrar —se asume entregado al empezar—, y
para un grupo que empezó antes esa suposición es falsa.

**7 grupos de Nivel 3 en curso, 42 estudiantes, se quedarían sin el folleto
de Nivel 4.** Antes lo habrían recibido por el cierre.

El dry-run está en `scripts/est14/folletos-de-transicion.cjs`. **No se
aplicó**: crea tiquetes de verdad que alguien tiene que imprimir. Floriana lo
revisa con Denise antes (2026-09-30).

Un detalle para esa conversación: el grupo de **Tatiana Quirós** (3
estudiantes) tiene escrito «Ya ella tiene los folletos!!» en el campo de sede
de entrega, así que probablemente no necesita nada y quedan **6 grupos, 39
estudiantes**. Los grupos de N1 vivos no tienen el problema — ninguno tiene
tiquete todavía, así que cuando se disparen ya piden el par completo.

Trece cebos muerden entre las tres fases, incluidos los dos modos de fallo
caros: que se cobre dos veces y que las capacitaciones se vuelvan gratis.

**FASE 5 · EL CONTEO PARA IMPRIMIR ESTABA DESFASADO (2026-10-01).** El reporte
de hitos decía «Conteo definitivo: X folletos», pero X salía de `count(*)`
sobre MATRÍCULAS. Con un folleto por estudiante coincidía; con pares, no, y
fallaba en las DOS direcciones a la vez: un grupo de N1 con 10 estudiantes
reportaba 10 cuando necesita 20 —se imprimía la mitad—, y uno de N2 seguía
contando aunque esos folletos ya se habían entregado al matricular N1 —se
imprimía de más—. Ni siquiera se compensaban de forma predecible.

Ahora el desglose es UNA LÍNEA POR FOLLETO, como lo pidió Floriana: un grupo
de Nivel 1 aparece dos veces, con el folleto de 1 y el de 2 por aparte, y los
de N2/N4 no aparecen. La regla de qué pide cada nivel NO se reescribió: se
reusa `folletosQuePide`, la misma que crea los tiquetes, porque dos copias se
separarían el día que cambien los bloques y entonces la cola y el conteo de
impresión dirían cosas distintas sin que nadie lo note.

El correo cambió de vocabulario: la columna dice «Folleto» y no «Nivel», y el
total dice «folletos a imprimir» y no «personas matriculadas» — era esa frase
la que hacía confiar en un número que significaba otra cosa.

**Y UNA CORRECCIÓN AL PÁRRAFO DE ARRIBA, medida después de escribirlo:** hoy
esto NO estaba imprimiendo de menos, porque los 63 grupos de Nivel vivos
tienen `bloque_id` NULO y por lo tanto nunca aparecieron en ese reporte. El de
hitos cubre solo capacitaciones (SCJ, Discípulos, Hermenéutica…): en los dos
bloques abiertos el total da 218 antes y 218 después. El desfase era real en
el código y habría mordido apenas un grupo de Nivel entrara a un bloque, pero
no hubo daño.

Para los niveles, el camino que SÍ opera hoy es la cola de folletos
(`folleto_requests`, 16 tiquetes vivos y todos de niveles), que la fase 3 ya
dejó con un tiquete por folleto.

**LOS GRUPOS DE NIVEL NO PERTENECEN A NINGÚN BLOQUE, Y ES A PROPÓSITO**
(confirmado por Floriana el 2026-10-01). No salen en el conteo por sede que
se le manda a quien imprime; su camino es la cola de folletos.

Y no depende de la suerte de las fechas: el trigger `assign_group_bloque` los
excluye por código —N1, N2, N3, N4, DIS2 y DIS3— y les fuerza `bloque_id`
NULL. Queda fijado con un test, porque esa lista se lee como una omisión
—«¿por qué estos seis no entran?»— y el arreglo aparente sería borrarla. Si
alguien lo hace, los folletos de los niveles se contarían DOS veces: una por
la cola y otra por el reporte de hitos, y quien imprime recibiría el doble
sin que nada falle.


## Fase 24 — Rediseño de vacantes → puestos de servicio (reunión de servidores, 2026-09-25)

Reestructuración completa del flujo de vacantes, dictada por Floriana.

**MAPA DE ACCESOS (aclarado 2026-09-25)** — los puestos YA EXISTEN en el
comité de servidores (área de staff); lo nuevo son los accesos/roles que se
les asocian automáticamente (position-role-sync + source):

| Puesto existente (comité servidores/staff) | Acceso nuevo que otorga |
|---|---|
| Colaborador de solicitud de puestos | Página "Solicitudes de puestos de servicio" (SRV-12) y vista por comité del solicitar (SRV-11) |
| Colaborador de aplicaciones | Página "Aplicaciones" (SRV-14) |
| Colaborador de seguimiento | Página "Aplicaciones" (SRV-14) |

Además: **coordinador_servidores** (el encargado del comité de servidores)
tiene acceso a TODAS las páginas del menú de servidores y sus funciones, por
default. **admin** y **direccion** siempre, dirección como vista. Verificar
los nombres exactos de los tres puestos en el catálogo antes de fijar los
mapeos.

### [x] DIR-7 · Página "Los que no volvieron" para dirigentes (pedido 2026-09-28) — HECHO 2026-10-05

Seguimiento de exalumnos que dejaron de venir: cada dirigente ve, de los
grupos que ÉL dio (histórico), quiénes no han vuelto a Theos — y los contacta
por WhatsApp con un mensaje preparado.

Prompt para Claude Code:

```
FEATURE · Página de seguimiento para dirigentes: mis estudiantes que no volvieron

DÓNDE Y QUIÉN (actualizado 2026-10-01): vive DENTRO de /reportes — es un reporte.
- El DIRIGENTE accede y ve SOLO sus propios exalumnos (de grupos que dirigió o
  co-dirigió, actuales e históricos). Server-side: el endpoint recorta por el dirigente
  autenticado (patrón studies-scope); 403 si pide otro dirigente.
- Quien tiene el rol/módulo de REPORTES (más admin/direccion) puede ELEGIR un dirigente
  con un selector y ver su reporte específico — el mismo patrón de "Mi comité"+SRV-6
  (selector solo para roles amplios, sin aflojar el candado del dirigente; sin dirigente
  elegido no se carga nada, como SRV-6).
- La tarjeta en el índice de /reportes se muestra a dirigentes con histórico y a los
  roles amplios (patrón de índice filtrado por rol existente).

DEFINICIÓN "no volvió" (función pura testeable, ej. lib/reports/no-volvieron.ts):
persona SIN ningún check-in a charla NI matrícula/participación en estudio en los
últimos 6 MESES. Reutilizar las piezas de REP-5/REP-6 (check-ins a charlas, actividad)
— no reinventar. Excluir: fallecidos/inactivos marcados, datos [prueba], y quienes son
servidores activos (sirven aunque no lleven estudio — no están "perdidos").

LISTA (una fila por exalumno perdido):
- Nombre.
- Grupo en el que fue su estudiante y AÑO (si estuvo en varios grupos del mismo
  dirigente, el más reciente).
- Resultado: aprobó / no aprobó / sin resultado (el dato del cierre).
- Teléfono como ENLACE de WhatsApp: https://wa.me/506XXXXXXXX (normalizar el número:
  quitar guiones/espacios; si ya trae código de país no duplicar el 506; sin teléfono →
  "—" sin enlace).
- El enlace de WhatsApp abre con MENSAJE PRE-LLENADO (parámetro ?text= URL-encoded)
  usando la plantilla definida abajo con el nombre de la persona y del dirigente.
- Orden: por año descendente. Conteo arriba ("Tenés N personas por reconectar").

PLANTILLA DEL MENSAJE (una sola, central y editable en el código con comentario; los
placeholders {{nombre}} y {{dirigente}} se rellenan al armar el enlace):
"Hola {{nombre}}! Soy {{dirigente}}, de Theos — compartimos el estudio hace un tiempo y
me acordé de vos. Hace rato no te vemos por acá y quería saludarte: ¿cómo has estado?
Si en algún momento querés retomar un estudio o ir a una charla, las puertas están
abiertas y me encantaría verte. Un abrazo."

PRIVACIDAD: el dirigente solo ve nombre/grupo/año/resultado/teléfono — sin correo, sin
perfil (consistente con GRU-3: nunca enlace al perfil). Sin export en esta versión (la
lista es para contactar uno a uno, no para sacar bases de datos).
RENDIMIENTO: SQL agregado sobre el histórico (168k+ check-ins) — nada de N+1.
Entrada de menú visible a dirigentes con histórico, admin y direccion.
SEGUIMIENTO POR PERSONA (agregado 2026-09-28) — marcar el resultado del contacto,
fácil y sin escribir mucho:
- Cada fila tiene una acción "Registrar contacto" con opciones de UN toque (radio/chips,
  no texto libre obligatorio):
  · "Ya le escribí — sin respuesta aún"
  · "Quiere volver" → sub-opción opcional: ¿a qué? (charla / retomar estudio / evento)
  · "Se cambió de iglesia" → campo de texto OPCIONAL "¿a cuál?"
  · "No quiere volver"
  · "Número equivocado / no es la persona"
  Más un campo de nota opcional (una línea).
- Se guarda por persona: estado, quién lo marcó (el dirigente), cuándo, y el historial de
  contactos si se marca más de una vez (no sobreescribir — es seguimiento).
- La fila cambia de aspecto según el estado (pendiente / contactado / resuelto) y hay
  filtro rápido por estado ("solo pendientes de contactar").
- "Quiere volver" es accionable: esas personas salen destacadas y en una vista/conteo
  para dirección y coordinación (son a quienes hay que abrirles la puerta: avisar cuando
  abra matrícula de lo que pidieron — la automatización de ese aviso queda para después,
  por ahora solo la lista).
- Los datos alimentan decisiones: en la vista de admin/dirección, resumen agregado por
  resultado (N sin respuesta, N quieren volver, N cambiaron de iglesia — con la lista de
  cuáles iglesias—, N no quieren). Sin correos automáticos a nadie.

Tests: definición (actividad hace 5 meses no aparece, 7 meses sí; servidor activo
excluido), recorte por dirigente (403 a otro), enlace wa.me bien formado con y sin
teléfono, registrar contacto guarda historial (dos marcas = dos entradas) y el filtro
por estado. tsc/lint/vitest.
```

### [ ] DAT-14 · Histórico completo de process queues de CCB (pedido 2026-09-28)

**LA REGLA, dicha por Floriana**: *solo deberían existir cierres o aprobaciones
de personas que tienen process queue en CCB. Si estuvieron en un grupo y
después las sacaron, eso no es una reprobación — fue un error de haberlas
unido al grupo.*

Es la fuente de verdad que falta. Hoy se está inferiendo lo mismo por un
camino más débil —«sin asistencia y sin pago, nunca estuvo»— y acierta, pero
no prueba nada.

**POR QUÉ HACE FALTA, medido el 2026-09-28**

- **453 personas en 140 grupos** quedaron en `en_revision` con el grupo ya
  cerrado: ni aprobadas ni reprobadas. Las 453 tienen **cero asistencia y cero
  pagos**, sin una sola excepción, y **445 se crearon el 18-jul-2026 a las
  18:53** — la huella exacta de la carga masiva de CCB. No son descuidos de
  dirigentes: son datos que llegaron incompletos. Van de 2019 a 2025.
- Los 8 casos de 2026 se resolvieron uno por uno ese día y **7 de 8 resultaron
  ser matrículas que nunca debieron existir**. El patrón se repite.
- El archivo que tenemos, `ccb-graduaciones-2026-08.csv`, **solo cubre
  mayo–agosto de 2026** (760 filas: 690 aprobados, 70 reprobados). No alcanza
  para validar nada anterior.
- Y ya muestra desajustes en el período que sí cubre: de **27 reprobados** del
  sistema entre mayo y agosto, **22 tienen process queue en CCB y 5 no**. Esos
  5 son candidatos a ser errores de unión, no reprobaciones.

**QUÉ HAY QUE EXPORTAR DE CCB** (lo hace Floriana; acá no hay acceso):

Todos los process queues **desde el inicio**, no un rango. Mismas columnas que
el export de agosto, que ya sirven:

| Columna | Para qué |
| --- | --- |
| `external_id` | **La llave del cruce.** Sin esto el archivo no sirve. |
| `individual_name` | Solo para leerlo con ojos humanos, NUNCA para cruzar. |
| `queue_name` | Qué estudio (incluye los «Reprueba …»). |
| `resultado` | aprobado / reprobado. |
| `status` | Done / Not Started. |
| `fecha_due` | Para ubicar en el tiempo y cruzar con el grupo. |

**EL CRUCE SE HACE POR `external_id` Y CON `member_por_external_id()`**, nunca
contra `members.external_id` a secas ni por nombre — es la regla de AGENTS.md,
y existe porque la fusión de duplicados deja el external_id en la ficha muerta:
buscar directo devuelve la persona inactiva. En esta misma sesión aparecieron
dos casos que lo confirman (un duplicado `merged` de Ravel Rodriguez, y dos
Jorge Badilla que son personas distintas).

Prompt para Claude Code, cuando el archivo esté:

```
DATOS · Conciliar el histórico de estudios contra los process queues de CCB

Entrada: data-import/ccb-process-queues-historico.csv (external_id, individual_name,
queue_name, resultado, status, fecha_due).

1. Cruzar por external_id con member_por_external_id(). Reportar cuántos no resuelven
   y no adivinar por nombre: con cero o con dos coincidencias, se reporta y no se toca.
2. Tabla de conciliación, sin escribir nada todavía:
   · en el sistema y en CCB, mismo resultado  → ok
   · en el sistema y en CCB, resultado DISTINTO → revisar a mano, listar
   · en el sistema y NO en CCB                → candidato a «error de unión al grupo»
   · en CCB y NO en el sistema                → cierre que nunca se registró
3. Las `en_revision` sin process queue: proponer 'cancelada' (matrícula que no debió
   existir), NO 'dropped' — ver lib/studies/baja-matricula.ts, la diferencia importa
   porque el historial es el expediente de una persona.
4. Los `reprobado` sin process queue: mismo criterio, pero listarlos aparte para que
   Floriana los confirme uno por uno — quitarle una reprobación a alguien que sí la
   tuvo es peor que dejarla.
5. Dry-run con rollback y respaldo de las filas antes de aplicar. Medir primero.
Tests: el cruce con duplicado fusionado devuelve la ficha VIVA; cero y dos coincidencias
se reportan sin tocar; 'cancelada' ≠ 'dropped'. tsc/lint/vitest.
```

Cierra lo que [~] DAT-5 dejó abierto y le da respaldo real a la limpieza.

### [ ] FIN-11 · Viáticos y kilometraje: flujo digital del reglamento de viajes (pedido 2026-09-29)

Base: `Anexos_Reglamento_Viajes_Asociacion_THEOSPLACE_Version1.docx` (5 anexos
operativos, versión 1.0 del 05/05/2026 — reglamento EN PROCESO FINAL de
aprobación por Junta Directiva: **no correr hasta que esté aprobado**, y
parametrizar tarifas/montos porque pueden cambiar en la aprobación).

DISEÑO: un solo flujo "Viaje" con etapas, no 5 formularios sueltos. Cada viaje
es un expediente que avanza:

  solicitud → presupuesto → aprobación → (anticipo) → viaje →
  liquidación → reintegro/reembolso → informe → cerrado

Mapa de los anexos al sistema:
1. **Solicitud de viaje (ANX-01)** — formulario digital: los datos personales
   (nombre, cédula, puesto, comité, correo, teléfono) SE AUTOLLENAN de la
   ficha, no se piden. Tipo (trabajo/capacitación, nacional/internacional),
   destino, fechas/horas, acompañantes, justificación (objetivo, agenda,
   beneficio, resultado esperado), fuente de financiamiento, anticipo sí/no y
   monto, centro de costo. Adjuntos (agenda/invitación).
2. **Presupuesto (ANX-02)** — tabla de rubros dentro del mismo expediente
   (pasajes, transporte local, hospedaje, alimentación, inscripción, seguro,
   peajes, combustible/km, otros) con cantidad × tarifa = subtotal, POR
   MONEDA (CRC/USD — regla INT-3: jamás sumar entre monedas; total por cada
   moneda). Campos de validación financiera (monto máximo según política,
   anticipo recomendado, disponibilidad verificada) los llena finanzas.
3. **Aprobaciones** — las 3 firmas del papel se vuelven estados con actor y
   fecha (solicitante envía → revisión administrativa/financiera → aprobación
   de autoridad competente). Patrón RequestBoard/tiquetes existente —
   REUTILIZAR. Todo al audit_log.
4. **Liquidación (ANX-03)** — al volver del viaje: anticipo recibido, detalle
   de gastos ejecutados (fecha, rubro, proveedor, nº comprobante, monto) con
   COMPROBANTES adjuntos (mecanismo de comprobantes existente), y el cálculo
   automático de la diferencia: a reintegrar a la Asociación o a reembolsar a
   la persona. Declaración jurada como checkbox con texto del reglamento.
   Plazo de presentación según reglamento (recordatorio in-app, no correo).
5. **Informe de viaje (ANX-04)** — formulario del módulo de formularios
   vinculado al expediente (actividades, resultados, lecciones,
   recomendaciones, evidencia adjunta). No bloquea la liquidación salvo que
   el reglamento diga lo contrario (verificar al aprobar).
6. **Bitácora de kilometraje (ANX-05)** — sección repetible dentro del
   expediente (una fila por desplazamiento: origen, destino, horas, km
   inicial/final con km recorridos calculados) + gastos asociados
   (combustible/peajes/parqueos con comprobante) + tarifa por km AUTORIZADA
   COMO PARÁMETRO del sistema (constante configurable) y monto a reconocer
   calculado.

FASEO SUGERIDO (cada fase corrible por separado):
  A. Expediente + solicitud + presupuesto + estados de aprobación.
  B. Liquidación + comprobantes + cálculo de diferencias.
  C. Bitácora de kilometraje.
  D. Informe (formulario vinculado).
PERMISOS: solicitante ve/edita SU expediente (anti-suplantación
resolveTargetMemberId); finanzas y dirección ven todos; aprobar según el rol
que defina el reglamento. PDF de cada anexo descargable desde el expediente
(para archivo físico/Junta) — con el patrón de PDF de SRV-14.
Los prompts por fase se arman cuando el reglamento esté aprobado y Floriana
confirme tarifas, plazos y quién es "autoridad competente".

## Fase 25 — Reunión TI + Finanzas (2026-09-29, Meli/Andrés/María José)

Minuta en `docs/minutas/finanzas-2026-09-29.md`. Además de los ítems nuevos,
esta reunión ACTUALIZA FIN-9 y FIN-11 (ver abajo) y confirma la meta de
FIN-5/Tilopay: listo en octubre para la fiesta de Navidad (venta ~8 nov).

### [ ] BEC-5 · Solicitud de becas: razones cerradas, monto, estudio puntual y cupo

Prompt para Claude Code:

```
MEJORAS · Formulario de solicitud de beca (decididas con Meli 2026-09-29)

1. RAZÓN como dropdown de 3 opciones ÚNICAS (leyenda: "Solo se aprueban becas por estas
   razones"): Desempleo · Situación de salud · Situación socioeconómica (esta de último).
   Debajo, texto libre OBLIGATORIO para ampliar la situación, cualquiera sea la razón.
2. NOTA de monto: "Las becas de Theos son del 50%. Si necesitás un monto menor, indicalo
   aquí" + campo opcional de monto (wording que invite a pedir MENOS, no más).
3. ESTUDIO PUNTUAL: al solicitar beca de estudio, se elige el GRUPO específico (día/zona/
   dirigente) de la lista de grupos disponibles — no el tipo de estudio. (Eventos ya son
   puntuales.)
4. CUPO — disclaimer al enviar y en el correo de confirmación: "Las becas se analizan la
   última semana de matrícula y dependen del cupo disponible — no des por asegurado el
   campo". (Regla operativa de Meli: aprueba la última semana para priorizar cupo pagado.)
5. SI EL GRUPO SE LLENA mientras la beca está pendiente: el tiquete NO se rechaza — pasa
   a estado "por modificar" y se le notifica al solicitante (campanita + el canal que ya
   use el flujo de becas): "El grupo que elegiste se llenó — entrá y elegí otro para
   mantener tu solicitud". El solicitante puede cambiar el grupo sin crear solicitud nueva.
6. CONVERTIR EN ARREGLO DE PAGO: en el tiquete de beca, acción de finanzas "Ofrecer
   arreglo de pago en su lugar" — transforma la solicitud (no es rechazo): crea el
   arreglo sobre el cobro correspondiente (FIN-8/FIN-13) y notifica a la persona.
Tests: razones obligatorias + texto, grupo lleno → por modificar + notificación,
conversión a arreglo. tsc/lint/vitest. EMAIL_SILENT_MODE se respeta.
```

### [x] FIN-13 · Arreglos de pago: habilitación individual y límites nuevos — HECHO 2026-10-02

Decidido: NO se abre un botón público de "solicitar arreglo" (miedo justificado
al portillo — la gente curiosa ya encontró el de becas sin promoción). En su
lugar, finanzas habilita el arreglo persona por persona.

Prompt para Claude Code:

```
CAMBIO · Arreglos de pago: habilitación por persona + límites (decidido 2026-09-29)

1. HABILITACIÓN INDIVIDUAL: en el pago pendiente de una persona (vista finanzas), acción
   "Habilitar arreglo de pago" — a partir de ahí LA PERSONA ve en Mis pagos la opción de
   acogerse al arreglo sobre ESE cobro (no un botón global para todo el mundo). Quien
   habilita: finanzas/direccion. Registrar quién habilitó (audit_log).
2. LÍMITES NUEVOS para arreglos de eventos/actividades: SOLO frecuencia QUINCENAL y
   MÁXIMO 2 TRACTOS, y el último vencimiento debe caer ANTES de la fecha de inicio de la
   actividad (validación al crear — la naturaleza de los anuncios es ~1 mes antes).
3. ESTUDIOS: el arreglo debe cerrarse dentro del período de matrícula/inscripción (~1
   mes), no "mientras dure el estudio" — cambiar la regla actual si difiere.
4. Con Tilopay (FIN-5): el arreglo se solicita/aprueba ANTES — nadie paga fraccionado por
   iniciativa propia; los cobros del arreglo se pagan en línea cada uno. Dejar la puerta
   preparada (flag) para, más adelante, habilitar el botón de solicitud junto al de becas
   en actividades elegidas, de forma controlada — NO activarlo ahora.
Tests: límites (3 tractos rechazado en evento, vencimiento posterior al inicio rechazado),
habilitación individual visible solo al habilitado. tsc/lint/vitest.
```

**Hecho** (commit `8961257c`, migración `20261002140000`). Los cuatro puntos,
con una nota sobre el 4: la «puerta preparada» para el botón público NO se
construyó como flag. La habilitación por persona YA es esa puerta —cuando se
quiera abrir de forma controlada, lo que cambia es quién la activa, no el
mecanismo— y un flag apagado sin nada detrás es código muerto que el día de
mañana nadie sabe si funciona.

**Medido el 2026-10-02 para la regla de estudios:** de 2 209 grupos solo 40
tienen `enrollment_end_date`, pero los 12 abiertos la tienen todos. El
respaldo para el resto es `starts_at`; 60 grupos no tienen ninguna de las dos
y ahí la regla no acota.

### [ ] PAG-5 · Pago en línea: pagar varios cobros pendientes de una vez

Cuando llegue Tilopay (FIN-5): en la ventana de pago, si la persona tiene más
de un cobro pendiente, mostrar "Tenés N pagos pendientes" con checkboxes para
seleccionar cuáles paga en una sola transacción (suma por moneda, jamás
mezclando monedas — INT-3). Útil para arreglos de pago con tracto acumulado.
Se implementa JUNTO con FIN-5, no antes — dejarlo en la spec de Tilopay.

### [~] PAG-6 · Pagos cancelados: rango de fechas + export para conciliación (Andrés) — rango y export HECHOS 2026-10-02; falta decidir el nombre del estado

Prompt para Claude Code:

```
MEJORA · /finanzas/pagos: conciliación contra estados de cuenta

1. En la vista de pagos PAGADOS (renombrar el estado visible a "Cancelado" si el término
   actual difiere — decisión de la reunión: "cancelado" es el término contable), agregar
   FILTRO DE RANGO de fechas (desde/hasta, por fecha de pago) — caso de uso: Andrés
   registra lunes+martes contra una línea del estado de cuenta y necesita ver exactamente
   esos pagos.
2. Columnas mínimas del caso: nombre, actividad/concepto, monto (con el toggle de
   ocultar/mostrar montos existente), fecha de pago.
3. Botón de descarga XLSX del resultado filtrado (mismo gate de montos).
Tests: rango filtra por fecha de pago, export respeta filtros. tsc/lint/vitest.
```

**Hecho** (commit `7ffaf0d5`): rango por fecha de pago server-side, export
XLSX del resultado filtrado con totales por moneda, y la columna que decía
«Fecha» mostrando `created_at` ahora dice «Fecha de pago» y muestra `paid_at`.

**PENDIENTE DE DECISIÓN — el punto 1.** El estado `cancelado` YA EXISTE y
significa ANULADO: 30 pagos en producción contra 239 en `paid`. Renombrar
«Pagado» a «Cancelado» dejaría dos «Cancelado» indistinguibles en la pantalla
de conciliación. Hay que elegir: o `paid` pasa a verse «Cancelado» y el actual
`cancelado` pasa a «Anulado» (solo etiquetas, la base no cambia), o se queda
«Pagado». No se tocó nada hasta que Floriana decida.

**Lo que se encontró midiendo, y es el motivo real del ítem:** `paid_at` es
timestamptz y hay pagos registrados a las 00:57 UTC, o sea las 6:57 p.m. del
día anterior en Costa Rica. Para el 31 de agosto hay 41 pagos en día CR y un
filtro ingenuo habría devuelto CERO. La conversión vive en
`src/lib/finance/rango-de-pagos.ts` con tests.

### [ ] DON-3 · Donaciones con montos: reimportación del año + reporte con montos por sede

Prompt para Claude Code:

```
FEATURE · Donaciones: montos de enero-septiembre + reporte financiero

PARTE A — ACTUALIZAR LAS DONACIONES EXISTENTES CON MONTO (instrucción específica, NO el
import normal): Andrés va a preparar el consolidado enero-septiembre 2026 con montos y
moneda (CRC/USD/EUR). Script/modo de importación que CAE ENCIMA de las donaciones ya
registradas (match por persona+fecha+nota como en DON-1) y les escribe el monto/moneda —
NO crea filas nuevas para las que matchean; las que no existan sí se insertan (solo
INSERT para nuevas). DRY-RUN con reporte de cuántas actualiza/inserta/quedan ambiguas,
aprobación antes de aplicar. Idempotente.

PARTE B — REPORTE DE DONANTES CON MONTOS, DENTRO DE FINANZAS (no en /reportes — los
montos son confidenciales; acceso solo finanzas y direccion):
- Por mes y por año: donantes únicos (una persona = 1 aunque done 30 veces), total por
  MONEDA separada (jamás sumar entre monedas; comparativo tipo "₡X + $Y" y, opcional,
  total aproximado con tipo de cambio indicado como referencia).
- Desglose por SEDE del donante (la sede calculada del sistema); los donantes SIN sede
  (sin asistencias) en categoría propia visible — a Meli le interesa identificarlos.
- Export XLSX.
NOTA pendiente de dirección: la ventana de cálculo de sede (hoy: asistencia del último
año) se va a revisar con don Luis — no cambiarla en este ítem.
Tests: parte A (match actualiza sin duplicar, dry-run), parte B (unicidad de donante,
monedas separadas, sede sin datos). tsc/lint/vitest.
```

### [ ] FIN-9 · «Congelar matrícula» por CUPONES — DECIDIDO con Meli 2026-09-29, listo para construir

Decisiones de la reunión (reemplazan el diseño anterior de "saldos a favor"):
- "Congelar matrícula" = quitar la matrícula y emitir un CUPÓN PERSONAL por el
  monto pagado (mecanismo de cupones existente), usable en su próximo pago.
- Alcance del cupón: estudios y campamentos/actividades grandes — NO abierto a
  cualquier rubro. MUY MANUAL: solo finanzas lo emite, caso por caso, tras
  hablar con la persona; no se promociona ni hay botón de autoservicio.
- Vigencia: un bloque para re-matricularse en estudios; si el estudio no se
  vuelve a abrir → devolución.
- Escalera de opciones al no poder seguir (en este orden): 1) cupón para el
  siguiente bloque, 2) donarlo como beca para otra persona, 3) usarlo en otra
  actividad, 4) devolución — esta última solo cuando Theos cerró el grupo
  (deserciones no generan devolución).
- CONTABILIDAD: cada cupón emitido desde un pago es una RECLASIFICACIÓN. El
  sistema debe poder generar el reporte de reclasificaciones (persona, pago
  origen, rubro origen, cupón, dónde/cuándo se usó, rubro destino) por mes/año
  para finanzas — Meli revisa en paralelo el manejo en QuickBooks con Luis.
Prompt: armarlo cuando Meli confirme lo de QuickBooks; el diseño de arriba es
la spec.



**Diseño anterior, REEMPLAZADO por lo de arriba.** Estaba como un ítem aparte que decía «pendiente decisión de Meli», y esa decisión ya se tomó el 2026-09-29: va por cupones, no por saldos. Los dos FIN-9 convivían con premisas contradictorias —uno esperando a Meli y el otro con la respuesta—, y se unificaron el 2026-10-01. Se conserva el texto porque explica qué se descartó y por qué:

> Lo hablado: el saldo a favor (ya existe, "en pañales") se usa SOLO en el rubro
> donde se pagó (matrícula→estudios, evento→eventos) para no enredar la
> contabilidad, y con límite de tiempo (~1 año o 1-2 bloques). Responde al
> pedido frecuente de "congelar matrícula". NO CORRER hasta que Floriana lo
> valide con Melissa (finanzas) — quedó explícito en la reunión que no se
> decide por ellos.
### [ ] FIN-12 · Adelantos de comida por sede (reemplaza los Excels mensuales)

Prompt para Claude Code:

```
FEATURE · Control de adelantos de comida por sede

QUIÉN: personas con el puesto "Colaborador de Finanzas" de cada sede (rol automático por
puesto — position-role-sync, como los demás), más finanzas/direccion que ven todo.

QUÉ: cada sede recibe un ADELANTO mensual con presupuesto predefinido (monto por sede,
configurable por finanzas). El colaborador registra los gastos del mes: fecha, detalle/
proveedor, número de factura, monto, y FOTO de la factura adjunta (mecanismo de
comprobantes existente). El sistema RESTA del presupuesto y muestra el saldo restante en
vivo ("te quedan ₡X de ₡Y").

PARA FINANZAS (Andrés): vista por sede y mes con todas las facturas (para asociarlas a
la sede al registrar en contabilidad), totales, saldo final del mes (lo que determina
cuánto se repone el mes siguiente), y export XLSX. Si se pasan del presupuesto, se marca
visible (no se bloquea — hay que identificar por qué y decidir el reintegro).
REFERENCIA REAL: data-import no — el Excel de Liberia lo pasó Floriana
("09. SETIEMBRE 2026 Comidas-Donaciones Place LIBERIA.xlsx"). Su estructura manda:
- La operación es SEMANAL, por fecha de charla, con el ENCARGADO de esa semana anotado.
- COMIDAS: por semana, facturas con proveedor, monto, # de FACTURA ELECTRÓNICA, fecha y
  observaciones (comida/desechables…), total semanal, y una lista aparte de FACTURAS
  PENDIENTES (proveedor, monto, fecha, estatus) — incluir ese estado pendiente/liquidada.
- OJO: el Excel trae una SEGUNDA hoja, DONACIONES — el cierre semanal de la sede:
  cajitas ₡ y $, efectivo (nombre, monto, detalle, # recibo), datáfono (# voucher), y
  depósitos con # de referencia y # de cuenta. Decidir con Meli si entra en este ítem o
  en uno aparte (recomendado: MISMO módulo "cierre semanal de sede" con dos secciones,
  porque lo llena la misma persona la misma noche) — confirmar antes de implementar la
  parte de donaciones; la de comidas va segura.
Cierre de mes: al cerrar, el saldo queda registrado y arranca el mes nuevo con el
presupuesto completo (la reposición la maneja finanzas por fuera).
Tests: resta en vivo, sobregiro marcado, colaborador ve solo su sede (403 a otra),
export. tsc/lint/vitest.
```

## Fase 26 — Reunión 2026-09-30: Mi comité y accesos a reportes

### [ ] SOP-1 · Tiquetes de soporte desde el check-in + rol de soporte técnico (pedido 2026-09-30)

Prompt para Claude Code:

```
FEATURE · Soporte: tiquetes desde la puerta + rol que los resuelve

PARTE 1 — CREAR TIQUETES (en la página de check-in):
- Botón "Crear tiquete de soporte" visible SOLO para los operadores de bienvenida/mesa
  de info (los mismos roles/alcance que ya operan el check-in — verificar cuáles son; no
  ampliar a nadie más).
- El tiquete es SIMPLE, tres cosas: quién lo emite (automático, el operador logueado =
  dueño del tiquete), fecha de creación (automática) y un CAMPO DE TEXTO libre con los
  detalles. Nada más — sin categorías ni adjuntos (decidido: solo texto).
- Opcionalmente puede quedar vinculado al miembro que se estaba atendiendo si el flujo
  lo tiene a mano (si complica, se omite: el texto lo dice).
- Casos típicos que van a llegar: cambiar/corregir perfiles, actualizar datos, cambiar
  email, unificar o separar familias, temas del sistema.

PARTE 2 — PÁGINA DE SOPORTE (lista de tiquetes):
- Página nueva (ej. /soporte) que lista los tiquetes: emisor, fecha, texto, estado
  (abierto / resuelto — simple; patrón RequestBoard/tiquetes existente, REUTILIZAR).
- Quién la ve: el ROL NUEVO "soporte_tecnico" + admin. El rol se asigna AUTOMÁTICAMENTE
  por el puesto nuevo del comité de TI (verificar el nombre exacto del puesto en el
  catálogo; mecanismo position-role-sync + source de siempre).

PARTE 3 — ALCANCE DEL ROL soporte_tecnico (lo que necesita para resolver los tiquetes):
- Edición de MIEMBROS (perfiles/datos personales).
- Edición de FAMILIAS (vincular/separar — los flujos de FAM-2).
- Crear/actualizar el EMAIL de una persona para la creación de su cuenta (el flujo de
  cuentas/acceso existente; respeta las validaciones de correo duplicado de DAT-10 y las
  reglas de menores de FAM-2).
- NO incluye: finanzas, reportes, estudios ni nada más — el censo de requireRoles del rol
  debe quedar exactamente en esos tres módulos.
Todo cambio que soporte haga queda en audit_log como cualquier edición.
Tests: solo bienvenida crea tiquetes (403 al resto), solo soporte_tecnico/admin ve la
página, el rol abre exactamente los tres módulos (403 a finanzas/reportes), puesto de TI
da y quita el rol. tsc/lint/vitest.
```

### [ ] EST-20 · Página pública de matrícula de Nivel 1 (pedido 2026-10-01)

Prompt para Claude Code:

```
FEATURE · Página PÚBLICA con los grupos de Nivel 1 en matrícula

QUÉ: página pública (sin login) que lista ÚNICAMENTE los grupos de Nivel 1 con estado
"en matrícula" — para compartir el enlace en redes, WhatsApp y el website. Mismo patrón
que el calendario público y la página de puestos (SRV-13): PUBLIC_PREFIXES. SIN iframe
por ahora (decidido 2026-10-01): no tocar EMBED_ALLOWED_ORIGINS.

ENLACE PARA COMPARTIR: en la página de matrícula INTERNA, un botón "Copiar enlace
público" (copia la URL de esta página al portapapeles, con confirmación visual) visible
ÚNICAMENTE para admin y coordinador_estudios — es la herramienta para pegarlo en redes/
WhatsApp; los demás usuarios no lo ven.

CONTENIDO por grupo (REUTILIZAR la tarjeta de grupo de la matrícula, GroupRow/MAT-2, que
ya quedó responsive — misma info pública): zona + ubicación, horario, dirigente, cupos
disponibles con barra, fecha de inicio, precio/gratuito. Filtro simple por zona y
búsqueda. Solo grupos de Nivel 1 en matrícula con cupo — nada de otros planes ni estados
(el catálogo filtrado server-side; sin datos de miembros en el payload público).

MATRICULARSE: botón "Matricular" en cada grupo → pide login y, al volver, aterriza en la
matrícula normal CON ese grupo preseleccionado (el ?redirect= de src/proxy.ts + el flujo
de primera vez de AUT-3; la gente nueva que viene de redes casi nunca tendrá cuenta —
este es el caso donde el camino "Creá tu contraseña" más importa, y donde el cuestionario
de Nivel 1 de EST-15 aplica igual que en la matrícula normal: verificar que el flujo
completo público → login/cuenta nueva → cuestionario → matrícula funcione de corrido).

Los datos salen de la MISMA fuente que la matrícula interna (misma consulta de grupos
elegibles de Nivel 1) — si la pública muestra un grupo lleno o uno que la interna no
ofrece, es bug. Cache corto (1-5 min) está bien para la carga pública.
Tests: solo N1 en matrícula aparece, sin login se lista pero matricular exige sesión,
redirect aterriza con el grupo preseleccionado, payload sin datos sensibles.
tsc/lint/vitest.
```

### [x] SRV-19 · Aplicaciones de puestos: mostrar la sede del aplicante (pedido 2026-10-01) — HECHO 2026-10-02

> Entró como «SRV-17» y se renumeró: ese código ya es «Mi comité», que está
> en producción desde el 2026-09-30. El siguiente libre era el 19.

Prompt para Claude Code:

```
MEJORA · Página de Aplicaciones (SRV-14): columna "Sede" del aplicante

En la lista de aplicaciones a puestos de servicio, agregar la SEDE de la persona que
aplica (la sede calculada del sistema — la misma de siempre, refresh_member_sede; "—"
si no tiene). Va en: la tabla (columna, sorteable/filtrable junto al filtro de ubicación
existente), el detalle de la aplicación, el PDF que se genera y el email al encargado.
Sin consulta extra por fila (join en la query existente). Tests: columna presente,
persona sin sede. tsc/lint/vitest.
```

**Hecho** (commit `d903373b`): columna en la tabla, línea propia en la tarjeta
de celular, filtro nuevo al lado del de ubicación (server-side), el panel de
revisión, la hoja que se imprime y el correo al encargado.

**Queda fuera, a propósito: ordenar por sede.** Hoy NINGUNA columna de esa
tabla ordena, y la lista pagina en el servidor: PostgREST no ordena las filas
padre por una columna embebida, así que habría que hacer una vista o un RPC
solo para esto. El filtro contesta la misma pregunta («los de mi sede») sin
inventar un mecanismo nuevo para una columna. Si igual se quiere ordenar,
es un ítem aparte con su vista.

**Dato medido el 2026-10-02:** 12.012 de 23.892 miembros activos tienen sede,
así que la mitad de las filas va a decir «—». No es un error del join: la
sede sale de los check-ins y mucha gente no tiene ninguno.

### [x] REP-13 · Personas nuevas: unificar los nombres de charlas como en asistencia (pedido 2026-10-05) — HECHO 2026-10-05

Caso reportado: "Pedregal United" y "Charla Pedregal Domingos" aparecen como
dos charlas distintas en el reporte de personas nuevas, y son la misma. Hay
varias en la misma situación. Esta unificación YA se hizo para el reporte de
asistencia (las series históricas unificadas / equivalencias).

Prompt para Claude Code:

```
FIX · Reporte de personas nuevas (REP-6): usar la MISMA unificación de series de charlas
que el reporte de asistencia

1. Encontrar cómo resuelve el reporte de ASISTENCIA las series equivalentes (la
   unificación de charlas históricas: series_key/mapa de equivalencias que se implementó
   para que Pedregal United y Charla Pedregal Domingos cuenten como una) — y centralizar
   esa resolución en lib/ si aún vive solo dentro del reporte de asistencia, para que
   TODO consumidor de "nombre de charla/serie" use la misma (REUTILIZAR, NO duplicar el
   mapa: dos mapas = divergencia garantizada).
2. Aplicarla en el reporte de personas nuevas: el filtro de sede/charla, los gráficos y
   la tabla agrupan por la serie unificada (una sola entrada por charla real).
3. Censar los DEMÁS consumidores que listan charlas (selector del reporte de abandonos
   REP-5, demografía REP-8.6, el detalle de semana…) y aplicar la misma resolución donde
   muestre duplicados — listar cuáles se tocaron.
4. Verificar el caso concreto: Pedregal United + Charla Pedregal Domingos = una sola
   entrada con los números sumados, en personas nuevas Y en cualquier otro lugar
   detectado.
Tests: resolución centralizada (equivalencia conocida se unifica, charla sin
equivalencia pasa igual), números sumados correctos. tsc/lint/vitest.
```

**Hecho.** La resolución YA estaba centralizada: `sedeFromTitle`
(`lib/reports/charla-attendance`) sobre el diccionario `lib/sedes-canonical`.
No hizo falta crear nada — hizo falta USARLA.

**Censo del punto 3.** Ya la usaban asistencia, crecimiento (member-growth),
demografía (REP-8), el detalle de semana y abandonos (REP-5, vía
`getAsistentesDeLaSemana`). **El único que no era personas nuevas**: su
`origen` salía crudo del SQL. Se aplica ahora en el borde de la consulta —la
serie y el detalle— y no en cada pantalla, para que el filtro, el selector,
los dos gráficos y la tabla vean el mismo nombre sin acordarse de aplicarlo.

Solo se toca el canal `charla`. En `estudio` el origen es el nombre del plan
y en `evento` el del evento: pasarlos por un diccionario de sedes no los
cambia hoy, pero ataría el nombre de un estudio a una tabla de charlas.

**Verificado contra producción el 2026-10-05:**
- El selector pasa de **33 a 22** charlas.
- El caso reportado: «Charla United» (1 292) + «Charla Pedregal Domingo» (33)
  = **1 325** en una sola entrada.
- **El total general NO se mueve: 14 832 antes y después.** Es la invariante
  que importa — no se perdió ni se inventó nadie.
- Los 27 orígenes de estudio quedan intactos.

**Queda una cosa para Floriana:** en el selector siguen apareciendo «United
Este» y «Youth United Este», la sede del Este que operó de 2022 a 2024. NO
son alias del renombre: fueron una sede propia que cerró. Si se quieren
fundir con otra, es una línea en `SEDE_CANONICAL`, pero eso cambia el
histórico y no se asume.

### [x] REP-14 · Reporte de recurrentes que ya no van (pedido 2026-10-05) — HECHO 2026-10-05

Personas que asistieron al menos 20 veces a Theos pero llevan más de 6 meses
sin venir a ninguna charla — la gente valiosa que se perdió.

Prompt para Claude Code:

```
FEATURE · Reporte en /reportes: "Recurrentes que dejaron de venir"

DEFINICIÓN (función pura testeable):
- Persona con ≥20 check-ins a charlas en TODO su histórico (los 168k+ migrados cuentan),
- y SIN ningún check-in a charla en los últimos 6 meses.
- Excluir: datos [prueba], fallecidos/inactivos marcados, y servidores activos (sirven
  aunque no asistan a charla — mismo criterio de DIR-7). Reutilizar las piezas de
  DIR-7/REP-5 (no-volvieron/abandonos), no reinventar.

AGRUPACIÓN POR AÑO:
- Vista agrupada por AÑO (los años en que la persona asistió): en cada año aparecen los
  recurrentes-perdidos que asistieron ese año; quien asistió varios años aparece en cada
  uno, con un indicador de "se repite" (en cuántos años / cuáles).
- Por persona, mostrar el AÑO EN QUE DEJÓ DE IR (= año de su último check-in a charla)
  bien visible.
- Resumen arriba: total de personas únicas y conteo por año de abandono (¿en qué año
  perdimos a más recurrentes?).

COLUMNAS por persona: nombre · teléfono · email · sede a la que asistió (la calculada;
si no tiene, la más frecuente de su histórico — indicar cuál criterio quedó) · total de
asistencias · fecha del último check-in · año en que dejó de ir · llevó estudio sí/no ·
último estudio que llevó · dirigente de ese estudio.
Export XLSX con todo.

PERMISOS: trae teléfonos y correos — mismo criterio de REP-5/REP-6: roles amplios de
reportes con alcance de miembros (verificar el gate del export); tarjeta del índice
filtrada por rol.
RENDIMIENTO: SQL agregado (≥20 sobre el histórico completo es una agregación grande —
nada de traer check-ins al cliente; valorar apoyarse en report_snapshots si la consulta
en vivo pesa).
Tests: definición (19 check-ins no entra, 20 sí; actividad hace 5 meses no entra;
servidor activo excluido), año de abandono, repetición multi-año, export.
tsc/lint/vitest.
```

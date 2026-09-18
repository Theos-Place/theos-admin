# Plan de desarrollo — pendientes

> Limpiado el 2026-09-10: solo lo pendiente. El historial completo
> (96 puntos cerrados con sus notas de implementación y decisiones) está en
> `docs/plan-desarrollo-cerrado.md` — consultarlo antes de reabrir discusiones ya decididas.


## Fase 0 — Operativo (sin código, sesión de configuración)

- [ ] Agregar las env `HEALTHCHECK_URL_*` en Vercel. **La lista completa (9, una por cron)
  quedó en `.env.example` con su horario al lado** — antes solo estaban 4 y por eso "las
  faltantes" no se sabía cuáles eran. Crear un check por cron en healthchecks.io y pegar la
  URL. Sin la variable el cron corre igual; solo no avisa si falla.
  · `report-snapshots` **SÍ debe pingear** — decidido e implementado 2026-08-06: su modo de
  fallo es silencioso (los reportes siguen abriendo, con datos viejos). Ya no queda ningún
  cron sin ping, y hay un test que lo vigila (`src/lib/health.test.ts`).
- [ ] Configurar Sentry (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`) — **solo falta pegar el
  DSN**. El 2026-09-16 se cerró el hueco que lo volvía inútil: las 338 rutas de /api
  atrapaban su propio error y devolvían un 500, así que Next nunca veía la excepción y
  `onRequestError` no disparaba. Ahora todas pasan por `reportarError`/`reportarFalla`
  (`src/lib/observabilidad.ts`), más 22 fallos silenciosos de `src/lib`. Sin DSN todo eso
  es no-op, igual que antes. Crear el proyecto en sentry.io (plataforma Next.js) y pegar
  el mismo DSN en las dos variables, solo en Production; después redeploy y verificar con
  un error de prueba ANTES de apagar Observability Plus.
- [ ] Copiar las env vars de Supabase a los deploys **Preview** de Vercel (hoy solo están en Production y los previews fallan).
- [ ] Confirmar el SMTP de Supabase Auth.
- [ ] Bajar el vencimiento del OTP a menos de 1 h en el panel de Supabase (lo sigue
  reportando el linter: `auth_otp_long_expiry`, 2026-09-16).

## Backlog (fases siguientes, requieren definición de producto)

- **CAM-1 · Matrículas de estudios tipo campaña** — no urge. Definir: ¿sin prerequisitos? ¿cupos? ¿pago? La etapa 'campaña' ya existe en la elegibilidad (campañas sin compromisos) y la excepción de campaña queda implementada en EST-1.

- **WAP-1 · Canal WhatsApp en comunicaciones** — fase mayor. Hoy solo está modelado en el esquema (`channel_configs.type`, prefs de miembro). Requiere decidir proveedor y costos antes de escribir código.


## Notas para la ejecución en Claude Code


- Un punto por sesión/PR. Pegar el prompt tal cual y pedir además: correr `tsc --noEmit`,
  lint y `vitest` antes de dar por terminado (la verja de CI usa `--max-warnings=70`, solo baja).
- Reglas del repo que ningún cambio debe romper (de AGENTS.md y docs/sistema-overview.md):
  - Todo handler de /api se autoriza solo con `requireRoles(...)` o `requireModuleView(...)`
    (el middleware excluye /api).
  - Sin soft-delete; DELETE con referencias → 409 con conteo.
  - Anti-suplantación con `resolveTargetMemberId()` en autoservicio.
  - La regla de sede vive SOLO en SQL desde REF-1 (refresh_member_sede + refresh_member_sedes,
    migración 20260728100000); computeMemberSede es la spec ejecutable de los fixtures. Si cambia
    la regla: las dos funciones SQL + el espejo TS + los fixtures.
- Después de cada punto completado, marcar el checkbox acá y anotar el commit/PR.

---


## Fase 13 — Cola nueva (pedida 2026-09-10)

### [ ] DAT-5 · Grupos finalizados con gente sin resultado

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

### [x] DAT-6 · Traer las asistencias al día desde CCB — HECHO (confirmado 2026-09-15)

El archivo llegó y se importó. Verificado contra la base: jun 3.949, jul 4.117,
ago 4.012, set 1.958 check-ins, con el último del 13 de setiembre. La serie no
tiene huecos.

### [ ] INF-1 · Ambiente de staging

Hoy todo se prueba contra producción — los tutoriales se graban ahí, con el
guard `@prueba.`, y los scripts de medición leen la base real. Un staging con
su propio proyecto de Supabase y su propio deploy de Vercel quita ese riesgo.

Depende de resolver antes las env de Supabase en los deploys Preview (Bloque E),
porque es el mismo problema.

### [ ] FIN-4 · Planes de pago para matrículas e inscripciones

Poder partir el monto de una matrícula (o de la inscripción a un evento) en
varios pagos, con sus fechas y su saldo. Necesita definición de producto: si el
plan bloquea o no la matrícula, qué pasa si alguien deja de pagar, y cómo se ve
en la ficha y en los reportes de finanzas. Convive con la regla de 2026-08-04
(la matrícula es efectiva de inmediato, `pendiente_de_pago` ya no se escribe).

### [ ] EVE-11 · Google Wallet y Apple Wallet

Que el pase del evento se pueda guardar en la billetera del teléfono, en vez de
depender del QR en un correo. Las dos plataformas piden cuenta de desarrollador
y firma de los pases; hay que ver el costo y quién administra las credenciales
antes de escribir código.

### [ ] FIN-5 · Tilopay

Pasarela de pago. Hay que revisar qué reemplaza y qué convive con lo que ya
existe, y si entra en el mismo flujo que FIN-4.

### [ ] REP-1 · Actualizar todos los reportes

Revisión completa de `/reportes`: qué sigue sirviendo, qué quedó desactualizado
y qué falta. Conviene hacerlo DESPUÉS de DAT-5 y DAT-6, porque varios reportes
leen justo esos datos y hoy dan un número que no es.

### [x] DAT-7 · El campo de alergias — HECHO 2026-09-15

De 181 personas con algo escrito, se limpiaron 33 y quedaron 148 con contenido
real. Regla en `src/lib/members/limpieza-de-alergias.ts`, con tests.

**Solo se borró lo que no dice nada** — 32 entre "No", "N/A", "Ninguna" y
"None" (el brief decía 22; también había ruido en inglés) — más un correo que
la persona ya tenía idéntico en su ficha, o sea borrarlo no perdió nada.

**Las restricciones alimenticias se dejaron tal cual las escribieron**, por
decisión del usuario: "Gluten" puede ser celiaquía o alergia de verdad y esa
diferencia le importa a quien cocina, así que la traducción al campo
`dietary_restrictions` no se hace sola. Son 13.

**Cinco quedaron para revisar a mano** porque borrarlos perdería el dato: son
lo único que hay de él. Ivannia Mora escribió su cédula y tiene el campo vacío;
Alejandra Cadario un correo (con un guion bajo en el dominio, o sea inválido) y
no tiene correo en la ficha; Carolina Chavarría un correo distinto al suyo; y
dos menores tienen "4 años" y "7 años", que se coló del campo de al lado.

**El import también se arregló**, que era lo que hacía falta para que la
limpieza no fuera cosmética. Los cinco de arriba tienen CERO ediciones con
actor humano: el texto lo metió `scripts/import-members.ts` leyendo la columna
`Allergies` de CCB, y a Ivannia se lo metió DOS veces (28-jul y 11-set). El
script ya traía un filtro —un `/^\d+$/` -— o sea alguien ya se había topado con
esto, pero solo agarraba números puros y la cédula con guiones se le colaba.
Ahora usa `clasificarAlergia()` y reporta al final lo que descartó, con el
Individual ID, para que se corrija en CCB.

Pendiente menor: quedaron 2 "Si" y 1 "FOTOS SI" clasificados como alergia. No
son alergias, pero un "Si" al menos avisa que hay algo que preguntar, así que
se dejaron a propósito en vez de borrarlos.

Y los cinco casos de "a mano" hay que arreglarlos EN CCB, no acá: si solo se
limpian de este lado, el próximo import los trae de vuelta.

## Fase 14 — Pedido el 2026-09-10 (tarde)

> Nota 2026-09-15: REP-2 quedó HECHO — existen `SemanaDetallePanel` y el deep link
> `?semana=`. (La nota del 2026-09-10 decía lo contrario y ya no aplica.)

### [x] REP-2 · Reporte de asistencia: ver una semana sola — HECHO 2026-09-13

HOY `/reportes/asistencia` muestra el año entero: gráfico semanal, promedio,
semana pico. Al tocar una semana no hay forma de ver SOLO esa semana.

LO QUE SE QUIERE. Al seleccionar una semana —clic en la barra o un selector—,
la pantalla muestra el detalle de ESA semana:

- Total de asistentes, desglosado **por sede/charla** (Meridiano Martes,
  Heredia, Antares, United…), con la cantidad de cada una.
- Contexto corto: contra la semana anterior y contra la misma semana del año
  pasado (delta en número y en %). Contexto, no acumulado.
- Los dos números por charla, asistente y servidor, que ya existen en
  `event_checkins.checked_in_as` (columna agregada el 2026-09-10).
- Las semanas parciales marcadas como **"semana en curso"** — el flag
  `partial` ya existe en `WeeklyPoint`. Sin eso alguien compara media semana
  contra semanas completas sin darse cuenta.

CÓMO. La vista anual se queda igual; el detalle es un estado adicional (panel
abajo del gráfico o drill-down) con un "volver al año" claro. Deep-linkeable
(`?semana=2026-W37`) para poder mandar el enlace.

DATOS — lo primero que hay que revisar. Ver si el snapshot actual
(`report_snapshots` / el RPC de charlas) ya trae el desglose por sede POR
SEMANA o solo los totales. `CharlaAggRow` hoy es
`{ yr, title, wk, mo, checkins }`, así que el título ya está por semana: puede
que alcance. Si no, se amplía el snapshot nocturno. **NO calcular en vivo
contra `event_checkins`**: son 170 mil filas y el patrón del módulo es
snapshot.

PERMISOS: los mismos del reporte, `requireModuleView('reportes')`.

TESTS: seleccionar una semana muestra solo sus números; el desglose por sede
suma el total; la semana parcial queda marcada; el deep link abre la semana
correcta; la vista anual no cambia.

### [~] DAT-8 · Menores de 12 con correo y sin familia — de 54 a 26

Salió de limpiar los correos de menores (2026-09-10). Quedaban 54 a los que NO
se les podía quitar el correo: sin familia detrás se quedaban sin ninguna forma
de contacto.

**Bajaron a 26.** Primero a 30 solos, de rebote de FAM-2 y del vaciado de las
26 fechas falsas. Los otros 4 el 2026-09-15.

LA CLAVE FUE SEPARAR DOS PROBLEMAS que vivían mezclados, con una señal
mecánica: si el correo lleva el **nombre de pila** de la propia persona
(`src/lib/members/correo-de-quien.ts`). El apellido NO cuenta — madre e hijo lo
comparten, y `cristellopeztorres@` daría por propio el correo de la ficha de
Camilia Sanabria **Lopez**. Es la misma trampa que ya advertía este pendiente
sobre los apellidos, colándose por la puerta del correo.

De los 30:
 · **12 · el correo es suyo** → no son menores, la fecha está mal. Todos con
   correo que lleva su nombre y teléfono propio; un niño de 4 años no tiene
   `andres.herreram1802@gmail.com` ni `pilar@rojasarquitectos.com`.
   **Pendiente: confirmar el criterio antes de vaciarles la fecha.**
   `data-import/dat8-fecha-mal-2026-09-15.csv`.
 · **4 · el correo es de un adulto identificado** → HECHO. Se les armó la
   familia y RECIÉN DESPUÉS se les quitó el correo: al revés los dejaba sin
   ninguna vía de contacto, que es exactamente por lo que este pendiente estaba
   trabado. Elena y Alana a la familia de Carlos Blanco —el duplicado que las
   bloqueaba se resolvió el 15-set— y Samuel a la de Elena Sanabria.
   El cuarto caso, Camilia Sanabria Lopez, resultó ser un DUPLICADO de Camila
   (misma fecha de nacimiento, mismo día de creación): confirmado por el usuario
   y fusionado. Los check-ins suman 1+1=2, no se deduplican — se verificó antes
   de correr, que es lo que faltó con Steven Angulo.
 · **14 · sin pista** → a mano. Varios tienen correo con diminutivo o iniciales
   (`moniqu2601@` de Mónica Umaña, `macarygc@` de Mariana García) que la regla
   no reconoce a propósito: aflojarla para atraparlos arriesga borrarle el
   correo a un menor de verdad. `data-import/dat8-a-mano-2026-09-15.csv`.

### [x] BEC-2 · El destino de una beca sin cupo — HECHO 2026-09-15

No avisa por correo: es una señal en pantalla. La pestaña "Becas asignadas"
ahora trae una columna **Cupo** y una segunda fila de filtros que solo aparece
si hay algo que atender — una fila de pastillas en cero es ruido permanente.

Distingue **"Sin cupo en el destino"** (todos los grupos abiertos están llenos,
hay que mover la beca o abrir cupo) de **"Sin grupos abiertos"** (el plan puede
abrir uno la otra semana, no hay nada que hacer hoy). Mezclarlos habría vuelto
ruido la cola.

El filtro de cupo es aparte del de uso y se cruza con él: las que importan son
las que están sin usar Y sin cupo.

Verificado contra producción: de 6 becas vivas y sin usar, las 2 de Romanos
—Karla Ávila y María José Ruiz— salen "Sin cupo en el destino" y las otras 4
con cupo. Es exactamente el cuadro que describía este pendiente.

Gotcha que costó una vuelta: `scholarships.entity_type` vale `'study_plan'`,
no `'estudio'`. El dominio en español no llega hasta esa columna, y con el
valor equivocado la revisión devolvía "no aplica" para todas. Hay un test que
lo fija.

Regla en `src/lib/finance/cupo-del-destino.ts`.

### [x] BEC-3 · `email_sent_at` se marca aunque el correo no haya salido — HECHO 2026-09-12 (`ecef9ea0`)

Con `EMAIL_SILENT_MODE` activo, `sendEmail` devuelve
`{ messageId: 'skipped-silent-mode' }` sin tirar error, así que
`sendSystemEmail` responde `{ ok: true }` y quien llama estampa
`email_sent_at`. El resultado es que la beca **dice que se avisó y no se
avisó**: la pantalla muestra la fecha de envío y el botón cambia a "Reenviar
correo".

Ya pasó con la beca de Valeria el 2026-09-11. Afecta a los tres lugares que
estampan la fecha: `approveScholarshipRequest`, `moveScholarship` y el botón
"Enviar por correo" de los cupones.

El arreglo es en un solo punto: que `sendSystemEmail` devuelva si el envío fue
REAL o silenciado, y que nadie estampe la fecha cuando fue silenciado. Va con
test, porque el modo silencioso es justo el que nadie mira.

### [x] BEC-4 · El tag de una beca asignada no mira las redenciones — HECHO 2026-09-12

`getScholarshipsQueue` cuenta `scholarship_redemptions` solo para los cupones
genéricos, así que una beca asignada siempre llega con `used_count = 0` y su
tag sale de `status`. Hoy da igual —una asignada se consume marcándose
`status='used'`— pero `usoDeLaBeca` ya contempla el caso de la redención, y si
alguna vez se registra una para una asignada el tag va a mentir. O se cuentan
también para las asignadas, o se documenta que ahí no aplican.

RESUELTO contando siempre, sin mirar el kind (`contarRedenciones`, una sola
implementación que usan la cola, "Mis becas" y moveScholarship). El problema
real no era el tag sino que `used_count` significaba dos cosas: el mover ya lo
contaba para cualquier beca y bloqueaba, y la pantalla lo recibía en 0 — una
beca podía decir "Sin usar" y no dejarse mover en el mismo renglón. Verificado
insertando una redención de mentira sobre una asignada: la cola pasó a 1, el
tag a "Usada", el perfil vio lo mismo y el movimiento quedó bloqueado; borrada
la fila, todo volvió a 0.

### [ ] API-1 · El PATCH de becas valida a mano, no con zod

`PATCH /api/scholarships/[id]` (mover una beca) valida `action`, `entity_type`
y el uuid del destino con `if`s. La convención del repo (AGENTS.md) es zod con
`detalles: z.treeifyError(...)`. El `POST /api/scholarships/coupons` de al lado
tiene el mismo problema y es más viejo: conviene migrar los dos juntos.

### [ ] FIN-7 · Josué Valverde pagó ₡20.000 de más

Se matriculó y pagó el estudio completo antes de que su beca —del 100%— se le
asignara. No es un bug: es plata que hay que devolver o acreditar, y **la
decisión es del usuario**, saldo a favor o devolución. Las de Gisselle y
Valeria ya se resolvieron el 2026-09-11.

### [ ] LINT-1 · Quedan 70 warnings, y 67 son el mismo patrón

Van dos tandas (93 → 70). Lo que queda es casi todo
`useEffect(() => { cargar() })` con un `setLoading(true)` antes del fetch.

**Ojo con el camino corto**: reordenar el async NO los apaga. Está comprobado
que la regla marca igual un `useCallback` async cuyo único `setState` va
después del `await`, y solo se calla si el `setState` vive dentro de un
`.then(...)`. Convertir `await` en `.then` sería maquillaje —el `setState`
corre en el mismo tick— así que el arreglo real es derivar el estado o mover el
`setState` a un manejador de evento.

Y el patrón de "ajustar el estado durante el render" que se usó en la segunda
tanda tiene una trampa: el valor con el que se compara **tiene que ser estable
entre renders**. Un `?? []` o un objeto literal hace que el render se llame a sí
mismo sin parar. Con un efecto eso solo re-disparaba el efecto; durante el
render, tumba la pantalla.

Los 3 de `purity` son `Date.now()` en render y hay que hacerlos junto con estos:
anclar el reloj pide guardarlo en estado desde un efecto, o sea un
`set-state-in-effect` nuevo.

## Fase 16 — Pedido el 2026-09-14

### [x] FRM-5 · Restricción de audiencia en formularios — HECHO 2026-09-15

Se reutilizó GRU-2 en serio, no se copió: la regla que estaba en
`lib/studies/group-restrictions.ts` se extrajo a **`lib/audiencia/restriccion.ts`**
y el evaluador a **`queries/audiencia.ts`**. Los grupos siguen entrando por su
módulo de siempre, que ahora solo tiene lo suyo (el mensaje del bloqueo y el
código de error). El constructor de la UI también es uno solo
(`components/audiencia/RestriccionDeAudiencia`): lo único que cambia entre
grupos y formularios son los textos, y van por props.

Migración `20260915060000`: `forms.audience_restrictions` jsonb, NULL = abierto.

Las tres capas del brief, aplicadas:
 · **Listado** — a quien no cumple, el formulario no le aparece.
 · **Servidor** — el guard vive en `memberFormFillAccess`, que ya era el punto
   común del endpoint y de la pantalla. La audiencia se mira ANTES del atajo
   del staff, porque si no el "a nombre de" se saltaría la restricción.
 · **Público** — una restricción cierra el formulario al mundo. Guardar una ya
   fuerza `requires_auth` (en la QUERY, no en el builder: el PUT es alcanzable
   sin pasar por la pantalla), así que la comprobación en la ruta pública es
   redundante — y por eso está: si alguna vez llega una restricción por SQL
   directo sin el flag, la diferencia es que cualquiera conteste.

La casilla "se puede contestar sin cuenta" desaparece cuando hay restricción:
diría que se puede cuando el servidor va a exigir cuenta igual, y una casilla
que miente es peor que una ausente.

Probado contra producción con rollback: con "solo servidores", un servidor pasa,
un no servidor y un anónimo se rechazan con "Este formulario es solo para:
Servicio.", y el staff llenando a nombre de un no servidor también se rechaza.
**Gotcha:** `updateForm` escribe por PostgREST, o sea FUERA de una transacción
de `pg` — el rollback no lo revirtió y hubo que limpiar a mano. Para probar
escrituras que pasan por las queries del app, la transacción no sirve de red.

Queda anotado: el resumen de una condición de servicio sin área ni comité dice
solo "Servicio". Es correcto pero vago; en uso real se elige un área.

### [~] FAM-2 · Familias desde CCB + reglas de menores — PARTE A HECHA, PARTE B casi

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
 · [ ] **66 cumplieron 18 sin cuenta** en el último año: candidatos a que se les
   ofrezca el alta. Nada automatizado, como pide el brief —
   `data-import/cumplieron-18-sin-cuenta-2026-09-15.csv`.
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

### [x] AUD-1 · El audit_log no guardaba el valor viejo — HECHO 2026-09-15

`log_changes` ponía `old_data` en NULL para los UPDATE, literalmente
`CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END`. Registraba
que algo cambió y cómo quedó, nunca cómo estaba antes. Se descubrió al vaciar
26 fechas de nacimiento: el único respaldo terminaron siendo unos CSV.

Ahora un UPDATE guarda **solo lo que cambió**, viejo y nuevo:

```
old: {"birth_date":"1965-09-09"}   new: {"birth_date":null}
```

Eso arregla de paso el TAMAÑO, que era el otro problema. La tabla iba en
**314 MB con 369 mil filas** porque cada UPDATE copiaba las ~50 columnas
aunque hubiera cambiado una: una fila de `members` pesa 1.480 bytes en JSON y
un cambio de dos campos ahora pesa 275. INSERT y DELETE no cambian — ahí la
fila entera ES el contenido.

Dos detalles que importan: la comparación es `is distinct from` y no `<>`,
porque con `<>` un paso a NULL no cuenta como cambio y era justo el caso que
lo motivó; y `updated_at` queda fuera del diff, porque lo mueve
`set_updated_at` en cada escritura y si contara todo cambio traería ese ruido.

Contrato fijado por `src/lib/audit-log-contrato.test.ts`. Migración
`20260915090000`.

Pendiente aparte: **no es retroactivo.** Lo que se cambió antes de hoy sigue
sin valor viejo, y los 314 MB ya escritos no se achican solos.

### [x] SRV-1 · Michelle Evans · CERRADO 2026-09-15 — no era un problema

CCB la tenía como Coordinador Lectura en Pedregal Jueves y el sistema como
«Colaborador Lectura». El usuario confirmó que el sistema es el correcto: el
cambio de rango fue real. El puesto «Coordinador Lectura» de esa sede queda
vacío a propósito.

### [x] SRV-2 · Ingrid Gómez y Zully Murillo tenían dos IDs en CCB — HECHO 2026-09-15

Resuelto del lado de CCB, que era donde estaba el duplicado. En el sistema las
dos siempre estuvieron activas y en la sede correcta; lo que no calzaba era el
`external_id` del export (17267 vs 11068, y 5142 vs 24238).

### [x] SRV-3 · Puestos fantasma — HECHO 2026-09-15 (eran 3, no 25)

Los 25 del reporte del 15-set estaban mal contados: usé `count(*)` sobre un LEFT
JOIN, que da 1 aunque no haya ningún voluntario, así que entraron puestos recién
creados y todavía vacíos. Con `count(v.id)` los fantasmas de verdad son 3:
«Charlista de grupos», «Coordinador Abuelitos GAM» y «Colaborador Abuelitos GAM».

Desactivados, no borrados: el puesto sigue existiendo para que el historial de
quien lo tuvo no quede colgando. Quedan 329 puestos activos, 71 sin nadie, y
esos 71 son vacantes legítimas —no tienen gemelo vivo—, no basura.

### [x] UI-4 · La tabla de servicio del perfil no tiene orden — HECHO 2026-09-15

Regla en `src/lib/members/orden-de-servicios.ts`: activos primero y, dentro de
cada grupo, lo más reciente arriba. Un servicio sin fecha cae al final de SU
grupo y no al final de todo — medio histórico de CCB vino sin `start_date` y
hundirlo entero escondería servicios vigentes. La tabla sigue siendo ordenable
por columna.

### [x] COM-4 · Un comunicado de más de 1.000 no sale completo de una corrida — HECHO 2026-09-15

`processPendingEmails` pagina el `select` de pendientes de a 1.000 y nunca pide
más que el cupo del día. Comprobado contra el comunicado de Meridiano: la
consulta de un solo tiro devuelve 1.000 filas y la paginada 1.300, sin
repetidos.

### [x] REP-3 · El reporte de charlas mezcla año calendario con semana ISO — HECHO 2026-09-15

El RPC devuelve ahora `iso_yr` además de `yr`: los dos hacen falta y significan
cosas distintas. El total del año y el desglose por mes son calendario —"la
asistencia de 2026" es enero a diciembre— y la serie semanal va por año ISO,
incluido el detalle de `?semana=`, que también filtraba por el año calendario.
Ya había 13 check-ins mal ubicados (3-ene-2021, semana 53 de 2020).

### [ ] DAT-9 · `member_por_external_id()` existe y nadie la llama

La función y la regla en AGENTS.md quedaron listas el 2026-09-15, pero hoy no
hay ningún import de CCB dentro de `src/` que la use — son todos scripts
puntuales. Cuando se escriba el próximo import, tiene que entrar por ahí.

## Fase 17 — Pedido el 2026-09-15

### [x] MAT-2 · La tarjeta de grupo en mobile — HECHO 2026-09-15

`GroupRow` pasó de UNA grilla que se encogía a DOS layouts de verdad:

 · **Mobile** · una columna. La ubicación ocupa el ancho completo —es el único
   dato largo— y Horario/Dirigente comparten fila porque sí caben en 360px. El
   pie va separado con borde: fecha corta a la izquierda, precio y botón a la
   derecha.
 · **Desktop** · las cuatro columnas de siempre, intactas.

La causa del bloque incrustado era el `flex-wrap` del contenedor raíz, que ya
no existe en mobile.

La ubicación se recorta a dos líneas en los dos tamaños, con `title` para verla
entera. No se pierde: el modal de confirmación ya la traía completa en "Dónde"
— verificado, no hizo falta agregarla.

La prematrimonial NO tiene tarjeta equivalente (es un formulario de
preferencias), así que no hubo nada que duplicar.

Revisado en 360px con los tres casos que importaban: ubicación larga, virtual
gratuito y uno con costo casi lleno.

Gotcha: el micro-label quedó como componente a NIVEL DE MÓDULO. Definido
dentro de `GroupRow`, `react-hooks/static-components` lo marca como ERROR —no
advertencia— porque un componente creado en cada render remonta su subárbol.

### [ ] CHK-2 · Aviso de cumpleaños en el check-in (pedido 2026-09-15)

Al hacer check-in de alguien que cumple años en la semana actual, avisarle al
operador para felicitarlo en el momento.

Prompt para Claude Code:

```
FEATURE · Check-in: avisar cuando la persona cumple años esta semana

PANTALLA: src/app/(admin)/eventos/[id]/checkin/page.tsx (y el flujo de QR/smart link si
muestra confirmación al operador).

QUÉ: cuando se hace check-in de una persona cuyo cumpleaños cae en la SEMANA ACTUAL
(lunes a domingo de la semana del evento, comparando solo día y mes de birth_date),
mostrar un aviso visible en la confirmación del check-in: "🎂 [Nombre] cumple años el
[día de semana + fecha] — ¡felicitalo!". Si el cumpleaños es HOY, decirlo explícito
("¡Hoy es su cumpleaños!").

IMPLEMENTACIÓN:
- El cálculo va en una función pura testeable (ej. src/lib/members/cumple-esta-semana.ts)
  que recibe birth_date y la fecha de referencia. Ojo con: birth_date null, cumpleaños
  29 de febrero (tratarlo como 28-feb en años no bisiestos), y semanas que cruzan de año
  (ej. evento 30-dic, cumpleaños 2-ene). Ya hay lógica de cumpleaños en
  src/lib/notifications/birthday-rules — revisala primero: si ahí ya existe "cumple en
  rango", REUTILIZAR, NO INVENTAR.
- El endpoint de check-in (o la búsqueda) ya trae datos del miembro — incluir birth_date
  si no viene, sin consulta extra por fila.
- Es solo un aviso al operador en pantalla: NO manda correos ni notificaciones
  (EMAIL_SILENT_MODE sigue activo y esto no debe depender de él).
- También mostrar el mismo indicador (🎂) junto al nombre en los resultados de búsqueda
  del check-in, para que se vea antes de registrarla.
Tests de la función pura (casos: hoy, dentro de la semana, semana cruzando año, 29-feb,
birth_date null). tsc/lint/vitest al cierre.
```

### [ ] AUT-2 · Limpieza de cuentas de auth sin uso (pedido 2026-09-15)

Optimizar auth.users: dejar cuenta de login solo a quien (a) se haya logueado
alguna vez, o (b) tenga un estudio o una asistencia en los últimos 2 años. Al
resto, borrarle la cuenta de ingreso. **Se borra solo la cuenta de login, nunca
la ficha del miembro** — y como "Creá tu contraseña" recrea la cuenta cuando la
persona vuelve, el borrado es recuperable en la práctica.

Prompt para Claude Code:

```
MANTENIMIENTO · Limpieza de cuentas auth.users sin uso — DRY-RUN OBLIGATORIO

OBJETIVO: reducir auth.users dejando cuenta de login únicamente a quien la usa o
probablemente la va a usar. NUNCA se toca la tabla de miembros ni ningún dato del
perfil: solo la cuenta de autenticación.

CRITERIO — una cuenta SE QUEDA si cumple AL MENOS UNO:
1. Se logueó alguna vez (auth.users.last_sign_in_at IS NOT NULL).
2. Su miembro tiene una matrícula de estudio (cualquier estado menos cancelada) con
   actividad en los últimos 2 años (creada, iniciada o cerrada desde 2024-09-15).
3. Su miembro tiene al menos un check-in de evento/charla desde 2024-09-15.
4. Tiene algún rol asignado (staff/dirigentes/etc. — jamás borrar cuenta con rol).
5. Es cuenta de prueba marcada ([prueba] / @prueba.theosplace.invalid) — esas las
   maneja scripts/limpiar-datos-de-prueba.ts, no este proceso.
Todo lo demás es candidato a borrar.

ETAPA 1 — DRY-RUN (única etapa de esta corrida):
- Script scripts/limpiar-cuentas-auth.ts que genere un reporte (XLSX o CSV) con: total
  de auth.users, cuántas se quedan por cada criterio, y la LISTA COMPLETA de candidatas
  a borrar (email, nombre del miembro, fecha de creación de la cuenta, último
  estudio/asistencia si tiene). NO BORRAR NADA en esta corrida — la lista la revisa y
  aprueba la usuaria primero.
ETAPA 2 — (solo tras aprobación explícita): borrar con supabase.auth.admin.deleteUser(),
  en lotes con pausa, registrando cada borrado en un log. Verificar antes qué pasa con
  las FK: si members referencia auth.users (user_id), poner user_id en NULL, no fallar.
  Idempotente: segunda corrida = cero cambios.
NOTAS: nada de correos a nadie (EMAIL_SILENT_MODE). Confirmar que el flujo "Creá tu
contraseña" funciona para un miembro cuya cuenta fue borrada (debe poder recrearla solo);
si no funciona, reportarlo ANTES de la etapa 2. Test del criterio de selección con
fixtures. tsc/lint/vitest al cierre.
```

### [ ] AUT-3 · Primer ingreso y matrícula: flujo fluido para usuarios nuevos (pedido 2026-09-15)

El camino de un usuario nuevo (entrar por primera vez → crear contraseña →
volver a la matrícula) se siente enredado: hoy pasa por "olvidé mi contraseña",
que confunde a quien nunca ha tenido una.

Prompt para Claude Code:

```
UX · Primer ingreso: que un usuario nuevo entre y se matricule sin fricción

PROBLEMA: la primera vez de un usuario nuevo depende del flujo de "olvidé mi contraseña",
que es confuso para alguien que nunca tuvo contraseña, y el camino hasta matricularse se
siente enredado.

ETAPA 1 — DIAGNÓSTICO (reportar antes de tocar nada):
- Mapear el flujo actual completo de un usuario nuevo: página de login → cómo descubre
  que debe crear contraseña → correo (¿qué plantilla, qué asunto, cuánto dura el enlace?
  ver el pendiente de Fase 0 de OTP < 1h) → dónde aterriza al definirla → cómo regresa
  a lo que quería hacer (¿se respeta ?redirect= de src/proxy.ts en TODO el camino,
  incluido el enlace del correo?).
- Listar cada punto de fricción con captura del estado actual.

ETAPA 2 — MEJORAS (según lo que salga, pero como mínimo):
1. En el login, separar claramente "Primera vez aquí → Creá tu contraseña" de
   "Olvidé mi contraseña" (pueden compartir mecanismo por debajo, pero el usuario nuevo
   no debe leer 'olvidé' ni 'recuperar'). Copys en el lenguaje de Theos.
2. El correo de creación debe decir "Creá tu contraseña", no "restablecer" — revisar la
   plantilla de Supabase Auth / SMTP y ajustar asunto y cuerpo (usar el molde visual de
   baseLayout si el correo sale por nuestro SES; si sale por Supabase, ajustar el template
   en el dashboard y documentar el cambio en docs/).
3. Tras definir la contraseña, aterrizar directo donde iba (?redirect= a /matricula si
   venía de ahí) con sesión ya iniciada — no mandarlo de vuelta al login a reescribir todo.
4. Mensajes de error humanos: correo no registrado ("Este correo no está en nuestra
   base — escribí a X"), enlace vencido ("El enlace venció, pedí uno nuevo aquí" con botón).
5. Estado de carga y confirmación visible al pedir el correo ("Te enviamos un enlace a
   ma***@gmail.com") para que no lo pida cinco veces.
NOTA: los correos de auth de Supabase son transaccionales del propio login — confirmar si
pasan por EMAIL_SILENT_MODE; NO deben quedar silenciados (sin ellos nadie puede entrar),
pero tampoco tocar nada que dispare correos masivos.
Actualizar la infografía/tutorial "Tu primera vez en el sistema" en /ayuda si el flujo
cambia. Probar el camino completo con un usuario de prueba. tsc/lint/vitest al cierre.
```

### [x] REP-4 · Reporte de asistencia: semanas con fechas, no números ISO — HECHO 2026-09-17

Hecho, incluido el EXTRA (comparar dos sedes en el mismo gráfico). La regla de
fechas vive en `lib/reports/rango-de-semana.ts` y la unión de series en
`lib/reports/comparar-series.ts`, las dos con tests. Dos cosas que salieron al
hacerlo y quedaron documentadas en el código: las fechas se anclan a medianoche
de Costa Rica porque `semanaISO()` convierte a hora CR y si no daba off-by-one;
y los `<Cell>` del gráfico se mapean desde la serie unida y no desde
`report.weekly`, porque Recharts los aplica por posición y con la comparación
activa los colores se corrían.

Verificado con datos reales: Meridiano Miércoles arranca el 13–19 jul y
Meridiano Martes baja de ~220 a ~190 por esas fechas — que era justo la
pregunta que originó el ítem.

<details><summary>Prompt original del ítem</summary>

"Semana 38" no le dice nada a nadie; debe leerse "14–20 set". El caso que lo
disparó: querer saber si el decrecimiento de Meridiano Martes desde la semana
26 (= 22–28 jun) coincide con la apertura de los miércoles.

Prompt para Claude Code:

```
UX · Reporte de asistencia: etiquetar las semanas con su rango de fechas

PANTALLA: src/app/(admin)/reportes/asistencia/page.tsx y sus componentes
(SemanaDetallePanel, el gráfico de asistencia semanal, el selector/lista de semanas).

QUÉ: en todo lo que el usuario VE, la semana se muestra como rango de fechas en español
corto: "14–20 set" (mismo mes) o "28 set–4 oct" (cruza mes); si el año mostrado no es el
del reporte (semana 1 que arranca en diciembre), incluir el año. El número ISO puede
quedar como dato secundario en el tooltip ("Semana 38 · 14–20 set"), pero nunca como
etiqueta principal.

DÓNDE APLICA:
1. Eje X del gráfico semanal: con ~52 puntos no caben 52 rangos — mostrar ticks espaciados
   (ya existe xTickInterval) con el formato corto "14 set" (lunes de la semana) y el rango
   completo en el tooltip al pasar el mouse.
2. Tooltip del gráfico: "14–20 set · N asistencias" (+ semana ISO como secundario).
3. El panel de detalle de semana (REP-2) y su título.
4. Cualquier tabla o lista que hoy diga "Semana N".
5. La URL se queda como está (?semana=2026-W37) — es la clave técnica, no se toca.

IMPLEMENTACIÓN:
- Función pura en src/lib/reports/ (ej. rangoDeSemana(year, week) → { desde, hasta,
  etiqueta, etiquetaCorta }) desde la semana ISO: lunes a domingo. Usá la misma definición
  ISO que ya usa el reporte (ojo con REP-3: ya se arregló la mezcla año calendario/semana
  ISO — no reintroducirla). Meses en minúscula estilo es-CR: ene, feb, mar, abr, may, jun,
  jul, ago, set, oct, nov, dic (SET, no sep).
- Tests: semana normal, semana que cruza mes, semana 1 que arranca en diciembre del año
  anterior, semana 53.

EXTRA (mismo esfuerzo, mucha ganancia): en el reporte por charla/sede, permitir COMPARAR
dos series en el mismo gráfico (ej. Meridiano Martes vs Pedregal Miércoles) para ver si
la caída de una coincide con la apertura de la otra. Si el filtro actual es de una sola
sede/charla, agregar un "comparar con…" que superponga la segunda serie con línea punteada
y leyenda. Si esto crece mucho, dejalo para un ítem aparte y reportalo.
tsc/lint/vitest al cierre.
```

</details>

### [x] EVE-12 · Encargados de eventos con alcance por comité — HECHO 2026-09-17

El rol de eventos ya no abre todos los eventos. El que se pone A MANO sigue
abriendo todo (9 personas); el que llega por el PUESTO —184 personas, se los dio
`position-role-sync` por ocupar logística, bienvenida o información en el comité
de su sede— solo alcanza los eventos donde alguno de sus comités es organizador.

La regla vive en `lib/auth/alcance-de-eventos.ts` (pura, con tests) y la aplica
`requireEventAccess`, que es la única puerta. Los seis endpoints que autorizaban
con el rol suelto —checkins, families, members, members/[memberId],
onsite-charge y server-check— pasaron al guard por evento. Un test recorre el
directorio `api/events/[id]` y falla si aparece una ruta nueva con
`requireRoles`, con una lista corta de exentas y su razón.

**Etapa 1 (el dato).** No se podía encender sin él: 174 de 188 charlas no decían
de quién eran, así que la regla le quitaba a esas 184 personas justamente el
check-in que hacen cada semana. Se etiquetaron 170 charlas por su título con
`lib/events/comite-de-la-charla.ts`, aprobadas antes de escribir. Hoy 184 de 185
eventos de los últimos 90 días tienen comité.

**Las Youth van todas al Comité Youth**, que ya existía con cinco puestos.
Llegué a crear tres comités Youth aparte (Pedregal Domingo, Pedregal Miércoles y
Cartago) y fue un error: partía en tres un equipo que es uno solo y dejaba a esos
cinco sin alcance sobre ninguna de sus 28 charlas. Se borraron el mismo día.

Medido antes de encender (últimos 90 días): **nadie queda en cero**. Cada quien
alcanza entre 9 y 42 eventos, los de su sede. Verificado después con personas
reales: Natalia (Sede Meridiano Martes) opera 3 de 58 charlas; Mariana (Comité
Youth) las 7 Youth de las tres sedes; Finanzas, con el rol manual, las 58.

Dos huecos que aparecieron al implementar y se cerraron:

- **Crear un evento a nombre de otro comité** esquivaba la regla entera: bastaba
  poner "Sede Cartago" de organizador. El POST rechaza con 403 en vez de
  recortar la lista en silencio, y además exige elegir comité.
- **Editar el evento propio y cambiarle el organizador** era poder firmarle un
  evento a otra sede. El PUT valida los comités nuevos contra el alcance.

**Pendiente operativo:** el taller **"Entre Mujeres"** es el único evento sin
comité organizador, así que hoy solo lo operan los roles manuales y dirección.
Asignarle comité desde la pantalla del evento lo resuelve.

En la pantalla: el selector de comités organizadores se limita a los suyos, el
detalle de un evento ajeno no muestra las pestañas de gestión (mostrar una
pestaña que devuelve 403 es peor que no mostrarla) y el buscador de check-in
solo lista los eventos que puede operar.

### [x] UX-5 · Después del login: "Cargando…" en vez de "no hay cuenta asociada" — HECHO 2026-09-17

La causa era una sola línea en `/matricula`: `if (!effectiveMemberId)`. El
`AuthProvider` arranca en `{ user: null, loaded: false }` y resuelve la sesión
con un fetch a /api/auth/me, así que mientras ese fetch viaja el miembro es
`null` — el mismo valor que tiene alguien que de verdad no tiene ficha. Dos
situaciones distintas con el mismo valor, y por eso una se veía como la otra.

La regla de los tres estados (`cargando | sin_ficha | lista`) vive en
`lib/auth/estado-de-la-sesion.ts` y no en la pantalla, porque el error es fácil
de repetir: la pregunta natural al escribir la pantalla es "¿hay miembro?", y
esa es justamente la pregunta equivocada.

Barrí el resto de `src/`: **la única pantalla rota era matrícula**. `/mis-pagos`
ya esperaba a `loaded`, pero pasó a usar la misma función y el mismo texto para
que no queden dos versiones de la regla.

De paso el mensaje dice qué hacer. Antes era "No hay un miembro asociado a tu
cuenta", que suena a culpa de quien lo lee y no ofrece salida; ahora incluye el
correo al que escribir, porque esto no lo puede arreglar la persona sola.

**Y la espera se acortó de verdad.** El usuario aclaró que el mensaje se veía
"un par de segundos", y eso era literal: `/api/auth/me` hacía NUEVE consultas en
fila —2.008 ms medidos sobre una ficha real—, con el comité de estudios (492 ms)
y los accesos a formularios (599 ms) esperando cada una a la anterior sin
necesitar nada de ella. Ahora van en `Promise.all`: **1.028 ms → 388 ms de
promedio** sobre 25 cuentas reales. Todo el sitio espera a este endpoint para
saber quién es, así que la mejora se siente en cada pantalla, no solo en
matrícula.

Verificado que el payload no cambió: se reprodujeron las dos versiones sobre las
mismas 25 fichas y se compararon campo por campo — **25 de 25 idénticos**.
Paralelizar es fácil de hacer mal y eso no lo agarra el compilador.

**No se verificó en el navegador**: /matricula exige sesión y no puedo entrar
con las credenciales del usuario. Lo que sí está fijado son los tres estados y
un test que lee el fuente y falla si la condición vuelve a colgarse solo del
miembro (verificado contra el código viejo: lo detecta).

### [x] GRU-3 · Detalle de grupo: lo que ve el estudiante y lo que ve el dirigente — HECHO 2026-09-17

La regla vive en `lib/studies/roster-por-alcance.ts` y el recorte lo hace el GET
del grupo, no la UI: esconder una columna en pantalla no esconde el dato, viaja
igual en el JSON.

Dos cosas que salieron al hacerlo. (1) El estudiante NO veía a sus compañeros:
el endpoint le devolvía solo su propia inscripción, así que el cambio no fue
recortar sino AGREGAR la lista con nombres. (2) El bloqueo del perfil para el
dirigente ya existía en el servidor —`canViewMemberProfile` exige módulo
`miembros` más allá de 'own'—, así que lo único que faltaba era quitar el enlace,
que llevaba a un 403. Hay un test que fija las dos cosas.

Verificado contra un grupo real de 13 participantes: gestión y dirigente reciben
`phone` y `birth_date`; el estudiante recibe solo `first_name` y `last_name`, sin
`grade` ni `notes`.

Reglas nuevas de visibilidad en el detalle de grupo:
- **Estudiante**: solo info del grupo + lista de compañeros con NOMBRE. Nada
  más: sin tab de asistencia, sin teléfonos, sin detalles administrativos.
- **Dirigente**: la lista de estudiantes con nombre + **teléfono + fecha de
  cumpleaños** (columnas nuevas), pero **nunca acceso al perfil** de la
  persona (se elimina ese enlace/poder). Aplica igual a sus grupos pasados:
  del histórico solo ve la lista, no perfiles.

Prompt para Claude Code:

```
PERMISOS + UI · Detalle de grupo de estudio: vistas por rol

PANTALLA: src/app/(admin)/estudios/grupos/[id]/page.tsx + los endpoints que la alimentan.
Autorización server-side además de UI — esconder tabs no basta.

VISTA ESTUDIANTE (miembro matriculado en el grupo, sin rol de gestión ni ser su dirigente):
- Ve: datos del grupo (nombre, horario, zona/ubicación, dirigente y su contacto —eso ya
  se pidió antes—, fechas) y la lista de compañeros SOLO con nombre. Explícito: al
  estudiante NO se le muestran ni teléfono ni cumpleaños de nadie.
- NO ve: tab de pasar asistencia, teléfonos/correos de compañeros, estados de pago, notas,
  ni ninguna acción administrativa. Verificar que los endpoints que devuelven la lista no
  manden esos campos a un estudiante (recortar en el server según quién pide, patrón de
  studies-scope.ts).

VISTA DIRIGENTE (dirigente o co-dirigente del grupo, actual O histórico):
- Ve la lista de estudiantes con: nombre, TELÉFONO y FECHA DE CUMPLEAÑOS (día y mes; el
  año no hace falta para felicitar — incluirlo solo si ya se muestra en otros lados).
- Puede pasar asistencia y cerrar (lo operativo de HOY se mantiene en grupos activos).
- Se ELIMINA cualquier enlace/navegación de la lista al perfil del miembro (/miembros/[id])
  y el server debe negarle ese endpoint si no tiene otro rol que se lo permita — revisar
  requireRoles/requireModuleView del perfil: dirigente por sí solo NO abre perfiles.
- Grupos PASADOS que dirigió: solo la lista (nombre, teléfono, cumpleaños), sin acciones.

ROLES DE GESTIÓN (coordinador_estudios, admin, etc.): siguen viendo todo, y ADEMÁS
agregar las mismas dos columnas (teléfono y cumpleaños) a la lista de estudiantes que
ellos ven en el detalle de grupo — hoy no las tienen a mano. Si la lista se exporta
(XLSX/CSV), incluirlas en el export también.

Tests: estudiante no recibe teléfonos ni ve tab de asistencia (assert sobre la respuesta
del endpoint, no solo la UI); dirigente recibe teléfono+cumpleaños pero el perfil le da
403; gestión intacta. tsc/lint/vitest al cierre.
```

### [x] NOT-2 · Campanita del cobro pendiente + plazo unificado — HECHO 2026-09-17

Resuelto el conflicto que el ítem marcaba: **72 horas fijas para todos**
(decisión del usuario). Con eso todos los plazos del sistema dicen lo mismo —
los eventos con comprobante rechazado y el recordatorio de pago ya usaban 72; la
matrícula de estudio era la única con 24.

Tres cosas que cambiaron respecto de lo que pedía el prompt, y por qué:

1. El aviso NO va al matricularse sino a las **48 horas**. Ese aviso ya existió y
   se quitó el 2026-09-01 con medición: la gente sube el comprobante en minutos
   (4 de 4, promedio 3 min), así que los 4 avisos salían equivocados. A las 48
   quedan 24 y todavía se puede hacer algo.
2. Se excluyen las matrículas con **plan de pagos**. No estaba en la lista de
   exclusiones del prompt y era necesario: los tractos tienen su propia fecha de
   vencimiento (el de Irina Morales vence el 30-set) y el barrido los habría
   soltado por medir "horas desde que se creó el cobro".
3. El dry-run va por `?dry=1` y no por método GET: Vercel invoca este cron con
   GET (`export const GET = POST`), así que un handler GET propio habría
   suplantado la corrida real.

El aviso y la baja viven en el MISMO barrido, que ya corría a diario: comparten
consulta y reloj, así que nunca pueden discrepar sobre cuántas horas pasaron.

Si tengo un cobro pendiente de un estudio (me matriculé y no adjunté
comprobante, o me inscribieron manualmente), que la campanita me avise: tengo
un pendiente y la matrícula dura 24 horas; si no, se desmatricula para liberar
el cupo.

**⚠️ Conflicto a resolver antes de correr**: la regla vigente es que el cron NO
expira matrículas y que el cupo se libera a las 72h solo tras comprobante
RECHAZADO. Esto introduce: sin comprobante → 24h y desmatrícula. Confirmar con
Floriana si las 24h aplican también a inscripciones manuales (caso: Ari
inscribe a alguien que va a pagar por SINPE después) y si conviven o se
unifican con las 72h.

Prompt para Claude Code:

```
FEATURE · Notificación de cobro pendiente + desmatrícula automática a las 24h

ANTES DE CODIFICAR: leé la regla vigente de pagos (matrícula efectiva de inmediato, cupo
se libera a las 72h tras comprobante rechazado, cron no expira matrículas). Esta feature
la MODIFICA: matrícula con pago requerido y SIN comprobante subido → 24 horas de plazo y
desmatrícula automática. Reportá cómo queda el cuadro completo de reglas (sin comprobante
= 24h; comprobante rechazado = 72h para resubir; beca 100% = sin plazo) y señalá cualquier
contradicción que encontrés antes de implementar.

PARTE 1 — CAMPANITA (notificación in-app, NO correo — EMAIL_SILENT_MODE aparte, esto es
in-app y no depende de él):
- Al crear una matrícula con pago requerido sin comprobante (auto-matrícula o inscripción
  manual de staff), crear notificación para el miembro: "Tenés un pago pendiente de
  [estudio]. Subí tu comprobante antes de [hora límite] o tu matrícula se liberará para
  darle el cupo a otra persona", con link directo a Mis pagos.
- Reutilizar el sistema de notificaciones existente de la campanita — REUTILIZAR, NO
  INVENTAR. Si hay recordatorio intermedio barato (ej. a las 20h), agregarlo.

PARTE 2 — DESMATRÍCULA AUTOMÁTICA:
- Cron (patrón de vercel.json + CRON_SECRET + healthcheck, como los existentes): matrículas
  con pago requerido, sin comprobante subido, sin beca aplicada y con más de 24h → cancelar
  la matrícula, liberar el cupo, marcar el cobro como vencido/cancelado (no dejarlo
  huérfano) y registrar en audit_log. Notificación in-app al miembro de que se liberó.
- EXCLUIR: becas 100%, pagos ya en revisión (comprobante subido cuenta como cumplido
  aunque no esté aprobado), matrículas migradas/históricas, y datos [prueba].
- El plazo va en una constante configurable (HORAS_PLAZO_COMPROBANTE = 24) con comentario
  de por qué.
- DRY-RUN primero: modo lista que muestre a quiénes desmatricularía HOY con los datos
  reales, para revisión antes de activar el cron.
Tests: matrícula nueva genera notificación; a las 24h sin comprobante se cancela y libera
cupo; con comprobante subido NO se toca; beca 100% NO se toca; idempotente. tsc/lint/vitest.
```

## Fase 18 — Pedido el 2026-09-16

### [ ] AUD-2 · El historial de cambios no se puede ver desde ninguna pantalla

**El caso que lo pidió.** Preguntaron quién había movido a Pamela Fonseca entre
dos grupos de SCJ y cuándo. La respuesta estaba en la base, pero llegar a ella
necesitó escribir un script: no hay ninguna pantalla donde ver qué le pasó a una
persona, a un pago o a una matrícula.

**Lo que hoy tenemos y no se usa.** `audit_log` tiene 370 mil filas y pesa
315 MB, el 65% de la base entera. La app lo consulta en UN solo lugar:
`getRecentActivity()` (dashboard.ts), que trae los últimos 10 por fecha para el
feed de actividad. Nada más. Es una tabla de solo escritura.

**Por qué ahora sí vale la pena.** Hasta el 2026-09-16 el log no servía ni
aunque se mirara: `log_changes` guardaba `auth.uid()`, que con la llave de
servicio es siempre NULL, así que 369.772 de 370.002 filas no tienen autor.
Desde la migración `20260916190000` (más `20260917000000`, que le quitó el
bloque EXCEPTION que la hacía 4× más lenta) el actor sí queda registrado. O sea:
el dato útil empieza hoy.

**Qué hacer.**

1. Panel de historial en el detalle de una persona, un pago y una matrícula.
   Leer de `audit_log` por `entity_type` + `entity_id`, más reciente primero.
2. Renderizar el diff de forma legible. El dato ya viene acotado a lo que
   cambió (AUD-1): `old: {"birth_date":"1965-09-09"} new: {"birth_date":null}`.
   Traducir los nombres de columna a etiquetas humanas y formatear fechas y
   montos; un JSON crudo no lo lee nadie.
3. Resolver el nombre de quien hizo el cambio. `actor_id` referencia
   `auth.users`, así que el puente es `members.auth_user_id` (ver
   `resolverNombresDeQuienCancelo` en `queries/scholarships.ts`, que ya hace
   exactamente eso). Sin actor → "el sistema".
4. Permisos: es información sensible. Restringir con `requireModuleView` del
   módulo correspondiente, no dejarlo abierto a cualquier sesión.

**Rendimiento — medido el 2026-09-16, no estimar.** El índice es
`(entity_type, entity_id)` y una consulta que filtra SOLO por `entity_id` no lo
puede aprovechar: **1.301 ms en frío y 2.278 buffers para traer 7 filas**. Con
un índice por `entity_id` solo baja a **4 buffers**. Ese índice NO se agregó
todavía a propósito: hoy costaría en cada escritura para una consulta que nadie
hace. Va junto con esta pantalla, no antes. Si la pantalla filtra por las dos
columnas (`entity_type` + `entity_id`), el índice actual ya alcanza y no hace
falta agregar nada — medirlo antes de decidir.

**Dos cosas de retención que hay que resolver acá.**

- `prune_audit_log()` borra todo lo de más de 90 días (pg_cron, 04:00 UTC). Con
  el autor recién guardándose desde hoy, **el historial útil solo llegará hasta
  diciembre de 2026**. Si el historial va a ser una función del producto, hay que
  decidir la retención antes de que se venza lo primero.
- Las cargas masivas deberían correr con el trigger apagado. 294.613 de las
  370 mil filas son del reimport de estudios del 18-jul (223.601 en un solo
  día), no le sirven a nadie para auditar y empujan lo útil fuera de la ventana
  de 90 días. Eso se drena solo el 16-oct-2026, pero vuelve con el próximo
  import.


### [ ] SEC-3 · Warnings del linter de Supabase (reportados 2026-09-16)

Cinco avisos de seguridad. **Ninguno explica lentitud** —se revisaron el mismo día
que se reportó el sistema lento y la causa era otra (ver el commit de
`20260917000000`)—, pero valen por sí solos.

1. **`merge_no_copia` sin `search_path`.** Es el único de los tres que es
   trivial: `alter function ... set search_path to 'public'`. Todas las demás
   funciones del esquema ya lo tienen.
2. **`member_por_external_id(text)` es SECURITY DEFINER y la puede llamar
   `anon`** por `/rest/v1/rpc/`. Ésta es la que importa: devuelve la ficha que
   corresponde a un id de CCB, o sea datos de una persona, y hoy la puede
   invocar cualquiera sin sesión probando ids. Es SECURITY DEFINER a propósito
   (tiene que ver fichas inactivas para resolver las fusionadas), así que la
   salida es `revoke execute ... from anon, authenticated` y dejarla solo para
   `service_role`, que es como la llama la app. Verificar antes que ningún
   cliente la invoque directo.
3. **`report_charla_attendance()` con el mismo problema.** Agrega asistencia de
   toda la organización; que la pueda pedir `anon` no tiene sentido. Mismo
   `revoke`. OJO: `fetchAllRpc` la llama paginada desde el servidor con la
   llave de servicio, así que revocarle a `anon` y `authenticated` no rompe la
   app — confirmarlo corriendo el reporte después.

Cerrar junto con **DAT-9**, que es sobre la misma función
`member_por_external_id` y hoy está sin llamadores en el código.

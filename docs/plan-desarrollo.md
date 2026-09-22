# Plan de desarrollo — pendientes

> Limpiado el 2026-09-10: solo lo pendiente. El historial completo
> (96 puntos cerrados con sus notas de implementación y decisiones) está en
> `docs/plan-desarrollo-cerrado.md` — consultarlo antes de reabrir discusiones ya decididas.


## Fase 0 — Operativo (sin código, sesión de configuración)

- [ ] Agregar las env `HEALTHCHECK_URL_*` en Vercel. **La lista completa (16, una por cron)
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
  lint y `vitest` antes de dar por terminado (la verja de CI usa `--max-warnings=60`, solo baja).
  Contar SIEMPRE con la caché borrada: `rm -rf .eslintcache && npx eslint src --max-warnings=60`.
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


## Fase 20 — Lo que salió el 2026-09-21 y espera decisión

Nada de esto es trabajo que yo pueda arrancar solo: necesitan que alguien
decida. EVE-13, DAT-11 y DAT-13 ya se resolvieron.

### [ ] SEC-4 · Las cuentas de PRUEBA siguen vivas

17 fichas `[prueba]` y 7 cuentas de auth con correo `@prueba.theosplace.invalid`,
**sin bloquear**, y tres de ellas se usaron el 10 de setiembre. Comparten una
contraseña que estaba escrita en el centro de ayuda; ese artículo se borró el
2026-09-21 pero las cuentas quedaron.

Decidir: borrarlas o bloquearlas. Bloquear es reversible y conserva el historial
—mismo criterio que los menores—; borrar deja el padrón limpio. El seed vive en
`scripts/seed-datos-de-prueba.ts` y puede volver a crearlas cuando haga falta.

### [x] DAT-11 · Nueve correos en dos fichas a la vez — HECHO 2026-09-21

Los correos dirigidos a una persona caían en la bandeja de otra. Comunicación
confirmó uno por uno de quién era cada correo y se le quitó a la otra ficha
(`scripts/dat11/corregir.cjs`, dry-run y después aplicado):

| Correo | Se lo queda | Lo pierde |
|---|---|---|
| adripicadom.ap@gmail.com | Adriana Picado Marin | Francisco Viquez Picado |
| aduarte86@gmail.com | Alejandro Duarte Torres | Alejandro Monge |
| avm150593@hotmail.com | Andrea Viquez Murillo | Santi Sanchez |
| cuellarcr@hotmail.com | Monica Cuellar Gonzalez | Ofelina Gomez Gomez |
| davromen@gmail.com | David Enrique Mendez Roman | Mariela Saravia Valverde |
| job.morales231099@hotmail.com | Job Morales Segura | Graciela Segura Hernandez |
| katygose@gmail.com | Kathia Gomez Sequeiera | Sussy Mariela Barrantes Loaiciga |
| lilliana.chavesb30@gmail.com | Lilliana Chaves | Lilliam Bermúdez Pérez |

Ninguna de las fichas que perdió el correo tenía cuenta de auth, así que nadie
dejó de poder entrar: lo que estaba mal era el correo de contacto, no el
vínculo. El guard del script se habría negado a correr si alguna la tuviera.

**El noveno no se tocó a propósito.** `sarguedas@icloud.com` es del papá o
encargado de Lucía y Naomy Sánchez Arguedas, nacidas en 2018 y 2024. Que esté
en las dos fichas está bien, y es exactamente el caso que DAT-12 tiene que
dejar pasar.

**De paso, una cédula cruzada:** la 107130768 estaba en la ficha de Sussy
Barrantes y es de Kathia Gómez. Se movió. Ojo que la ficha de Sussy quedó con
nombre y fecha de nacimiento nada más — si resultara ser la misma persona, eso
es una fusión y se hace aparte.

Verificado contra la base después de aplicar: queda 1 correo repetido (el del
papá) y la cédula en una sola ficha. Como efecto secundario, de las 6 cuentas
que apuntaban a la ficha equivocada —el patrón de Tatiana— cuatro se arreglaron
solas; las otras dos son DAT-13, acá abajo.

### [x] DAT-13 · Dos cuentas sueltas del barrido — HECHO 2026-09-21

Salieron de medir DAT-11, y al mirarlas de cerca **los dos casos eran otra cosa
de la que yo había anotado**. Lo dejo escrito porque la lección se repite: el
primer diagnóstico salió de una consulta que filtraba por `is_active`, y las dos
fichas culpables estaban inactivas.

**Manuel Flores — no eran dos fichas vivas.** La vieja ya se había fusionado el
2026-08-04. Lo que quedó mal es que la CUENTA DE AUTH se quedó colgando de la
ficha MUERTA, así que al entrar no veía su ficha real: el bug de Tatiana otra
vez, con otra causa. Se le movió la cuenta a la ficha viva y se le quitó el
correo a la muerta.

De paso, un check-in huérfano. La fusión dejó 6 en la ficha muerta: **cinco son
del mismo evento que la ficha viva ya tenía** —duplicados, y moverlos lo
contaría dos veces, por eso `merge_members` los deja—, pero el del 16-jul-2026
es de un evento que la viva no tenía. Ese se movió: Manuel asistió y no le
contaba. Quedó en 37 check-ins.

**Sebastián Garro — tenía dos cuentas.** La buena, `sebasgarro1@gmail.com`, se
la hizo él el 9 de setiembre y está bien amarrada a su ficha (cédula 111760822,
21 check-ins). La otra, `sebasgaes@hotmail.com`, salió de la creación masiva del
29-jul y la ficha a la que apuntaba se fusionó el 11-set: hoy no apunta a nada,
o sea que quien entrara con ella veía el sistema vacío y sin permisos — que es
justo lo que él hizo el 9 de setiembre.

Se **bloqueó** la vieja, no se borró: bloquear se deshace con un clic. Si
resulta que prefiere el hotmail, se desbloquea y se le mueve el vínculo.

Verificado contra la base: las dos consultas que los encontraron —cuentas que
apuntan a otra ficha, y cuentas sin ficha— quedaron en cero.

### [ ] DAT-12 · La validación de correo duplicado choca con FAM-2

Hoy crear o editar con un correo que ya existe en otra ficha devuelve 409, un
bloqueo duro. Eso impide lo que FAM-2 sí quiere: **que un menor lleve el correo
de su papá**. Hoy no se puede hacer desde la pantalla.

Opciones: relajarlo a advertencia (deja pasar todos los duplicados, incluidos los
accidentales) o permitirlo **solo cuando la persona es menor**, que mantiene el
bloqueo donde importa y abre exactamente el caso legítimo. Me inclino por la
segunda.

### [x] EVE-13 · Semillitas: los dos eventos se quedan — DECIDIDO 2026-09-21

Del enredo de duplicar del 2026-09-21 sobrevivieron dos "Semillitas Kids&Teens":
uno que arranca el **12 de setiembre cada dos sábados** y otro el **17 de octubre
cada sábado**. La copia ya se borró y ninguno de los dos tenía check-ins ni
inscripciones.

Comunicación decidió dejar los dos como están. No se borra ninguno.


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

### [x] FIN-4 · Planes de pago para matrículas e inscripciones — YA EXISTE (verificado 2026-09-18)

Los arreglos en tractos ya están implementados (`lib/finance/installments.ts`,
`queries/payment-plans.ts`): reparto exacto por moneda, tracto vencido bloquea
matrícula/inscripción, cancelar ≠ condonar. Lo que falta es la frecuencia
quincenal → FIN-8.

### [ ] FIN-8 · Arreglos de pago: frecuencia mensual o quincenal (pedido 2026-09-18)

Hoy los tractos vencen solo mensual. Al crear el arreglo se debe poder elegir
mensual o quincenal, y que los cobros/recordatorios corran sobre esas fechas.

Prompt para Claude Code:

```
FEATURE · Arreglos de pago (FIN-4): elegir frecuencia mensual o quincenal

BASE EXISTENTE (no rehacer): lib/finance/installments.ts (splitAmount,
monthlyDueDates, planInstallments, isOverdue) y queries/payment-plans.ts
(createPaymentPlan). Los tractos son filas normales de payments — eso no cambia.

CAMBIOS:
1. installments.ts: nueva biweeklyDueDates(firstDue, count) — vencimientos cada 15 días
   exactos a partir del primer vencimiento (firstDue, firstDue+15d, +30d…). Es la
   interpretación simple y predecible de "quincenal"; NO amarrar a los días 15/30 del
   mes salvo que finanzas lo pida distinto. planInstallments recibe
   frequency: 'mensual' | 'quincenal' (default 'mensual' para no romper llamadores).
2. payment_plans: columna frequency ('mensual'|'quincenal', default 'mensual' — las
   existentes quedan mensuales sin migración de datos).
3. createPaymentPlan y el endpoint POST /api/payments/[id]/payment-plan aceptan
   frequency; validación con zod si el endpoint ya la usa.
4. UI del modal de crear arreglo: selector Mensual/Quincenal junto a "primer
   vencimiento" y "número de tractos", con vista previa de las fechas generadas antes
   de confirmar (si el modal ya muestra los tractos, solo recalcula con la frecuencia).
5. Todo lo que consume due_date (isOverdue, bloqueos, cron payment-reminders,
   vista de finanzas) ya lee fechas — verificar que NINGUNO asuma "un tracto por mes"
   (buscar usos de monthlyDueDates y lógica de meses); ajustar el que lo asuma.
Tests: biweeklyDueDates (cruce de mes y de año, 15 tractos), planInstallments con las
dos frecuencias, endpoint rechaza frecuencia inválida. tsc/lint/vitest al cierre.
```

### [ ] EVE-11 · Google Wallet y Apple Wallet

Que el pase del evento se pueda guardar en la billetera del teléfono, en vez de
depender del QR en un correo. Las dos plataformas piden cuenta de desarrollador
y firma de los pases; hay que ver el costo y quién administra las credenciales
antes de escribir código.

### [ ] FIN-5 · Tilopay

Pasarela de pago. Hay que revisar qué reemplaza y qué convive con lo que ya
existe, y si entra en el mismo flujo que FIN-4.

### [x] REP-1 · Actualizar todos los reportes — HECHO 2026-09-21 (REP-2 a REP-10)

Revisión completa de `/reportes`: qué sigue sirviendo, qué quedó desactualizado
y qué falta. Decisión del usuario 2026-09-21: **esto es lo que se está haciendo
con los reportes nuevos**, no un ítem aparte.

**La dependencia de DAT-5 NO existe, verificado el 2026-09-21.** El plan decía
"hacerlo después de DAT-5 porque varios reportes leen esos datos". Se revisaron
las tres funciones que alimentan los reportes de estudios: ninguna lee `grade`
ni la etiqueta aprobado/reprobado, que es justo lo que falta en los 11.420. La
única que toca el tema —`get_dm_milestones`— usa `status = 'completed'`, y ese
dato SÍ está bien: DAT-5 dice explícitamente que nadie quedó `enrolled` en un
grupo cerrado. Así que REP-1 nunca estuvo bloqueado.

Completo el 2026-09-21. REP-2 (semana sola), REP-3 (año ISO), REP-4 (semanas
con fecha), REP-5 (asistentes + abandonos), REP-6 (personas nuevas con la
definición corregida), REP-7 (servidores y compromisos), REP-8 (seis ajustes al
detalle de semana + demografía), REP-9 (estudios) y REP-10 (canal en el anual +
el filtro que aplica a todo).

Dos bugs que salieron de hacerlo, los dos de datos truncados en 1.000 filas por
el tope de PostgREST: uno en "Mi comité" —mostraba sin estudio a gente que sí
tenía— y otro en la demografía, que decía 849 personas cuando son 4.355.

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

### [x] DAT-8 · Menores de 12 con correo y sin familia — CERRADO 2026-09-18, de 54 a 2

Salió de limpiar los correos de menores (2026-09-10). Quedaban 54 a los que NO
se les podía quitar el correo: sin familia detrás se quedaban sin ninguna forma
de contacto.

LA CLAVE FUE SEPARAR DOS PROBLEMAS que vivían mezclados, con una señal
mecánica: si el correo lleva el **nombre de pila** de la propia persona
(`src/lib/members/correo-de-quien.ts`). El apellido NO cuenta — madre e hijo lo
comparten, y `cristellopeztorres@` daría por propio el correo de la ficha de
Camilia Sanabria **Lopez**.

**CERRADO el 2026-09-18.** Se clasificaron los 24 que quedaban contra el padrón
completo y salió un dato que cambió la conclusión: **ninguno tenía el correo ni
el teléfono de un adulto del padrón**. O sea que lo que quedaba NO era un
problema de familias sin vincular: eran fichas de adultos con la fecha mal.

El usuario decidió vaciar la fecha de **22 de las 24**. Las dos que se salvan,
Lucía y Naomy Sánchez Arguedas, son hermanas de verdad: comparten el correo de
un adulto que no tiene ficha y son las ÚNICAS con check-in en un evento Youth.
El resto que asistió fue a charlas, que son de adultos.

La exclusión se hizo por esa señal y no por una lista de nombres escrita a mano
(`scripts/dat8/borrar-fechas.cjs`): así no depende de copiar bien dos nombres y
un caso nuevo igual se salva solo.

Por qué vaciar y no corregir: nadie sabe la fecha real, y con una falsa el
sistema los trata como menores —no les crea cuenta, les exige familia, los
cuenta mal en todo reporte por edad—. Sin fecha simplemente no se sabe, que es
la verdad; FAM-2 ya contempla que sin fecha NO se asuma menor.

**Se puede deshacer:** el valor viejo quedó en `audit_log.old_data`, y ahora se
ve desde la pantalla de historial (AUD-2) con el nombre de quien lo pidió — son
los primeros cambios del sistema que quedan firmados.

No se creó ni se invitó ninguna cuenta: vaciar la fecha es un update de esa
columna y nada más. Decisión explícita del usuario.

Queda una nota para después: **el mismo criterio sirve para todo el padrón.**
Si hay fichas con fecha falsa que SÍ tienen familia, no salieron en esta lista y
nadie las ha buscado.

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

### [x] API-1 · El PATCH de becas valida a mano, no con zod — HECHO 2026-09-17

Los dos handlers (`PATCH /api/scholarships/[id]` y `POST .../coupons`) pasaron a
zod, con los esquemas en `api/scholarships/schema.ts`. Eran quince `if`s
armando cada uno su propio 400.

**No es cosmético.** Con `if`s encadenados el handler contesta SOLO el primer
campo malo, así que quien llena el formulario de un cupón con tres errores los
descubre de a uno. Hay un test que lo fija: los cuatro campos malos salen juntos.

Y apareció un agujero real: la versión vieja elegía el destino con
`entity_type === 'study_plan' ? plan_id : event_id`, así que un body con
`entity_type: 'event'` y un `plan_id` válido pasaba la validación con el destino
en `undefined`. Ahora el destino es una unión discriminada por `entity_type` y
ese caso se rechaza. También hay test.

Dos cosas que se conservaron a propósito y casi se pierden: el monto del cupón
acepta texto (lo hacía el `Number(...)` de antes, y el input lo manda así), y la
pantalla envía SIEMPRE `plan_id` y `event_id`, uno en null. Los dos tienen test
con el body literal que manda la pantalla — sin eso, mover una beca se habría
caído con 400 en producción sin que ningún test lo dijera.

De paso, el 400 salió a `lib/api/datos-invalidos.ts`: esa línea está copiada en
decenas de handlers y en algunos salía distinta, así que el cliente no podía
confiar en la forma de `detalles`.

### [ ] FIN-7 · Josué Valverde pagó ₡20.000 de más

Se matriculó y pagó el estudio completo antes de que su beca —del 100%— se le
asignara. No es un bug: es plata que hay que devolver o acreditar, y **la
decisión es del usuario**, saldo a favor o devolución. Las de Gisselle y
Valeria ya se resolvieron el 2026-09-11.

### [~] LINT-1 · De 70 a 60 warnings — la mitad de los hooks migrados

Van tres tandas (93 → 70 → 60). El techo del gate bajó a **60**.

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

**No es trabajo pendiente: es una nota para el próximo import.** SEC-3
(2026-09-17) la dejó ejecutable solo con la llave de servicio, que es como la
llamaría ese import de todos modos.

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

### [x] CHK-2 · Aviso de cumpleaños en el check-in — HECHO 2026-09-17

La regla vive en `lib/members/cumple-esta-semana.ts`. La semana es de LUNES a
DOMINGO y se recorren los siete días de verdad, no se compara "MM-DD entre A y
B": esa comparación se rompe justo en la semana que cruza el año —un cumpleaños
el 02-01 es "menor" que el 12-30 del lunes— que es cuando más gente felicita.
Hay un test con ese caso.

El 29 de febrero NO se resuelve ahí: se le pregunta a `birthdayMatchDays`, que
ya decide que en año no bisiesto esa gente se festeja el 28. Reutilizado, no
reescrito, como pedía el ítem.

**El cumpleaños viaja SIN AÑO.** `/api/members/lookup` devuelve `birth_md`
("MM-DD"): el operador necesita el día para felicitar, no la edad de la persona.
El recorte se hace en la consulta, no escondiendo una columna en pantalla —misma
línea que GRU-3—. Verificado contra 8 fichas reales: ninguna trae el año, ningún
`birth_date` suelto se cuela, y el MM-DD coincide con la ficha en 8 de 8.

Se ve en tres lugares: 🎂 junto al nombre en los resultados de búsqueda (antes
de marcar, igual que la marca de "ya registrado"), el aviso completo en la
tarjeta de confirmación, y dentro del flash del QR —por ahí no hay tarjeta, se
registra y ya, así que si no va en el flash el operador no se entera—.

Verificado en el navegador con la tarjeta servida aparte (la pantalla real exige
sesión). El contraste del aviso está MEDIDO y fijado en `contrast.test.ts`:
coral-deep sobre `bg-coral/10` da 4.66:1; con coral a secas serían 3.97:1 y no
pasaría — la diferencia entre las dos clases es una letra.

No manda correos ni notificaciones: es un aviso en pantalla. El saludo por
correo (DIR-2) sigue siendo otra cosa y no se tocó.

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

### [x] AUT-3 · Primer ingreso y matrícula — HECHO 2026-09-21

**Etapa 1, el diagnóstico.** El camino de alguien que nunca tuvo contraseña era:

```
/login?redirect=/matricula
  → "Restablecé tu contraseña"      ← acá se PERDÍA el destino
  → correo → /auth/continuar → /recuperar/nueva-contrasena
  → define la contraseña
  → router.push('/login')           ← y acá a escribirla otra vez
```

**Etapa 2, tres arreglos.**

1. **No más rebote al login.** Al abrir el enlace del correo la sesión YA quedó
   abierta —por eso esa pantalla puede leer su correo y saludarlo—, así que
   devolverlo al login es pedirle que se identifique cuando el sistema ya sabe
   quién es. Quien nunca tuvo contraseña lee ese rebote como "no funcionó" y
   vuelve a pedir el enlace.

2. **El destino sobrevive el viaje.** Va del login a `/recuperar`, de ahí al
   cuerpo del POST, de ahí al `next` dentro del enlace del correo, y de vuelta.
   Quien venía de la matrícula aterriza en la matrícula.

3. **El botón ya no dice "Restablecé"**, que es la palabra que confunde a quien
   nunca tuvo contraseña. Dice "Conseguí tu contraseña", cierto en los dos
   casos. **Sigue siendo un solo enlace**: partirlo en dos es justo lo que se
   quitó el 2026-09-01 porque los dos iban al mismo flujo. El que sí distingue
   es el correo, porque el servidor sí sabe cuál es ("Definí" vs "Restablecé").

**Lo que NO se hizo, de lo que pedía el ítem:** decirle a alguien "este correo
no está en nuestra base". La respuesta es neutral a propósito — si no,
cualquiera averigua quién está en el padrón escribiendo correos. La única
excepción es el menor de edad, que se agregó aparte el mismo día.

Lo del enlace vencido ya estaba resuelto de antes: tiene su mensaje y su botón
de "pedir un enlace nuevo".

La regla vive pura y testeada en `lib/auth/destino-tras-la-contrasena.ts`. Y hay
un guard nuevo que lee el login de verdad: el correo de "tu cuenta ya está
lista" CITA el texto del botón para que la persona lo busque en la pantalla, así
que cuando el botón cambió el correo quedó mandando a tocar algo que ya no
existía. El test revienta si se vuelven a desincronizar.

Actualizada también la guía "Entrar al sistema por primera vez".

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

El único evento que quedó sin comité —el taller "Entre Mujeres"— lo asignó la
usuaria a mano el 2026-09-17: va al Comité Mujeres. Verificado: **0 de 208
eventos de los últimos 90 días quedan sin comité organizador**, así que la regla
no le cierra la puerta a nadie.

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

### [x] DON-1 · Importar donaciones con match asistido — HECHO 2026-09-18

Asistente de tres pasos en `/finanzas/donaciones/importar`: subir → revisar →
confirmar. Lee CSV y XLSX (la librería de Excel se carga solo si hace falta,
pesa 400 KB).

**El matcher es todo el ítem.** Los reportes llegan con Fecha / Cliente / Notas
y sin ningún id, así que el cruce es por nombre. Se compara el nombre como
CONJUNTO DE PALABRAS y no como texto: el banco escribe "RUIZ MORENO ALEJANDRO"
y eso, como texto, no se parece a "Alejandro Ruiz Moreno". Se descartan tildes,
mayúsculas, partículas ("de los") e iniciales sueltas ("Salazar A.").

El riesgo de comparar conjuntos: "María Rodríguez Vargas" y "María Vargas
Rodríguez" son DOS personas con las mismas palabras. Por eso **nunca gana el
mejor parecido**: si el conjunto lo comparten dos fichas es AMBIGUO, y un
nombre incompleto ("Alejandro Ruiz") tampoco se importa solo aunque haya un
único parecido.

Medido contra el padrón real (23.963 fichas) con los nombres al estilo banco:
**97% emparejados, 3% ambiguos, CERO con la persona equivocada**. Por cédula,
43 de 43.

**Lo que evita que alguien tenga que preparar el archivo:** los encabezados se
reconocen por palabra contenida ("Fecha de transacción", "Detalle del Cliente",
"Crédito"), el encabezado se busca en las primeras 20 filas —los exports traen
título y filas en blanco arriba; el del campa lo tenía en la quinta— y los
montos se entienden en formato tico y gringo.

**Las fechas mes/día/año se rechazan a propósito:** con los dos formatos vivos
no hay forma de distinguir 03/04 y elegir mal cambiaría la fecha sin avisar.

**Las fechas futuras se marcan en la VISTA PREVIA**, no al importar: el endpoint
rechaza el lote entero por una fila mala, así que descubrirlo al final sería
llegar hasta el botón para que no pase nada.

Idempotencia por huella persona+fecha+monto, contra la base. Solo INSERT. El
endpoint de importación recibe `member_id` ya resuelto y nunca nombres, así que
no puede adivinar a quién acreditar; y cada fila pasa por la MISMA validación
que el alta manual, para que un archivo no meta por la puerta de atrás algo que
el formulario rechaza.

Al final: resumen y descarga de las que quedaron sin importar, con el motivo.

Probado de punta a punta con un archivo que imita un reporte de banco —título
arriba, encabezados propios, fechas DD/MM/YYYY, una fila duplicada, una persona
inexistente, una fecha futura y una en formato gringo—: las seis se
clasificaron como corresponde.


### [x] DON-2 · Botón para registrar una donación a mano — HECHO 2026-09-18

Botón "Agregar donación" en la pantalla de donaciones. Buscador de persona por
nombre o cédula reutilizando `MemberCombobox` —el mismo de siempre, que además
no exige el módulo miembros, que el rol finanzas no tiene—, fecha con tope en
hoy, moneda, monto y nota.

**La tabla no contemplaba nada de esto** (migración `20260918180000`):
`amount` era NOT NULL, no había columna de nota y no quedaba rastro de quién
registraba.

**El monto vacío se guarda NULL, nunca 0.** Cero es un monto real: sumaría en
los reportes y la donación se leería como "₡0" en vez de "sin monto". Pasa que
se sabe que alguien dio pero el reporte del banco todavía no llegó.
`donation_stats` usa `sum(amount)`, que ignora los nulos, así que esa donación
cuenta como donación sin mover los totales — que es justo lo que se quiere.
Verificado al aplicar: las 15.147 donaciones existentes conservaron su monto.

La regla vive en `lib/finance/donacion-a-mano.ts` (pura, 14 tests). Rechaza
fechas futuras —siempre son un error de tecleo— pero no acota el pasado, porque
se cargan reportes viejos. La moneda inventada se rechaza en vez de convertir
(INT-3), y "hoy" se juzga en hora de Costa Rica: con la de UTC, una donación
cargada un martes a las 7 p.m. se rechazaría por futura.

El endpoint exige el mismo rol que el import ('finanzas', 'direccion'): quien
puede cargar un archivo entero puede cargar una fila. Comprueba además que la
ficha exista y esté activa — una donación colgada de una ficha de baja queda
fuera de todo reporte.


## Fase 18 — Pedido el 2026-09-16

### [x] CHK-3 · El modal de familia tapaba la opción "Servidor" (reportado 2026-09-18)

**Lo que se vio.** "El modal se ve azul y no me sale participante/servidor."
No era la cuenta de quien opera: es la PERSONA a la que se le hace check-in. Si
tiene familiares registrados —el 17% del padrón activo— se abre el modal de
familia en vez de la tarjeta de confirmación, y ese modal registraba a todos
como participante sin preguntar.

**Por qué importa.** Medido: de los **497 servidores activos** de comités
organizadores, **231 tienen familia** (46%). A casi la mitad de los servidores
no se les podía marcar como servidor desde el check-in, y eso ensucia el conteo
de servidores de cada charla.

Ahora la calidad va POR PERSONA dentro del modal: puede llegar una mamá
servidora con dos hijos participantes. El selector solo aparece para quien de
verdad califica, preguntándole al mismo endpoint que usa la tarjeta normal — la
regla no se duplica.

**Y el segundo hueco:** mientras la consulta de elegibilidad viajaba, el botón
"Servidor" no salía Y TAMPOCO ningún aviso; si la consulta fallaba, se quedaba
así para siempre sin decir nada. "Cargando" pasó a ser un estado propio
(`lib/events/puerta-de-servidor.ts`, con tests) y ahora dice "Verificando si
puede marcarse como servidor…".

### [x] AUD-2 · El historial de cambios se puede ver — HECHO 2026-09-18

Panel de historial en la ficha de una persona, en el detalle de un pago y por
matrícula (en el historial de estudios de la ficha, que es donde se contesta
"¿quién movió a esta persona de grupo?"). Carga perezosa: solo se consulta si
alguien lo abre.

**PRIMERO HUBO QUE ARREGLAR EL DATO, y era un error mío de anteayer.** Di por
hecho que desde la migración `20260916190000` el actor quedaba registrado.
Medido antes de construir nada: de **1.135 UPDATE sobre `members` posteriores a
esa migración, CERO tenían actor**. Los únicos 37 que sí venían de funciones que
reciben el actor como parámetro y nunca pasaron por ahí.

El trigger estaba bien —comprobado con una transacción que le pone el header a
mano: extrae el actor correctamente—. Lo que fallaba era el lado de la app:
`recordarActor()` corría DESPUÉS de `await supabase.auth.getUser()`, y
`enterWith` en ese punto ya no lo ve la continuación del handler, que tomó su
foto del contexto antes. Falla en silencio: nada se rompe, solo no se guarda el
autor. Ahora se entra con una CAJA vacía antes del primer `await` y se rellena
al resolver la sesión. Hay tests con la forma exacta del bug y con dos
peticiones concurrentes, porque firmar un cambio con el nombre equivocado sería
peor que no firmarlo.

**Rendimiento: NO hizo falta el índice** que el plan dejaba a decidir. Medido
sobre las 359 mil filas: filtrando por `entity_type` + `entity_id` son **87
buffers**; solo por el id, **2.357**. La consulta usa las dos columnas.

**Tres cosas que solo se vieron con datos reales** y que el plan no anticipaba:

- Los uuids no contestan nada. "Grupo #1a9acbce → #b89a3066" era literalmente
  la pregunta sin responder. Ahora se resuelven los nombres:
  **"SCJ — Oeste SJ → SCJ — Este SJ"**, que es el caso de Pamela.
- Hasta el 15-set el trigger NO guardaba `old_data` y volcaba la fila entera
  (44 claves de promedio). Pintar eso como "Correo vacío → ana@x.com" afirma
  algo falso. Esas entradas dicen que hubo un cambio y que no quedó guardado
  cuál.
- Estados crudos (`pendiente_de_pago`), rutas de comprobante de tres líneas y
  `created_at` repitiendo la fecha de la entrada. Traducidos, resumidos y
  quitados.

El ruido se filtra: `sede_last_checkin` sola son 19.239 filas de `members` en un
mes, todas del cron nocturno, y tapaba lo que hizo una persona.

**Permisos:** lista blanca de entidades (`lib/audit/entidades.ts`) y el módulo
correspondiente con alcance más allá de `own`. `entity_type` viaja en la URL y
entra en la consulta; sin lista, cualquiera pediría el historial de tablas que
ningún módulo cubre. Y cualquier miembro tiene `miembros:view` sobre su ficha:
eso no puede abrirle la bitácora.

**VERIFICADO EN PRODUCCIÓN el 2026-09-18**: desde el despliegue, 17 de 43
cambios llevan autor (los otros 26 son de crons, que legítimamente no tienen).
Antes del arreglo eran 0 de 1.135.

**Y salió algo que importa más que el bug.** El primer test que escribí exigía
que el patrón viejo fallara, pasó en local y **reventó en CI**. La causa: eso no
era nuestro código sino comportamiento del runtime, y cambia con la versión.
Medido con el mismo script — **node 22 (CI): el `enterWith` tardío SÍ se
propaga; node 24 (local): no**. O sea que el código original andaba en unos
runtimes y no en otros: se habría caído solo el día de un upgrade sin que nadie
lo relacionara. Los tests ahora fijan NUESTRO contrato (con la caja, el actor
llega en las dos versiones) y nunca el del runtime.

**Lección para el gate local:** CI corre Node 22 y la máquina de desarrollo 24.
Un `npx -y node@22 ./node_modules/.bin/vitest run` antes de pushear habría
evitado dos runs rojos seguidos.

**Queda pendiente de decidir (retención).** `prune_audit_log()` borra todo lo de
más de 90 días. Con el autor guardándose de verdad recién desde hoy, el
historial útil llegará hasta mediados de diciembre de 2026 y después se empieza
a vencer. Si el historial va a ser una función del producto, hay que subir esa
ventana antes. Lo otro: las cargas masivas deberían correr con el trigger
apagado — 294.628 de las 359 mil filas son del reimport del 18-jul.


### [x] SEC-3 · Warnings del linter de Supabase — HECHO 2026-09-17

Migración `20260917210000`. Eran tres cosas, no cinco: el linter repetía.

**Y el hueco era real, no una advertencia genérica.** Antes de tocar nada lo
comprobé contra producción con la llave pública que va en el bundle del
navegador y nada más:

    POST /rest/v1/rpc/report_charla_attendance  → 200 · la asistencia de TODA
        la organización, año por año y charla por charla
    POST /rest/v1/rpc/member_por_external_id    → 200 · el uuid de la ficha de
        un id de CCB, o sea que se podían enumerar personas

Después de la migración las dos responden **401 permission denied**.

La causa: una función en `public` nace con EXECUTE para PUBLIC y PostgREST
publica el esquema entero en `/rest/v1/rpc/`. Las otras **30** funciones
SECURITY DEFINER ya estaban cerradas; estas dos se quedaron atrás.

Se revocó en vez de quitarles SECURITY DEFINER, que lo necesitan:
`member_por_external_id` tiene que ver fichas inactivas para resolver las
fusionadas. Verificado que la app sigue: el reporte de charlas 2026 devuelve 37
semanas y 31.668 asistencias con la llave de servicio.

`merge_no_copia()` era la única del esquema sin `search_path` fijo. Arreglada.

La migración se aplicó dentro de una transacción que COMPRUEBA los permisos
antes de confirmar y hace rollback si no quedaron como se esperaba.

Para que no vuelva a pasar: la regla quedó en AGENTS.md ("Funciones nuevas en
`public`") y hay un auditor, `node scripts/sec3/auditar.cjs`, que sale con
código 1 si algo queda abierto. Hoy: 52 funciones, 0 abiertas, 0 sin
search_path.

### [x] SRV-4 · Pantalla "Mi comité" para líderes/encargados — HECHO 2026-09-18

Pantalla nueva donde el líder o encargado de un comité ve SOLO a la gente de
su comité, con su puesto y el estado de sus compromisos: asistencia
comprometida, dando o llevando un estudio en el último año, donante activo, y
la fecha del último check-in a un evento.

Prompt para Claude Code:

```
FEATURE · Pantalla "Mi comité": la gente de mi comité y sus compromisos

QUIÉN LA VE: ÚNICAMENTE el rol lider_comite, y cada líder ve SOLO el/los comité(s) de los
que es líder — nadie más tiene acceso a esta pantalla (ni coordinador_servidores, ni
direccion; admin la ve porque admin ve todo, pero no se agrega selector de comités ni
acceso ampliado para nadie). Alcance con el mismo patrón por comité de EVE-12/events-scope:
si EVE-12 ya creó el helper de "mis comités", REUTILIZAR.

QUÉ MUESTRA — tabla, una fila por servidor ACTIVO del comité:
1. Nombre + puesto(s) en el comité.
2. Asistencia comprometida: cumple/no cumple según LA REGLA EXISTENTE de asistencia activa
   (≥6 charlas en 6 meses completos + 1 en los últimos 60 días) — REUTILIZAR la función
   que ya calcula esto para elegibilidad de estudios, NO reimplementarla.
3. Estudio en el último año: badge "llevando" (matrícula activa o cerrada en los últimos
   12 meses) y/o "dando" (dirigente de un grupo activo o cerrado en los últimos 12 meses).
4. Donante activo: según la definición ya usada en el módulo de donaciones (donación en
   los últimos 2 trimestres — reutilizar esa query/regla de FIN-1).
5. Último check-in a un evento: fecha (y nombre del evento en tooltip); "—" si nunca.
Indicadores visuales simples (✓/✗ o verde/gris), con el detalle en tooltip. Filtro rápido
"solo los que no cumplen algo". Export XLSX/CSV de la tabla.

IMPLEMENTACIÓN:
- Server-side todo el cálculo (endpoint /api con requireRoles + recorte al comité del
  solicitante — el server valida que el comité pedido sea suyo, no confiar en la UI).
- Cuidado con el costo: calcular compromisos para ~30-80 personas por comité está bien en
  una consulta agregada; nada de N+1 por fila.
- PRIVACIDAD: esta pantalla NO da acceso al perfil completo del miembro ni muestra datos
  financieros (montos de donaciones) — solo el binario "donante activo sí/no". Nada de
  teléfonos/correos acá salvo que ya los vea por otro camino.
- Entrada en el menú solo para quienes tienen alcance (patrón de módulos existente).
Tests: líder ve solo su comité (403 en otro), reglas de compromisos con fixtures (usa las
funciones reutilizadas), export. tsc/lint/vitest al cierre.
```

**Cierre 2026-09-18.** `/servidores/mi-comite`. El alcance sale de la estrella
de SRV-5 (`getManageableCommitteeIds`), nunca de la UI: pedir el id de otro
comité da 403 aunque exista. Solo `lider_comite` y admin — ni
coordinador_servidores ni dirección, que ya tienen el padrón completo.

Las cuatro reglas se REUTILIZAN, ninguna se reimplementó:
asistencia = `getActiveAttendanceMemberIds()` (la misma de elegibilidad de
estudios), donante = `members.is_donor` (el flag por trimestres de FIN-1),
estudios y último check-in salen de consultas agregadas.

Sin N+1: son 6 consultas fijas por comité, no importa el tamaño. El último
check-in necesitaba un `DISTINCT ON` y por eso hay una RPC nueva
(`ultimo_checkin_de_miembros`, migración `20260918230000`) cerrada a anon según
la regla de AGENTS.md; el auditor de SEC-3 sigue en 0 abiertas.

"Estudio" cumple con LLEVAR o con DAR: exigir las dos cosas marcaría en rojo a
media planilla de dirigentes. El último check-in NO cuenta como incumplimiento
— es un dato para mirar, y la asistencia ya se mide con su propia regla.

Medido contra producción: Comité Youth 39 personas (24 con algo pendiente) en
~1s; Matrimonios 22 y Ayuda Social 38. Contraste medido, no estimado: el ✗ va
en `coral-deep` porque `coral` sobre la fila cebra daba 4.39 (ahora 5.16).

### [x] FAM-3 · Autorización de imagen + lista de menores asistentes — HECHO 2026-09-18

**El campo tiene TRES estados y ahí está toda la regla:** NULL = no se le
preguntó a nadie, true = dijo que sí, false = dijo que NO. Un `default false`
habría sido más cómodo y habría estado mal: se pierde para siempre a quién
falta consultar, y se afirma una negativa que nadie dio. `puedePublicarse` trata
pendiente como NO — quien consulta eso está por publicar una foto, y la ausencia
de respuesta no es un permiso.

En la pantalla son TRES BOTONES y no una casilla: una casilla solo sabe decir sí
o no, y destildarla significaría "dijo que no" sin forma de volver a pendiente.

En la ficha de un MENOR el estado va en el encabezado, junto al nombre, y no
enterrado en los datos personales: quien está por publicar una foto lo tiene que
ver sin buscarlo. Pendiente se pinta en coral porque es una tarea.

`esMenor` se reutiliza de FAM-2; no hay una segunda definición de quién es menor.

**El reporte** (`scripts/reporte-menores-asistentes.ts`) da **545 menores** con
check-in en los últimos 2 años. Una fila por persona y no por lugar: con una por
lugar, quien revisa tiene que juntar mentalmente las filas de un mismo chico
para saber si ya le preguntó, y la lista existe para ir marcando. El lugar
habitual va con su conteo y los demás en una columna aparte.

**451 de los 545 no tienen familia registrada** — o sea que hoy no hay a quién
pedirle la autorización. Van en una hoja propia: es el pendiente de FAM-2/DAT-8
y ahora tiene una consecuencia concreta.

**Hallazgo del camino:** `donations` y `refunds` eran las únicas tablas de plata
SIN bitácora. Se vio borrando una donación de prueba, que no dejó ningún rastro.
Migración `20260918210000` les pone el trigger — importa más desde DON-2, porque
ahora se crean donaciones a mano y la pregunta "¿quién registró esto?" dejó de
responderse sola con el nombre del archivo.


### [x] SRV-5 · Marcar encargados de comité desde la lista + rol automático — HECHO 2026-09-18

En el detalle de cada comité, un check en la lista de personas para marcarlas
como encargado del comité (puede ser más de una), y que al marcarlo se le
asigne automáticamente el rol lider_comite (el que abre la pantalla SRV-4).

Prompt para Claude Code:

```
FEATURE · Comités: marcar encargados desde la lista de miembros del comité

CONTEXTO: hoy el comité tiene un campo de encargado. La regla nueva: los encargados se
marcan directamente en la lista de personas del comité, y pueden ser VARIOS.

ETAPA 1 — DIAGNÓSTICO: ¿cómo se guarda hoy el encargado del comité (campo único en
committees? ¿puesto de "Encargado"?)? Ya hay ALGUNOS comités con encargado definido, no
todos. Si es campo único, proponer la migración a un flag en la membresía (ej.
is_encargado en la tabla de asignaciones persona-comité) y cómo migrar los encargados
existentes sin perder ninguno. Reportar antes de aplicar.

ETAPA 2 — UI, con UNA SOLA FUENTE DE VERDAD en dos vistas sincronizadas:
- El dato es UNO (el flag de la etapa 1). El campo "Encargado" del comité y la lista de
  personas son dos vistas del mismo dato: marcar en cualquiera de los dos lados se refleja
  en el otro al instante — nunca pueden decir cosas distintas.
- En la lista de personas del comité, el encargado se distingue con una ESTRELLA (★) junto
  al nombre; marcar/desmarcar encargado se hace tocando la estrella de la fila (relleno =
  encargado, contorno = no). Tooltip "Encargado del comité".
- El campo de encargado del comité pasa a mostrar los nombres (varios si hay varios),
  derivados del flag — deja de ser editable por separado si hoy lo era.
- Solo pueden tocar la estrella quienes administran comités (verificar requireRoles del
  módulo servidores); el lider_comite NO puede nombrarse a sí mismo ni a otros. Para el
  resto la estrella es solo indicador visual.

ETAPA 3 — ROL AUTOMÁTICO:
- Al marcar: asignar el rol lider_comite si no lo tiene. Al desmarcar: quitárselo SOLO si
  no quedó como encargado de ningún otro comité Y el rol no fue asignado manualmente —
  usar la distinción manual/automático de EVE-12 (columna source): este rol entra como
  'puesto'/automático. Si EVE-12 aún no corrió, coordinar: este ítem la necesita.
- Integrar con position-role-sync si es quien gestiona roles automáticos hoy — REUTILIZAR
  ese mecanismo, no crear un segundo camino que después pelee con la sync.
- El alcance de SRV-4 ("mi comité") debe leer de esta marca: líder de comité = encargado
  marcado aquí.
- Todo cambio queda en audit_log (quién nombró/quitó a quién).
Tests: marcar asigna rol, desmarcar lo quita solo si no es encargado en otro lado ni
manual, lider_comite no puede tocar el check (403 server-side). tsc/lint/vitest al cierre.
```

**Cierre 2026-09-18.** El diagnóstico cambió el ítem: el mecanismo ya existía.
Había DOS fuentes — el puesto "Encargado…" (35 de 46 comités, ya otorgaba
`lider_comite`, ya admitía varios) y `areas.leader_id` (13 comités, campo
único). En 2 comités apuntaban a personas DISTINTAS (Ayuda Social,
Contabilidad; verificado que no eran fichas duplicadas). Agregar un
`is_encargado` nuevo, como decía el prompt, habría sido una tercera fuente.

Por decisión del usuario la fuente única es EL PUESTO, y nadie perdió nada: los
4 encargados que solo vivían en `leader_id` recibieron su puesto (Carolina Salas
Amador, Melissa Acon Chaves, Sofia Valverde Mora y Camila Artavia Trejos; a las
dos sedes hubo que crearles el puesto "Encargado Sede"). `lider_comite`
automático pasó de 24 a 26. Verificado: 0 discrepancias y 0 personas que
pierdan el permiso de pedir vacantes.

`areas.leader_id` quedó fuera de uso — la columna sigue ahí pero no se lee ni se
escribe. `getManageableCommitteeIds` y el aviso de solicitud de vacantes ahora
salen del puesto, y el aviso le llega a TODOS los encargados, no a uno.

Queda como dato operativo: **16 comités activos sin encargado marcado**, casi
todos sedes cuyo único puesto "Encargado" es "Encargado Logística", que es
operación y no la cabeza. La estrella existe justamente para que alguien los
marque.

### [x] AYU-2 · Centro de ayuda: donaciones, puestos/comités/áreas y roles — HECHO 2026-09-21

Tres tutoriales nuevos: importar donaciones (individual y por Excel), crear
puestos de servicio/comités/áreas, y asignar o desvincular un rol.

Prompt para Claude Code:

```
DOCS · Centro de ayuda: tres tutoriales nuevos en content/ayuda/

Seguir el formato existente de content/ayuda/*.md (frontmatter con titulo, seccion, tipo,
visibilidad por roles, orden). ANTES de escribir cada uno, leé el código real de la
pantalla que documenta — los pasos deben reflejar la UI actual, no una supuesta. Lenguaje
de Theos, tono simple, sin jerga.

1. "Registrar donaciones" — visibilidad: finanzas, direccion.
   Dos secciones: (a) UNA POR UNA con el botón "Agregar donación" (buscador por nombre o
   cédula, fecha, monto optativo —explicar que se puede dejar vacío si el reporte del
   banco no ha llegado—, nota); (b) POR EXCEL con la pantalla de importación (subir el
   archivo tal como llega, revisar los matches, resolver los dudosos con el buscador,
   confirmar; qué pasa con duplicados y con los que quedan sin match).
   OJO: la parte (b) solo si DON-1 ya está implementado; si no, dejar el artículo con la
   parte (a) y un TODO comentado para la (b).

2. "Crear áreas, comités y puestos de servicio" — visibilidad: los roles que administran
   el módulo servidores (verificar en el código cuáles son).
   El orden jerárquico real (área → comité → puesto), dónde se crea cada cosa, y cómo
   asignar personas a un puesto (incluyendo varios puestos a la misma persona, y
   reactivar a un servidor inactivo si eso ya está implementado). Si SRV-5 (estrella de
   encargado) ya corrió, incluir cómo nombrar encargados.

3. "Asignar y quitar roles a una persona" — visibilidad: admin, direccion (quien pueda
   gestionar roles según el código).
   Dónde se asignan, qué implica cada familia de roles (referenciar la infografía "Quién
   ve qué" si existe), cómo quitar un rol, y la diferencia entre un rol asignado a mano y
   uno automático por puesto (que la sync puede volver a poner — explicar qué hacer en
   cada caso).

Verificar que cada artículo renderice bien en /ayuda y que la visibilidad por roles
funcione (un rol sin acceso no lo ve en el índice). Sin capturas por ahora — texto claro
paso a paso; las capturas se agregan después como en los demás tutoriales.
```

## Fase 19 — Pedido el 2026-09-21

**Cierre 2026-09-21.** Tres artículos, escritos LEYENDO las pantallas, no de
memoria: los nombres de los campos, los mensajes de error y las reglas salen del
código, así que dicen lo que la pantalla dice hoy.

`registrar-donaciones.md` (finanzas, dirección) · las dos formas, y lo que más
se pregunta: **el monto vacío no es cero**. En la importación, el paso 2 es el
que importa y el artículo lo dice — "hay varias posibles" es donde hay que
decidir, porque el sistema no adivina.

`areas-comites-y-puestos.md` (staff, coordinación de servidores, dirección) · el
orden área → comité → puesto, y que **la gente se asigna al PUESTO**, nunca al
comité. Incluye la estrella de encargado (SRV-5) y la advertencia que no es
obvia: **el nombre del puesto otorga permisos** — "Encargado…" da líder de
comité, los de sede dan check-in—, así que conviene copiar el nombre de otro
comité antes de inventar uno.

`asignar-y-quitar-roles.md` (admin, gestor de accesos, coordinación de estudios)
· lo que más confunde, con su sección propia: **un rol que vino de un puesto
vuelve si lo quitás a mano**, porque el puesto sigue diciendo que esa persona
tiene esa función. Y la tabla de quién puede repartir qué, con el porqué de que
al gestor de accesos se le niegue `admin`.

Los tres pasan el guard de contenido de `visibility.test.ts`.

### [x] CHK-4 · Check-in de subeventos: el comité del subevento no ve el evento — HECHO 2026-09-21

Caso real: bienvenida de Youth no puede hacer check-in porque el evento
principal es de otra sede y el de Youth es un SUBEVENTO de ese principal. La
regla: quien organiza el subevento puede operar el check-in del subevento Y del
evento principal (la gente hace check-in desde cualquiera de las dos
estaciones), y viceversa.

Prompt para Claude Code:

```
FIX PERMISOS · Check-in: el alcance por comité debe cubrir la familia completa
evento principal + subeventos

PROBLEMA: un evento principal tiene subeventos (sub_events). El comité organizador del
SUBEVENTO (ej. Youth) no ve el evento en su lista de check-in, porque el comité
organizador registrado está solo en el evento PRINCIPAL (de otra sede) — o al revés. En
la puerta hay dos estaciones y la gente hace check-in en cualquiera: ambos comités deben
poder operar ambos.

REGLA: para efectos de VER y OPERAR EL CHECK-IN, el alcance por comité se evalúa sobre la
FAMILIA del evento: los comités organizadores del principal + los de cada subevento. Si
mi comité organiza el subevento, puedo hacer check-in en el principal y en el subevento;
si organiza el principal, igual. (La EDICIÓN del evento sigue la regla de EVE-12 sin este
ensanche — esto es solo check-in y lo operativo de puerta.)

IMPLEMENTACIÓN:
1. Diagnóstico: ¿los subeventos tienen sus propios event_organizing_committees o heredan
   del padre? Si un subevento no puede declarar comité propio, agregarlo (es la causa raíz:
   el de Youth debería poder decir "me organiza el comité Youth de X sede").
2. Donde se filtra "qué eventos puedo operar" (lista de check-in y el endpoint de
   registrar check-in): calcular los comités de la familia (padre + subeventos) y comparar
   contra los comités del operador. Server-side, no solo el filtro de la lista.
3. Si EVE-12 (events-scope) ya corrió, extender ese helper con la noción de familia; si no
   ha corrido, implementar esto donde hoy se decide qué eventos ve el encargado y dejar
   nota para que EVE-12 lo absorba.
4. Verificar el caso concreto: operador del comité de Youth ve el evento principal y su
   subevento, y puede registrar check-in en ambos.
Tests: comité del subevento opera padre y subevento; comité del padre opera subevento;
comité ajeno a la familia → 403. tsc/lint/vitest al cierre.
```

**Cierre 2026-09-21.** El diagnóstico corrigió la causa raíz que suponía el
prompt. No es que el subevento "herede" mal: el permiso se evalúa sobre el
EVENTO y un subevento no es un evento, así que Youth no aparecía por ningún
lado. En producción hay 4 subeventos, todos "Youth", dentro de charlas de sede.

**Por qué no bastaba sumar Comité Youth a los comités de la charla**, que era lo
obvio y no requería migración: esa misma lista decide quién cuenta como SERVIDOR
del evento para el precio y la exención (`eventPricingFor`). Meter a Youth ahí
convertiría a todo el comité en servidor de la charla de Pedregal para efectos
de cobro. Por eso el comité del subevento vive en `sub_events.committee_id` y se
une aparte, SOLO para el alcance de puerta.

`requireEventAccess(id, { puerta: true })` en las 6 rutas de puerta —checkins,
families, server-check, members, members/[memberId], onsite-charge—. El default
es el ANGOSTO a propósito: olvidarse de `puerta` deja a alguien sin poder marcar
y se reporta en el momento; un default ancho abriría la edición en silencio. Hay
un test que lista qué rutas son de puerta y cuáles NO.

Editar el evento, exportar su reporte y las inscripciones siguen midiéndose con
la lista angosta: operar la estación de Youth no es administrar la charla.

El comité de la estación se elige en el asistente y en el editor (editable en la
fila, para arreglar un subevento que ya existe sin borrarlo) y VIAJA AL DUPLICAR
— las charlas se crean cada semana copiando la anterior, y sin eso habría que
volver a elegirlo cada vez, o sea olvidarlo.

Medido contra producción: destraba entre 6 y 8 personas por charla (Irina
Morales, Marco Acuña, Johana Forero, Carolina Fernández, Sharon Sánchez, Mariana
Avellaneda, María Madrigal y Naomi Castro). Los otros 29 del Comité Youth siguen
sin poder porque no tienen el rol de eventos, que es lo correcto.

### [x] REP-5 · Reporte: asistentes de una semana + quiénes dejaron de venir — HECHO 2026-09-21

Al seleccionar una semana en reportes, dos listas: (a) los asistentes de esa
semana (a cualquier evento tipo charla) y (b) los que asistieron esa semana y
después dejaron de asistir 5 semanas consecutivas. Con export a Excel: nombre,
sede a la que asistió, teléfono y email — es la lista para llamarlos y
recuperarlos.

Prompt para Claude Code:

```
FEATURE · Reporte de asistencia: asistentes de la semana + abandonos (5 semanas sin volver)

DÓNDE: dentro de /reportes/asistencia, integrado al detalle de semana que ya existe
(REP-2: ?semana=YYYY-Www) — al abrir una semana, además de lo actual, dos listas nuevas.
REUTILIZAR la selección de semana, el patrón de panel y las etiquetas de fecha de REP-4
si ya corrió.

DEFINICIONES (fijarlas en una función pura testeable, ej. lib/reports/abandonos.ts):
- "Asistente de la semana N": persona con ≥1 check-in en la semana ISO N a cualquier
  evento TIPO CHARLA (mismo criterio de tipo que ya usa el reporte de charlas).
- "Dejó de asistir": asistió en la semana N y NO tiene ningún check-in a charlas en las
  semanas N+1 a N+5 completas. Solo evaluable si la semana N+5 ya terminó — si no, mostrar
  "aún no se puede calcular (faltan X semanas)" en vez de una lista a medias que después
  cambie.
- Si volvió en N+6 o después igual cuenta como abandono EN ESA VENTANA (la lista es de
  quiénes cortaron 5 semanas seguidas tras N); el matiz "volvió después" se muestra como
  columna extra "volvió el [fecha]" si es barato de calcular — sirve para no llamar a
  quien ya regresó.

UI: dos tabs o dos secciones en el panel de la semana:
1. "Asistieron esta semana" (conteo + lista: nombre, sede/charla a la que asistió).
2. "Dejaron de venir" (conteo + lista con la columna "volvió el" si aplica).
Ambas con botón de descarga XLSX: nombre completo, sede a la que asistió (la de esa
semana; si asistió a varias, la más frecuente o ambas separadas por coma — elegí y
documentá), teléfono, email. Generación server-side con el patrón de exports existente.

PERMISOS: los mismos roles que hoy ven /reportes/asistencia — pero OJO: el export trae
teléfonos y correos; verificar que ese módulo ya implique ver datos de contacto (si el
rol de reportes es de solo métricas, restringir el botón de export a quienes tengan
miembros:view amplio y reportarlo).
RENDIMIENTO: todo en SQL agregado (las 168k+ filas de check-ins ya están; nada de traer
check-ins al cliente). Excluir datos [prueba].
Tests de la función pura: asiste y vuelve en N+3 (no abandono), corta exactamente 5 (sí),
semana N+5 incompleta (no evaluable), vuelve en N+7 (abandono con "volvió el").
tsc/lint/vitest al cierre.
```

**Cierre 2026-09-21.** Dos pestañas debajo del panel de semana que ya existía.

**Lo que más importa de la regla: la lista NO se muestra hasta que la ventana
cierre.** "Llevás 2 semanas sin venir" no es abandono — esa persona puede
aparecer el domingo. Antes de que terminen las 5 semanas se dice cuánto falta y
en qué fecha está la respuesta, en vez de una lista a medias que cambia sola.
Con esta lista se llama por teléfono; llamar a quien vino ayer la quema entera.

Volver después NO saca a nadie de la lista —la pregunta es quién cortó cinco
semanas seguidas, y eso ya pasó— pero el regreso va en su propia columna y esas
personas quedan al final: a quien ya volvió no hay que llamarlo.

**Permisos: son DOS, no uno.** Las listas son del módulo `reportes`, como el
resto de la pantalla. El teléfono y el correo exigen además `miembros` con
alcance total, porque —verificado— el rol `reportes` NO tiene el módulo de
miembros en absoluto: es de métricas. Darle el directorio de 889 personas por la
puerta de un reporte habría sido abrirlo sin decirlo. A quien no lo tiene, los
campos ni siquiera viajan al navegador, y la pantalla se lo dice.

Si alguien asistió a dos sedes esa semana salen LAS DOS separadas por coma:
"la más frecuente" escondería que estuvo en dos, y quien llama necesita saber a
cuál volvería.

Una RPC (`report_asistentes_de_la_semana`, migración `20260921200000`), cerrada
a anon —devuelve teléfonos— y verificada con el auditor de SEC-3. La regla de
negocio no bajó a SQL: acá vive el dato y en `lib/reports/abandonos.ts` la
decisión, que es la que tiene los 17 tests.

Medido contra producción: 2026-W24 (8–14 jun) → 945 asistentes, **167 dejaron de
venir** (101 no han vuelto, 66 volvieron después), en 426 ms. 2026-W10 → 163 de
822. La semana 37 todavía no es evaluable, faltan 4 semanas.

### [x] SRV-6 · "Mi comité" con selector para RH, dirección y admin — HECHO 2026-09-21

En /servidores/mi-comite (SRV-4, ya hecha), agregar para el encargado de RH,
direccion y admin un selector de comités agrupados por área, para ver
exactamente lo que ve cada líder de comité pero escogiendo el comité.

Prompt para Claude Code:

```
FEATURE · /servidores/mi-comite: selector de comité para roles amplios

BASE: la pantalla "Mi comité" (SRV-4) ya existe y hoy es exclusiva de lider_comite, que ve
solo su(s) comité(s). Eso NO cambia para los líderes.

NUEVO: los roles amplios — encargado_staff, coordinador_servidores, direccion y admin
(confirmado por Floriana 2026-09-21) — también pueden entrar a la pantalla, con un
selector de comité:
- Lista agrupada por ÁREA (área → comités), con buscador. Al elegir un comité, ven
  EXACTAMENTE la misma vista que ve el líder de ese comité (misma tabla, mismos
  compromisos, mismo export) — reutilizar el componente y el endpoint tal cual, solo
  cambia la autorización del parámetro de comité.
- Server-side: el endpoint acepta ?committee_id= solo si el solicitante es rol amplio;
  un lider_comite que mande el id de otro comité sigue recibiendo 403 (test existente
  de SRV-4 no debe aflojarse).
- El selector recuerda el último comité elegido (query param en la URL, como REP-2, para
  poder compartir el enlace).
- Entrada de menú visible para estos roles.
Tests: rol amplio ve cualquier comité; lider sigue limitado al suyo; la vista para el rol
amplio es idéntica a la del líder (mismo payload). tsc/lint/vitest al cierre.
```

### [x] REP-6 · Reporte de personas nuevas — HECHO 2026-09-21

Réplica del dashboard de Power BI "¿Cuántas personas nuevas estamos captando?"
dentro de /reportes, con una corrección de fondo (nueva = primera ASISTENCIA,
no ficha creada) y el agregado de retención (¿volvieron? ¿se matricularon?).

Prompt para Claude Code:

```
FEATURE · Reporte de personas nuevas en /reportes

DEFINICIÓN CENTRAL — discutida y decidida: "persona nueva" = miembro cuya PRIMERA
ACTIVIDAD cae en el período mostrado, donde primera actividad = la más antigua entre:
(a) primer check-in a evento tipo charla, (b) primera matrícula a un estudio, (c) primera
inscripción a un evento. Así cuenta también la gente nueva que entra matriculándose sin
haber asistido aún. Cada persona trae su CANAL DE ENTRADA (charla / estudio / evento)
según cuál actividad fue la primera — mostrarlo como columna en la tabla y como desglose
en un KPI o gráfico chico (¿por dónde entra la gente?).
NO usar la fecha de creación de la ficha como métrica principal: se infla con imports (la
migración de 23k de CCB); una ficha creada sin NINGUNA actividad no cuenta como persona
nueva todavía. La fecha de creación puede ir como serie secundaria comparativa ("fichas
creadas"), claramente etiquetada.
OJO con las actividades MIGRADAS de CCB: las matrículas/asistencias históricas importadas
sí cuentan (son actividad real de esa persona en su fecha real) — lo que no cuenta es la
mera creación de la ficha por el import.

LAYOUT (siguiendo el BI que se usa hoy, misma info):
1. KPI cards del período/filtro activo: Nuevos (por primera asistencia), Edad promedio,
   Edad mediana, y cuántos de esos nuevos ya son servidores.
2. Gráfico de barras mensual (últimos 24 meses) de personas nuevas; clic en un mes filtra
   la tabla (mismo patrón de interacción del reporte de asistencia).
3. Gráfico anual (desde 2020) para la vista larga.
4. Filtros: sede/charla (la de su PRIMERA asistencia), rango de edad, servidor sí/no.
5. Tabla de detalle del mes/filtro seleccionado: nombre, edad, fecha de primera
   actividad, canal de entrada (charla/estudio/evento), sede/charla o estudio de esa
   primera vez, celular, servidor sí/no. Export XLSX/CSV.

LO QUE EL BI NO TIENE — RETENCIÓN (columnas/KPIs extra):
- "Volvió": ≥1 check-in adicional dentro de las 8 semanas siguientes a la primera
  asistencia (sí/no + KPI "% que vuelve" del período).
- "Se matriculó": tiene alguna matrícula de estudio posterior a su primera asistencia
  (sí/no + KPI %).
- Estas dos van en la tabla y el export — son la diferencia entre medir captación y
  medir permanencia.

IMPLEMENTACIÓN:
- Primera asistencia por miembro: query agregada (MIN(fecha) por member sobre check-ins a
  charlas) — con 168k+ check-ins debe ir en SQL, valorar índice o vista/función si la
  consulta lo pide. Excluir datos [prueba].
- Edades: calculadas a la fecha del reporte; sin birth_date → fuera de promedio/mediana
  (no tratarlos como 0) y "—" en la tabla.
- PERMISOS: mismos roles que ven /reportes hoy; el export trae celulares — aplicar el
  mismo criterio de REP-5 (si el rol de reportes es solo métricas, gate del export).
- Entrada en el índice de /reportes.
Tests de la lógica pura (primera asistencia con múltiples check-ins el mismo día, "volvió"
en el borde de 8 semanas, sin birth_date). tsc/lint/vitest al cierre.
```

**Cierre 2026-09-21.** `/reportes/personas-nuevas`.

**La corrección de fondo, con número:** hay **9.181 fichas sin ninguna
actividad**, en su mayoría de la carga de 23k de CCB. Con el criterio viejo
—fecha de creación— todas aparecerían como "personas nuevas" el día del import.
Una ficha no es una persona que llegó. Al revés sí cuenta: las asistencias y
matrículas migradas son actividad real en su fecha real.

El empate se desempata a favor de la charla: quien se matriculó y asistió el
mismo día entró por la charla, que es donde lo vieron primero.

**Quien no tiene fecha de nacimiento queda FUERA del promedio y la mediana**, y
se reporta aparte ("36 sin fecha de nacimiento"). Contarlo como 0 años hundiría
el promedio y nadie sabría por qué. Un filtro de edad también lo deja fuera: no
se puede afirmar que tenga entre 18 y 25 si no se sabe.

**Retención, que el BI no tiene:** volvió dentro de 8 semanas y se matriculó
después. En agosto de 2026, de 204 nuevos volvió el **39 %** y se matriculó el
**3 %**; en marzo, 47 % y 12 %.

Tres funciones nuevas (migración `20260921210000`), todas cerradas a anon —el
detalle devuelve teléfonos— y verificadas con el auditor de SEC-3.
`primera_actividad_por_miembro()` existe aparte para que la serie y el detalle
no tengan cada una su copia del cálculo: dos definiciones de "primera
actividad" se desincronizan y el gráfico deja de cuadrar con la tabla.

Teléfono con el mismo criterio que REP-5: el módulo `reportes` abre el reporte,
el directorio exige `miembros` con alcance total.

Medido: serie 241 filas en ~1,1 s; detalle de un mes ~800 ms. Por año:
2020:1.094 · 2021:1.481 · 2022:1.779 · 2023:1.809 · 2024:1.793 · 2025:2.075 ·
2026:1.843 (parcial).

### [x] SRV-7 · "Mi comité": nombre del estudio en la columna de estudio — HECHO 2026-09-21

Prompt para Claude Code:

```
MEJORA · /servidores/mi-comite: la columna de estudio debe decir CUÁL estudio

HOY (SRV-4): la columna muestra badges "llevando"/"dando" sin decir cuál estudio.

CAMBIO:
- Si la persona está LLEVANDO un estudio ahora (matrícula activa): mostrar el nombre del
  estudio (ej. "Nivel 2"). Si además/aparte está DANDO uno, igual con su nombre
  ("Dirige: SCJ"). Varios a la vez → listarlos (son pocos casos).
- Si NO está llevando ninguno ahora: mostrar el ÚLTIMO estudio al que llegó y la fecha,
  en estilo apagado/secundario (ej. "Último: Nivel 3 · mar 2026"). Usar la matrícula más
  reciente cerrada/finalizada; la fecha = cierre del grupo (o fin de matrícula si no hay
  cierre). Si nunca ha llevado ninguno: "—".
- Mismo dato en el export XLSX/CSV (columna "Estudio actual" y "Último estudio").
- Sin N+1: extender la query agregada existente del endpoint de mi-comite. La vista de
  SRV-6 (selector para roles amplios) lo hereda solita porque comparte endpoint.
Tests: llevando, dando, llevando+dando, sin estudio con histórico, sin estudio nunca.
tsc/lint/vitest al cierre.
```

**Cierre 2026-09-21.** La columna dice cuál: "Discípulos 2", "Dirige: Nivel 3",
"Exploring · Dirige: Nivel 4". Quien hoy no lleva ninguno muestra el último
apagado ("Último: Sirviendo como Jesús · dic 2025"), y quien nunca llevó, ✗.

**Dónde estaba la trampa:** al mostrar el nombre casi estrecho el COMPROMISO sin
querer. El ✓/✗ sigue siendo "llevó o dio algo en los últimos 12 meses"; el
NOMBRE es solo del estudio que está pasando ahora. Medido: en Comité Youth
cumplen 30 pero están estudiando ahora 19 — mezclarlos habría puesto en rojo a
11 personas de un comité solo.

Y para "ahora" manda el estado del GRUPO, no el de la matrícula: hay 675
matrículas `enrolled` contra 68 grupos `en_curso`, así que mirar la matrícula
diría que media iglesia está estudiando.

Export con DOS columnas, "Estudio actual" y "Último estudio": en una sola celda
hay que leer el prefijo para saber cuál te están diciendo.

Sin N+1 — se ampliaron las consultas agregadas que ya había. El test de embeds
ambiguos pescó que `study_enrollments → study_groups` tiene dos llaves y hubo
que nombrarla. SRV-6 lo hereda solo porque comparte endpoint.

### [x] REP-7 · Reporte global de servidores y sus compromisos — HECHO 2026-09-21

Vista a groso modo de los servidores: cuántos y quiénes además son donantes,
están en estudios y asisten — a nivel global, por área o por comité.

Prompt para Claude Code:

```
FEATURE · Reporte de servidores y compromisos en /reportes

QUÉ ES: la vista agregada de lo que "Mi comité" (SRV-4) muestra por comité, pero para
dirección: elegir GLOBAL / un ÁREA / un COMITÉ y ver el cumplimiento de compromisos de
los servidores activos de ese alcance.

REUTILIZAR, NO INVENTAR: las MISMAS reglas y (idealmente) la misma query agregada de
SRV-4 — asistencia comprometida (regla de asistencia activa), llevando/dando estudio en
los últimos 12 meses (con el nombre del estudio, SRV-7), donante activo (definición
FIN-1, solo sí/no, sin montos), último check-in. Si los números de este reporte y los de
"Mi comité" difieren para el mismo comité, es un bug.

UI:
1. Selector de alcance: Global / por Área / por Comité (árbol área → comité, como SRV-6).
2. KPI cards del alcance elegido: total de servidores activos, % donantes activos,
   % en estudios (llevando o dando), % con asistencia comprometida, % que cumple TODO.
3. Desglose comparativo: tabla o barras por área (en global) o por comité (dentro de un
   área) con esos mismos porcentajes — para ver de un vistazo qué área/comité está flojo
   en qué compromiso.
4. Lista de detalle (drill-down al hacer clic): las personas del alcance con sus ✓/✗ por
   compromiso — la misma fila de SRV-4. Filtro "solo los que no cumplen algo".
5. Export XLSX del detalle y del desglose.

PERMISOS: encargado_staff, coordinador_servidores, direccion, admin (los mismos roles
amplios de SRV-6). NO lider_comite — para eso tiene su pantalla.
Una persona en VARIOS comités: en el desglose por comité cuenta en cada uno, pero en los
KPI globales cuenta UNA vez (des-duplicar por member_id — dejarlo dicho en un tooltip
del KPI para que las sumas no "cuadren" a propósito).
RENDIMIENTO: SQL agregado; el alcance global son ~1.000 servidores — una consulta, no mil.
Excluir datos [prueba]. Entrada en el índice de /reportes visible solo a esos roles.
Tests: alcances (global/área/comité), des-duplicación del multi-comité, coincidencia con
el endpoint de mi-comite para un comité dado. tsc/lint/vitest al cierre.
```

### [x] REP-8 · Reporte de asistencia: seis ajustes sobre lo entregado — HECHO 2026-09-21

Ajustes sobre REP-2/REP-5 ya en producción.

Prompt para Claude Code:

```
MEJORAS · /reportes/asistencia: seis ajustes sobre el detalle de semana y las listas

1. TOGGLE DE SEMANA: clic en una semana la selecciona (como hoy); clic en la MISMA semana
   la deselecciona (quita ?semana= de la URL y cierra el panel).

2. LAS LISTAS VAN AL FINAL: las listas de "asistieron" y "dejaron de venir" (REP-5) se
   mueven al FINAL de la página, para que no oculten los demás gráficos al abrir una
   semana. Cada lista arranca COLAPSADA mostrando solo el conteo + botón "Mostrar lista"
   (expande/colapsa). El export XLSX queda disponible sin necesidad de expandir.

3. DEFINICIÓN DE "ASISTENTE" EN ESTAS LISTAS — CAMBIO: solo cuenta quien, además del
   check-in en la semana seleccionada, tiene AL MENOS 2 asistencias en total (histórico).
   Los nuevos (primera vez) y los de una sola visita NO se cuentan acá — es un número
   distinto al de check-ins de la semana. Mostrar ambos números sin ambigüedad:
   "N check-ins · M asistentes (2+ visitas)". La misma regla aplica a la lista de
   "dejaron de venir" (alguien que vino UNA sola vez y no volvió no es un abandono de
   asistente, es un visitante — para eso está REP-6).

4. "DEJARON DE VENIR" MIRA HACIA ATRÁS — CAMBIO de la lógica de REP-5: al seleccionar la
   semana N, la lista es de quienes asistieron en la semana N-5 y NO tienen ningún
   check-in a charlas en las semanas N-4 a N (es decir: EN la semana N cumplen 5 semanas
   sin asistir). Ventaja: siempre es calculable, incluso para la semana actual — eliminar
   el estado "aún no se puede calcular" de la versión anterior. Mantener la columna
   "volvió el" si la persona reaparece después de N. Ajustar la función pura
   (lib/reports/abandonos.ts) y sus tests a esta definición.

5. DOS INFO BOXES: junto a cada conteo, un ícono ⓘ con explicación en lenguaje simple:
   - Asistieron: "Personas con check-in esta semana que han venido al menos 2 veces.
     Los que vienen por primera vez no se cuentan aquí."
   - Dejaron de venir: "Personas que asistieron hace 5 semanas y no han vuelto desde
     entonces — esta semana cumplen 5 semanas sin asistir."
   Reutilizar el componente de tooltip/info existente si hay.

6. TERCER TAB — DEMOGRAFÍA POR SEDE: nuevo tab/sección con un gráfico o tabla por sede:
   número de personas (asistentes únicos del período/año seleccionado), edad promedio
   del grupo, y desglose por género (barras apiladas o columnas H/M/sin dato). Sin
   birth_date → fuera del promedio de edad (no como 0); sin género → "sin dato", no
   adivinarlo. Respeta el filtro de año y, si hay semana seleccionada, muestra la
   demografía de ESA semana.

tsc/lint/vitest al cierre; actualizar los tests de REP-5 a las definiciones nuevas.
```

### [x] REP-9 · Reporte de estudios: página nueva — HECHO 2026-09-21

Página nueva en /reportes con el detalle de los estudios por año: por tipo de
estudio, cantidad de estudiantes, dirigentes, personas nuevas por estudio,
género y edad.

Prompt para Claude Code:

```
FEATURE · Página nueva /reportes/estudios

QUÉ MUESTRA — con selector de AÑO (como el reporte de asistencia) y filtro por tipo/plan
de estudio:

1. RESUMEN DEL AÑO (KPI cards): grupos impartidos, estudiantes (matrículas únicas por
   persona), dirigentes distintos que dirigieron, personas NUEVAS que entraron por un
   estudio ese año (primera actividad = matrícula, misma definición de canal de entrada
   de REP-6 — REUTILIZAR esa lógica).

2. TABLA/GRÁFICO POR TIPO DE ESTUDIO (Nivel 1..4, Discípulos, SCJ, prematrimonial, etc. —
   usar el catálogo real de planes): por cada uno, en el año elegido:
   - grupos abiertos/cerrados, estudiantes matriculados, % que finalizó (cerró con
     resultado aprobado — mismo criterio del cierre de grupos), dirigentes que lo dieron,
     personas nuevas que entraron por ahí, edad promedio de los estudiantes y desglose
     por género (H/M/sin dato — sin adivinar).

3. EVOLUCIÓN POR AÑO: gráfico de barras/líneas de estudiantes por año (desde el histórico
   migrado) con desglose por tipo de estudio (apiladas o selector) — para ver el
   crecimiento de cada cadena (N1→N4, DIS1→DIS3).

DEFINICIONES:
- "Estudiante del año" = matrícula activa o cerrada cuyo grupo estuvo EN CURSO en ese año
  (no solo creadas ese año). Una persona en 2 estudios el mismo año cuenta 1 vez en el KPI
  global y 1 vez en cada tipo (tooltip aclarándolo, como REP-7).
- Edad: a la fecha de inicio del grupo; sin birth_date → fuera del promedio, no 0.
- Excluir matrículas canceladas y datos [prueba].

IMPLEMENTACIÓN: SQL agregado (hay años con miles de matrículas migradas); reutilizar
studies-scope/queries existentes donde aplique. Export XLSX de la tabla por tipo.
PERMISOS: coordinador_estudios, coordinador_dirigentes, direccion, admin (verificar
contra los roles reales del módulo de reportes/estudios). Entrada en el índice de
/reportes solo para ellos.
Tests de las definiciones (estudiante del año que cruza años, des-duplicación, % finalizó).
tsc/lint/vitest al cierre.
```

**Cierre 2026-09-21.** `/reportes/estudios`, con selector de año y de tipo.

**"Estudiante del año" es quien estuvo en un grupo EN CURSO ese año**, no en uno
creado ese año: un grupo que arranca en noviembre y cierra en febrero tiene
estudiantes en los dos, y contarlos solo en el primero escondería medio
cuatrimestre.

La edad se calcula **a la fecha de inicio del grupo** y no a hoy — quien llevó
Nivel 1 en 2019 lo llevó con la edad que tenía entonces. Sin fecha de
nacimiento queda fuera del promedio, nunca como 0.

"Finalizó" cuenta solo `completed`: `reprobado` llegó al final pero no aprobó.
**Y el año en curso se lee distinto**: los grupos que todavía no cierran están
en el denominador, así que 2026 marca 54% contra el 97% de 2025. Eso está dicho
en el tooltip, porque sin eso el número parece una caída y es el calendario.

"Llegaron por un estudio" reutiliza el canal de entrada de REP-6, no una
definición propia: son la misma pregunta desde otro reporte.

Medido: 2026 → 255 grupos, 1.145 estudiantes, 186 dirigentes, edad 38, 766M/344H.
2025 → 325 grupos, 1.800 estudiantes, 227 dirigentes. Un año en ~660 ms.

Roles: coordinación de estudios, de dirigentes, dirección y admin. Un rol de
reportes "a secas" no entra — el reporte nombra planes y cuenta dirigentes, que
es información del módulo de estudios.

**Filtro de bloque, 2026-09-21.** Cada bloque lleva su conteo de grupos y "Sin
bloque" es una opción más, no un vacío: **los NIVELES no van por bloque, son
mensuales** (confirmado por el usuario). Por eso en 2026 hay 168 de 255 grupos
"sin bloque", con Nivel 4 (347 estudiantes) y Nivel 3 (233) adentro — así es
como funciona, no falta asignar nada. Los bloques los llenan Sirviendo como
Jesús, Discípulos y Panorama.

Queda dicho en el selector con un info, porque "168 sin bloque" se lee como
datos faltantes si nadie explica la regla.

### [x] REP-10 · Personas nuevas: dos ajustes sobre lo entregado — HECHO 2026-09-21

Sobre el reporte de personas nuevas (REP-6, ya en producción).

Prompt para Claude Code:

```
MEJORAS · Reporte de personas nuevas: canal en el gráfico anual + filtro que aplique al
gráfico mensual

1. GRÁFICO ANUAL POR CANAL DE ENTRADA: el gráfico "por año" pasa a barras APILADAS con
   los tres canales de entrada que el reporte ya calcula: entró por ESTUDIO, por CHARLA,
   por EVENTO. Una barra por año, tres segmentos con leyenda y tooltip con el desglose
   (número y %). Mantener el total visible encima de cada barra.

2. EL FILTRO DE SEDE/CHARLA APLICA A TODO: al elegir una charla/sede específica en el
   filtro, el gráfico de personas nuevas POR MES debe actualizarse mostrando solo las
   personas cuya primera actividad fue en esa sede/charla — hoy no se actualiza (o no
   completamente). Revisar que TODOS los elementos de la página reaccionen al filtro:
   KPI cards, gráfico mensual, gráfico anual (con sus 3 segmentos) y la tabla de detalle.
   Un solo estado de filtro que alimente todo — si hoy cada gráfico pide sus datos por
   aparte, unificar en el endpoint para que no vuelva a divergir.

Tests: el endpoint filtrado por sede devuelve consistente el mismo universo para mes,
año y tabla (mismos totales); apilado anual suma el total. tsc/lint/vitest al cierre.
```

### [~] DAT-10 · A Tatiana Brenes le aparece la información de la mamá — CASO RESUELTO 2026-09-21, quedan dos decisiones

Datos del reporte: Tatiana Brenes Arroyo (cédula 4-0204-0583, pareja/familia
con Dennis Zabala), mamá María Eugenia Arroyo (cédula 4-0106-1311), correo
tati_brenes02@hotmail.com. Al entrar, Tatiana ve la información de la mamá.

Prompt para Claude Code:

```
BUG DATOS · Cuenta de Tatiana Brenes muestra la ficha de su mamá

CASO: Tatiana Brenes Arroyo (cédula 4-0204-0583) entra con tati_brenes02@hotmail.com y ve
la información de María Eugenia Arroyo (su mamá, cédula 4-0106-1311).

ETAPA 1 — DIAGNÓSTICO (solo lectura, reportar antes de tocar):
1. Buscar tati_brenes02@hotmail.com en members: ¿en cuántas fichas está? ¿en la de
   Tatiana, en la de la mamá, o en ambas? (Sospecha: correo prestado — el patrón de
   FAM-2 con papás e hijos.)
2. ¿A qué member_id apunta la cuenta de auth de ese correo? ¿Coincide con la ficha de
   Tatiana (por cédula 4-0204-0583) o con la de la mamá?
3. Revisar las dos fichas por cédula: ¿existen ambas? ¿alguna fusión previa las mezcló?
   (revisar audit_log/merges de esas fichas). ¿La familia (con Dennis Zabala) está bien
   armada o la vinculación familiar movió algo?
4. MEDIR EL ALCANCE: ¿cuántos casos más hay del mismo patrón? — correos que aparecen en
   más de una ficha ACTIVA de adultos, y cuentas de auth cuyo email hoy vive en una ficha
   distinta a la que apunta su member_id. Listarlos (van a ser más Tatianas).

ETAPA 2 — CORRECCIÓN (tras aprobación de la lista):
- Caso Tatiana: dejar el correo en la ficha CORRECTA (confirmar con ella cuál es su
  correo real y el de la mamá), re-apuntar la cuenta de auth al member_id de Tatiana, y
  quitar el correo de la ficha de la mamá si es prestado (la mamá queda sin correo o con
  el suyo real). Registrar en audit_log.
- Regla preventiva: al crear/editar, avisar si el correo ya está en otra ficha activa
  (¿ya existe esta validación? si no, proponerla — al menos advertencia, no bloqueo duro,
  por los correos compartidos legítimos de FAM-2 en menores).
NO enviar ningún correo (EMAIL_SILENT_MODE). No fusionar fichas: son dos personas
distintas, el problema es el correo/cuenta, no duplicados.
```

### [~] AYU-3 · Centro de ayuda: finanzas — ARTÍCULOS E INFOGRAFÍAS HECHOS 2026-09-21, faltan los videos

Las cuatro piezas escritas y con su infografía. **Los videos quedan para una
tanda aparte**, decidido con el usuario: necesitan las cuentas `@prueba.` y eso
depende de SEC-4.

| Pieza | Archivo | Visibilidad |
|---|---|---|
| Planes de pago | `planes-de-pago.md` | finanzas, dirección |
| Solicitudes de devolución | `solicitudes-de-devolucion.md` | finanzas, dirección |
| Registrar donaciones | ya existía; se le agregó la infografía | finanzas, dirección |
| Me asignaron una beca | `me-asignaron-una-beca.md` | **pública** |

El artículo 4 explica dónde aparece la casilla, qué pasa si la beca cubre el
total, la diferencia entre beca asignada y código, y qué hacer si uno se
matriculó ANTES de que le dieran la beca (ahí sí lo resuelve finanzas).

**Una corrección mía, anotada porque el error es instructivo.** Reporté que el
miembro no podía aplicar su beca en ningún lado: busqué `apply-scholarship`, vi
que su único llamador era la cola de revisión de finanzas, y concluí que el
miembro no tenía dónde. **Era falso.** El miembro la aplica en la pantalla de
confirmación de la matrícula y de la inscripción a eventos, con una casilla
«Usar mi beca (X de descuento)» que además **viene marcada por defecto**
(`matricula/page.tsx`, `useEventRegistration.tsx`, contra
`/api/scholarships/applicable`). Y si no tiene beca asignada, ahí mismo hay un
campo para un código de cupón.

Buscar por el nombre del endpoint no alcanzaba: la matrícula aplica la beca al
CREAR el cobro, mandando `scholarship_id` en el enroll, no llamando a
`apply-scholarship` después. La ruta de finanzas es el camino de rescate para
cuando el cobro ya existe.

O sea que los textos que yo había marcado como mentirosos —«se aplica
automáticamente al pagar» en Mis pagos, y «podés aplicar al momento de hacer tu
pago» en la plantilla `beca_aprobada`— **son correctos**. No hay nada que
arreglar ahí.


**Cierre 2026-09-21.** El selector va agrupado por ÁREA con buscador, y el
comité elegido viaja en `?comite=` para poder pasar el link. Sin comité elegido,
un rol amplio NO carga nada: traer los 46 "por si acaso" sería casi un minuto de
consultas para una pantalla que mira uno a la vez.

El recorte del encargado no se aflojó — el test de SRV-4 sigue verde y se le
sumaron los de SRV-6. Verificado contra producción: TI (admin) puede pedir
Comité de Worship y lo ve completo (25 personas); Karina, que es
`lider_comite` de Youth, recibe 403 por el mismo id.

**Info en los encabezados** (pedido del usuario en el momento): Asistencia,
Estudio y Donante explican su criterio al pasar el mouse o con el teclado. Los
textos NO se escriben a mano: el de asistencia se arma con las constantes de
`lib/attendance` y el de donante con `explicacionDeDonantes()`, que ya existía y
además pone el mes real desde el que cuentan las donaciones. Escribir "últimos 6
meses" en el tooltip habría sido la segunda definición de siempre.

De paso, la carga de la pantalla pasó a `useCargaRemota` (LINT-1): el
`setCargando(true)` dentro del efecto costaba el warning 61 de 60.

**Cierre 2026-09-21.** `/reportes/servidores`. Global, por área o por comité.

**La verificación que pedía el plan —"si los números difieren de Mi comité, es
un bug"— encontró uno de verdad, y no el que se esperaba.** Comité Youth daba 24
pendientes en la pantalla y 25 en el reporte. La causa: PostgREST corta en 1.000
filas por consulta y no avisa; la consulta partía la lista de IDS en tandas de
100 pero no paginaba los RESULTADOS, y las matrículas de 100 servidores son
exactamente 1.000. O sea que "Mi comité" venía mostrando sin estudio a gente que
sí lo tenía, desde SRV-4. Al paginar, "en estudio" pasó de 71% a 75% y "cumplen
todo" de 36% a 39%.

Quien sirve en varios comités cuenta en CADA uno del desglose —para su encargado
esa persona es suya— pero UNA vez en los totales: 1.141 filas contra 749
personas. La pantalla lo explica en vez de dejar que parezca un error de cuadre.

El desglose ordena del peor al mejor. Los comités [prueba] quedan fuera: salían
de primeros con 0% en todo.

La tarjeta del índice se filtra por rol — hasta ahora el índice mostraba todas
y esta lleva a una pantalla que responde "Acceso restringido" a quien tiene el
módulo reportes pero no es staff ni dirección.

Hoy: 749 servidores · asistencia 79% · en estudio 75% · donantes 51% · cumplen
los tres 39%. Global en ~4 s.

**Cierre 2026-09-21.** El gráfico anual pasa a barras apiladas por canal de
entrada, con el total encima. Suma verificada: charla + estudio + evento = el
total, año por año.

**El filtro ahora aplica a TODO, y esa era la parte de fondo.** La serie que
alimenta los gráficos no tenía la dimensión del origen, así que al elegir una
charla cambiaba la tabla y los gráficos se quedaban igual: dos universos
distintos en la misma pantalla. La función SQL devuelve el origen y los dos
gráficos y la tabla se recortan con el MISMO filtro. Verificado contra
producción en las 15 charlas con gente nueva en agosto: el gráfico y la tabla
dan lo mismo en las 15, y sin filtro los dos dan 204.

De paso, el selector de charla sale de la serie completa y no del mes cargado:
antes cambiaba de opciones según qué mes estuvieras viendo.

**Caso resuelto 2026-09-21.** El sistema no estaba fallando: el correo
`tati_brenes02@hotmail.com` estaba escrito **en la ficha de la mamá**, y la
ficha de Tatiana no tenía correo. La cuenta hacía lo correcto —abrir la ficha
que tiene ese correo— y esa era la de la mamá.

Se movió la CUENTA COMPLETA, no solo el correo: `auth_user_id` y las marcas de
ingreso. Dejar el vínculo de auth en la ficha de la mamá la habría seguido
abriendo aunque el correo estuviera bien puesto.

Los datos NO estaban mezclados: cada una conserva su teléfono y su fecha de
nacimiento. Del audit_log, lo único con rastro legible son dos UPDATE del propio
login (16-set); los cuatro anteriores son previos a AUD-1 y no guardaron el
valor viejo. De paso se le puso la cédula a la mamá (401061311), verificando
antes que ninguna otra ficha la usara. Decisión del usuario: la mamá queda
FUERA de la unidad familiar, que solo tiene a Dennis (titular) y Tatiana.
Dennis ya estaba correcto: cédula 114590150 y correo propio.

**EL PATRÓN NO SE PUEDE DETECTAR SOLO.** Se intentó: correos cuya parte antes de
la @ no se parece al nombre de la ficha. Da 4.656 de 18.533 cuentas —puro
apodo y abreviatura—, así que no sirve como detector y no se deja el script como
si sirviera.

Lo que sí se puede listar, y queda pendiente de decisión:

1. **9 correos están en dos fichas activas a la vez.** Ninguno es urgente como el
   de Tatiana —esas personas ven su propia ficha— pero los correos dirigidos a
   una caerían en la bandeja de la otra. Hay que confirmar de quién es cada uno.
2. **La validación de correo duplicado YA existe y bloquea DURO** (409 al crear y
   al editar). Eso choca con FAM-2: hoy un menor no puede llevar el correo del
   papá desde la pantalla. Decidir si se relaja a advertencia o se permite solo
   cuando la persona es menor.

Scripts en `scripts/dat10/`.

### [x] AUT-4 · Quitar el bloqueo al cumplir 18 años — HECHO 2026-09-21

El script de FAM-2 bloquea las cuentas de menores hasta el año 2126, y su propio
comentario dice que "al cumplir 18 basta con quitar el ban" — pero **nada lo
hace**. Se descubrió porque Nathaly Avendaño (15) reportó que el enlace de
contraseña siempre salía vencido; al medirlo aparecieron **Saul Sánchez y
Esteban Quesada**, que cumplieron 18 el 18 y el 19 de setiembre y seguían sin
poder entrar. Se desbloquearon a mano
(`scripts/menores-2026-09-21/desbloquear-mayores.cjs`), pero **hay 8 más que
cumplen en octubre** y va a pasar todos los meses.

Prompt para Claude Code:

```
FEATURE · Cron que desbloquea las cuentas al cumplir 18

Correr a diario: quitar `banned_until` de las cuentas de auth cuya ficha ya tiene
18 años cumplidos y siguen bloqueadas. Reutilizar `esMenor`/`esMenorDeEdad` de
lib/members/reglas-de-menores — NO reimplementar el cálculo de edad.

Solo desbloquea lo que el script de menores bloqueó: no tocar cuentas de fichas
fusionadas (correo `fusionado+...@theosplace.invalid`), que están bloqueadas a
propósito y para siempre.

Dejar rastro de cada desbloqueo (audit_log o message_logs) y avisar a la persona
de que ya puede crear su contraseña — decidir con el usuario si ese correo se
manda o no.
Tests de la regla pura con fechas de borde (cumple hoy, cumple mañana, sin fecha
de nacimiento → NO se desbloquea, es un caso a revisar). tsc/lint/vitest.
```

**Cierre 2026-09-21.** Cron el **1 de cada mes** (decisión del usuario: mensual,
no diario). La consecuencia queda dicha en el código: quien cumple el 2 espera
hasta el 1 del mes siguiente.

**NO CREA CUENTAS**, y eso fue lo que el usuario quiso dejar claro. Las cuentas
ya existen desde AUTH-1 (julio 2026); lo único que se les hizo fue bloquearlas.
El cron quita ese bloqueo y nada más. Quien nunca tuvo cuenta sigue sin tenerla.
Y desbloquear tampoco da acceso por sí solo: ninguna se usó jamás, así que no
tienen contraseña — lo que cambia es que "olvidé mi contraseña" empieza a
funcionar.

Dos exclusiones, con test: las cuentas de fichas **fusionadas** (dominio
`.invalid`) siguen bloqueadas para siempre, y las que **no tienen fecha de
nacimiento** tampoco se desbloquean — sin el dato no se puede afirmar que
alguien cumplió 18, y en la duda no se abre una cuenta.

La respuesta del cron dice a quién desbloqueó y cuántos se quedaron por cada
motivo: sin eso, un cron que no hace nada y uno que se saltó a alguien se ven
igual.

**Pendiente aparte:** las cuentas de PRUEBA siguen vivas. Está anotado como
SEC-4 en la Fase 20.

### [x] CHK-5 · Pedir el correo en la puerta — HECHO 2026-09-22

El aviso sale DESPUÉS de registrar el check-in y se puede cerrar: la fila nunca
se frena. Mismo patrón que la captura de documento de FIN-2, que vive tres
líneas más arriba en la misma pantalla.

**El permiso** se resolvió con un endpoint nuevo y angosto
(`POST /api/events/[id]/checkins/contact-info`) en vez de abrirle la edición de
miembros a la puerta. Cuatro candados, ninguno solo en la pantalla:

- el mismo `requireEventAccess(..., puerta)` del check-in, que ya trae la regla
  por comité de EVE-12 y la del subevento de CHK-4;
- **tiene que haber check-in de HOY en ESE evento** — sin eso el endpoint sería
  una forma de editar a cualquiera del padrón desde la puerta;
- **el campo tiene que estar vacío**: esto LLENA, no corrige. Si ya hay valor,
  409 y a la edición normal;
- correo duplicado, 409 sin decir de quién (criterio de DAT-10).

No crea cuentas ni manda correos. Todo queda en `audit_log` con el evento desde
el que se capturó. `src/lib/auth/checkin-endpoints.test.ts` lo blinda: es el
tercero de esa familia y el más fácil de aflojar sin querer.

**Una decisión que vale la pena mirar.** Solo se le pide a quien **sabemos** que
es adulto: sin fecha de nacimiento no se pregunta, aunque el resto del sistema
trate la edad desconocida como adulta para no bloquear a nadie. Acá el riesgo va
al revés —guardarle el correo propio a un chico de 15 es justo lo que FAM-2 no
quiere— y son 3.260 fichas sin fecha. Está en un test para que aflojarlo sea
deliberado.

El lookup manda `falta_contacto` **ya resuelto por el servidor**, siguiendo lo
que hizo CHK-2 con la fecha de nacimiento: la puerta recibe la decisión, no los
datos con los que se tomó.

**Alcance medido el 2026-09-22:** 3.703 adultos activos sin correo o sin
teléfono (2.882 solo sin correo, 463 solo sin teléfono, 358 sin nada), y **64 de
los 65** que cumplieron 18 sin cuenta.

**Los tres caminos cubiertos** (búsqueda, familia y QR). El panel es una COLA y
no una persona, que es lo que pedía la familia: registra a varios de una, y con
un solo panel de una familia de cuatro se le pedía el dato a uno y los otros
tres se perdían en silencio. Se atiende de a uno —la fila sigue avanzando— y
cuando hay varios el panel dice "1 de N".

La cola no repite a quien ya está (con el QR es fácil escanear dos veces) y solo
encola a quien QUEDÓ registrado: el endpoint exige check-in de hoy, así que
ofrecerle el formulario a alguien que rebotó por falta de inscripción sería
ofrecer algo que después falla.

`/api/members/[id]/family` también manda ahora `falta_contacto` resuelto por el
servidor. La puerta sigue sin recibir la fecha de nacimiento ni el teléfono de
nadie.


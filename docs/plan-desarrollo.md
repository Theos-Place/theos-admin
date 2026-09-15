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
- [ ] Configurar Sentry (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`).
- [ ] Copiar las env vars de Supabase a los deploys **Preview** de Vercel (hoy solo están en Production y los previews fallan).
- [ ] Confirmar el SMTP de Supabase Auth.
- [ ] Bajar el vencimiento del OTP a menos de 1 h en el panel de Supabase.

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

Pendiente menor: quedaron 2 "Si" y 1 "FOTOS SI" clasificados como alergia. No
son alergias, pero un "Si" al menos avisa que hay algo que preguntar, así que
se dejaron a propósito en vez de borrarlos.

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

### [ ] DAT-8 · 54 menores de 12 con correo y sin familia

Salió de limpiar los correos de menores (2026-09-10). De 87 con correo, a 28
se les quitó porque estaban en una familia y a 5 se les armó la familia con
evidencia. Quedan 54 a los que NO se les puede quitar el correo: sin familia
detrás se quedarían sin ninguna forma de contacto.

La lista, con la evidencia de cada uno, está en
`scripts/output/menores-sin-familia.csv`:

-  3 comparten teléfono con un adulto → revisables de una.
- 39 solo comparten un apellido con alguien que tiene familia. **Eso no es
  evidencia**: hay cientos de Rodríguez. Hay que preguntar.
- 12 sin ninguna pista.

Ojo con dos de los 3 primeros: Alana y Elena apuntan a "Carlos Blanco", que
estaba DUPLICADO. **Resuelto el 2026-09-15**: el 23828 se fusionó en el 17615,
así que ese bloqueo ya no existe.

Y un vínculo equivocado no es inocuo: por la regla de una persona = una
familia, vincular mal FUSIONA dos hogares.



## Fase 15 — Hallazgos del repaso de QA del 2026-09-11

Salieron de revisar en frío lo que se construyó ese día (aprobación de becas,
mover una beca de destino, tags, y la limpieza de warnings). Lo que **funciona**
quedó verificado contra producción con un ida y vuelta real —27 comprobaciones,
incluida una beca movida de verdad y restaurada campo por campo— así que acá
solo está lo que **falta**.

### [ ] BEC-2 · Avisar cuando el destino de una beca activa se quedó sin cupo

Es el problema que destapó todo esto y sigue sin estar en pantalla. Hoy, en
producción:

| persona | destino | grupos abiertos | con cupo |
|---|---|---|---|
| Karla Ávila | Romanos | 1 | **0** |
| María José Ruiz | Romanos | 1 | **0** |
| Monserrath Arroyo | Evangelismo | 2 | 2 |

Las dos primeras tienen una beca viva que no pueden usar, y nadie se entera
hasta que la persona escribe. La pestaña "Becas asignadas" ya lista las que
están sin usar; falta que la fila diga **"sin cupo en el destino"** y que ese
sea un filtro, para que sea una cola de trabajo y no un hallazgo casual.

La consulta ya está resuelta: por cada beca activa, contar los grupos del plan
en `en_matricula` cuyo `max_students` es nulo o mayor a sus inscritos
(`enrolled` + `pendiente_de_pago`). Cero = sin cupo.

CUIDADO: un plan sin NINGÚN grupo abierto no es lo mismo que uno lleno. El
primero puede abrir la otra semana; el segundo hay que resolverlo ya. Que el
aviso los distinga.

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

### [ ] FRM-5 · Restricción de audiencia en formularios

```
FEATURE · Limitar un formulario a cierto tipo de personas: que solo le aparezca disponible
a quien cumple la condición.

Casos pedidos: solo servidores (servicio activo) · solo donantes · solo quienes tienen un
estudio activo (y poder especificar CUÁL plan) · solo quienes ya APROBARON cierto estudio ·
solo dirigentes. Y combinaciones.

REUTILIZAR, NO INVENTAR — es el mismo problema ya resuelto dos veces:
 · GRU-2 (restricción de audiencia por grupo de estudio) usa el modelo de condiciones del
   filtro del padrón (src/types/filters.ts: study, leader, service, donor, attendance…) y
   una función pura evaluateConditions(member, conditions) per-persona. Usá EXACTAMENTE esa
   pieza: mismo shape de condiciones, mismo evaluador, mismas etiquetas de
   condition-labels. Si GRU-2 dejó el evaluador acoplado a grupos, extraelo a un módulo
   compartido y que ambos lo consuman.
 · La condición de estudio ya distingue "activo/enrolled" vs "completed" y el plan
   específico — cubre "estudio activo de tal tipo" y "ya aprobó tal estudio" sin nada nuevo.

1) MIGRACIÓN: audience_restrictions (jsonb, nullable) en forms. Null = sin restricción
   (como hoy).
2) BUILDER: sección "¿Quién puede llenar este formulario? (opcional)" con el constructor de
   condiciones del padrón. Resumen legible de la restricción en la lista de formularios.
3) APLICACIÓN — tres capas, y acá está lo delicado:
   a) LISTADO/DISPONIBILIDAD: a quien no cumple, el formulario no le aparece disponible.
   b) SERVER-SIDE al ABRIR y al ENVIAR respuesta: 403 con mensaje claro ("Este formulario
      es solo para servidores activos") — el link directo compartido por WhatsApp va a
      llegar a gente que no cumple, y la respuesta de alguien fuera de la audiencia no debe
      entrar aunque tenga la URL.
   c) FORMULARIOS PÚBLICOS (is_public / sin sesión): una restricción de audiencia exige
      saber QUIÉN es la persona → un formulario con restricción NO puede ser público
      anónimo. El builder debe forzar requires_auth cuando hay restricción, con la
      explicación de por qué.
4) INTERACCIÓN con lo existente: el staff que llena "a nombre de" otra persona (FRM-4) —
   la condición se evalúa sobre la persona A NOMBRE DE QUIEN se llena, no sobre el staff.
   Los accesos puntuales por formulario (FRM-1) son de LECTURA de respuestas y no cambian.
5) En la vista del formulario para gestores: contador de cuántas personas del padrón
   cumplen hoy la restricción (mismo patrón que GRU-2) — detecta de una condiciones mal
   armadas que dejan el form sin audiencia.
Tests: form restringido no aparece a quien no cumple; el POST de respuesta rechaza con 403;
restricción fuerza requires_auth; "a nombre de" evalúa al titular; combinación de dos
condiciones; form sin restricción intacto.
```

### [ ] FAM-2 · Reconstruir las familias desde CCB + reglas de menores de edad

```
DATA FIX + REGLA · Muchos reportes de que las familias ya no salen en el sistema nuevo.
Fuente: data-import/familias-ccb-2026-09-14.csv — las 1.578 familias reales de CCB (2+
integrantes, 4.126 personas) con family_id, external_id, posición (primary contact /
spouse / child / other), correo, teléfono y cédula.
Script one-off, DRY-RUN por etapa con mi aprobación. EMAIL_SILENT_MODE si sigue activo.

────────────────────────────────────────
PARTE A · RECONSTRUIR LAS FAMILIAS
1) DIAGNÓSTICO primero: de las 1.578 familias de CCB, ¿cuántas existen hoy en family_units
   (todas juntas), cuántas parciales (algunos integrantes sí, otros no), cuántas ausentes?
   Ese número dice el tamaño real del problema que la gente reporta.
2) IMPORTAR/COMPLETAR: para cada familia del CSV, matchear integrantes por external_id y
   dejarlos en UNA unidad familiar:
   - Nadie está en familia → crearla completa.
   - Algunos ya están en una unidad → sumar los que faltan a ESA unidad.
   - Integrantes repartidos en DOS unidades → fusionarlas (la regla de "una persona = una
     familia" y su fusión ya existen — reutilizala; recordá que fusiona hogares completos).
   - Mapear la posición de CCB a la relation del sistema (primary contact → Titular,
     spouse/child/other → los valores que use family_members).
   - NUNCA sacar a nadie de una familia existente: este import agrega y une, no separa
     (las separaciones son el flujo manual que ya existe).
3) Sin match por external_id → reporte, no crear miembros.

────────────────────────────────────────
PARTE B · REGLA NUEVA DE MENORES DE EDAD (obligatoria, transversal)
Para MENORES (birth_date < 18 años, calculado — y si no hay fecha de nacimiento, no se
puede saber: tratarlos como caso a revisar, no asumir):
 1) NO crearles usuario de login: excluirlos de cualquier creación de cuentas (el script
    masivo de AUTH-1, el botón de crear cuenta en la ficha, el flujo de check-in). Si un
    menor ya tiene cuenta creada de corridas anteriores, reportarlos — decido yo si se
    deshabilitan.
 2) NO exigirles teléfono ni correo: en todos los formularios donde esos campos son
    obligatorios (crear miembro, completar perfil, FIN-2, check-in), para menores pasan a
    opcionales. El contacto es el de su familia — por eso la Parte A importa: un menor
    SIN familia vinculada queda sin vía de contacto (ese reporte ya existe:
    scripts/output/menores-sin-familia.csv — conectalo).
 3) Server-side además de UI: las validaciones de zod que exigen email/phone deben
    excepcionar menores; y el endpoint de crear cuenta debe RECHAZAR a un menor con 403 y
    mensaje claro, no solo esconder el botón.
 4) LIMPIAR TELÉFONOS PRESTADOS: si el teléfono de un menor es IGUAL (normalizado) al de
    alguno de los adultos de su familia, quitárselo al menor — es el número del papá o la
    mamá dado en algún formulario, no un dato del menor; duplica el contacto y ensucia
    búsquedas y dedup. Orden importa: correr DESPUÉS de la Parte A (sin familia vinculada
    no se sabe de quién es el número). Solo se borra si el adulto de la familia lo tiene;
    un teléfono del menor que no coincide con nadie se queda. Dry-run con la lista
    (menor → teléfono → con cuál familiar coincide) antes de borrar, y el mismo criterio
    aplicado a los CORREOS (menor con el correo del papá/mamá → quitárselo al menor).
 5) Al cumplir 18: no automatices nada todavía — pero dejá una consulta/reporte de "menores
    que ya cumplieron 18 sin cuenta" para ofrecerles el alta cuando corresponda.

VERIFICACIÓN: conteo de familias antes/después; los casos reportados por la gente (pedirme
2-3 nombres concretos de los reportes) verificados a mano; ningún menor con cuenta nueva;
crear un miembro menor sin correo ni teléfono funciona de punta a punta.
```


## Fase 17 — Hallazgos del 2026-09-15

Salieron de trabajar el comunicado de Meridiano, el data fix de las series de
charlas y el barrido de servidores contra CCB. Ninguno bloquea nada hoy.

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

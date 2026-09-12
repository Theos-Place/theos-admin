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

### [ ] DAT-6 · Traer las asistencias al día desde CCB — **es del usuario**

Actualizar todas las asistencias de las personas. El dato sale de CCB; no es
trabajo de código hasta que exista el archivo. Cuando llegue, se importa con el
camino de `seed-attendance-long.ts` (ojo con los gotchas ya documentados:
`status='finished'`, fechas en MM/DD/YYYY, dedup por día en hora de Costa Rica).

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

### [ ] DAT-7 · Lo que la gente escribió en el campo de alergias

Lo destapó el export de EVE-9. De 172 personas con algo escrito ahí:

- **13 escribieron una restricción alimenticia**, no una alergia: "Celiaca-No
  gluten", "Intolerante a la lactosa", "Gluten y lacteos". Es justo el dato que
  ahora tiene campo propio. NO se convierte solo: "Gluten" puede ser celiaquía
  o alergia de verdad, y esa diferencia le importa a quien cocina.
- **4 escribieron otra cosa**: 3 un correo y 1 un teléfono. Se colaron de un
  campo equivocado en algún formulario.
- **22 escribieron "No" o "Ninguna"**, que es ruido: ocupa la columna y hace
  que la lista de cocina resalte a alguien que no necesita nada.

Script: `scripts/cierre-2026-09/alergias-sucias.ts`.


## Fase 14 — Pedido el 2026-09-10 (tarde)

> Nota 2026-09-10: la fase decía "Hecho" pero REP-2 NO está implementado (verificado contra
> el código: no existe el deep link ?semana= ni el panel de detalle). Queda pendiente.

### [ ] REP-2 · Reporte de asistencia: ver una semana sola, no el acumulado

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
está DUPLICADO. Primero se resuelve el duplicado.

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

### [ ] BEC-3 · `email_sent_at` se marca aunque el correo no haya salido

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

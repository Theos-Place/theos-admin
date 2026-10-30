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

### [x] DAT-5 · Grupos finalizados con gente sin resultado — CERRADO 2026-10-16

**Verificado en prod el 2026-10-16:** ninguna inscripción de un grupo cerrado
desde dic-2025 sigue en `en_revision`; las 10 personas colgadas ya tienen
resultado (26 inscripciones pasaron de `en_revision` a su desenlace el
2026-10-15). Quedan 423 `en_revision` HISTÓRICAS (133 grupos, 2014–nov 2025),
que no son de este ítem: vienen del histórico y no hay dirigente a quién
preguntarle. Si algún día se quieren cerrar, es una decisión aparte.


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

### [x] Jornada del 2026-10-13 · lo que salió de reportes del día

Nada de esto estaba en el plan: salió de lo que Floriana fue encontrando.
Todo en producción el mismo día.

 · **DIR-12** — los filtros de la lista de dirigentes hablaban el vocabulario
   ANTERIOR a DIR-8, así que los estados nuevos no se podían filtrar. La causa
   de fondo no era el filtro: el adaptador armaba el dirigente desde cero y no
   copiaba los campos de DIR-8, y el tipo tampoco los declaraba — el endpoint
   los mandaba y se perdían en silencio.
 · **PRE-9** — pantalla para leer los cierres del prematrimonial. El dato
   existía desde PRE-8 y solo se alcanzaba sabiendo el id de la pareja.
 · **EVT-9 / EVT-10** — tres bugs encadenados del evento compartido: no
   aparecía en el calendario de quien estaba adentro; «compartir» resultó ser
   nombrar ENCARGADO y eso no estaba contemplado; y el servidor no le mandaba
   las inscripciones al encargado, así que el tab abría vacío.
 · **MAT-4** — aviso el mismo día a quien deja la matrícula a medias. El de 24
   horas llegaba hasta 48 horas tarde porque el cron corre una vez al día.
 · **UI-3** — la flecha de los 174 dropdowns, separada del borde.
 · **EST-14 (datos)** — 8 cobros de ₡5.000 creados por error en grupos N1
   legacy, que son gratis. Tres personas habían perdido el cupo por no pagar
   algo que no debían: devueltas. Las cinco que sí pagaron quedan con crédito
   para su N2.
 · **Accesos** — censo de quién ve montos; Sofía y Gisselle fuera, la cuenta de
   Finanzas Madrid desactivada.

### [x] Jornadas del 2026-10-19 y 2026-10-20 · lo que salió de esos días

Nada estaba en el plan. Casi todo en producción; lo último del 20 (zona
virtual, conteo de reubicaciones, enlaces de la demanda) quedó en staging.

 · **REP-18** — los PUESTOS de dirección ven todos los reportes: Director de
   Área y cualquier puesto del comité «Directores» (el Consejo Dirección NO,
   decisión de Floriana). Los nueve de Reportes, los de Finanzas (solo
   lectura, con montos) y el contacto de Personas nuevas. Va por puesto
   (`esPuestoDeDireccion` → `tienePuestoDeDireccion`), no por rol: el rol
   `reportes` abre solo cuatro, que era el bug (Melissa Acón no veía
   Estudios ni Dirigentes).
 · **FOL-DIS** — folletos de DISCÍPULOS (2026-10-26, Floriana): los tres
   —1, 2 y 3— se piden JUNTOS al crear el grupo de Discípulos 1, una sola
   vez; los cierres 1→2 y 2→3 no crean tiquete ni mandan «folletos listos».
   Estaban creando tiquetes y avisando al dirigente en cada cierre (el de
   Fernando Gutiérrez, DIS2→DIS3 del 24-oct, 10 juegos). Regla en
   `folletosQuePide` (`FOLLETOS_DE_DISCIPULOS`, vale en legacy y bloques);
   `cierrePideFolletos` separa «hay sucesor» de «pide folletos» en el
   endpoint y la pantalla de cierre; DIS1 entra a los folletos anticipados.
 · **FECHAS TICAS** (2026-10-26, Floriana): toda fecha en tablas, listas,
   chips y controles va en dd/mm/aaaa. `formatDate` → «05/05/2026»,
   `formatDateTime` → «05/05/2026, 02:30 p. m.», `formatDayMonth` → «05/05»,
   `formatMonthYear` → «05/2026»; 12 llamadas sueltas con mes en letras
   pasaron al formateador central (trinquete 56 → 40). La forma en letras
   («5 de mayo de 2026») queda SOLO en frases y correos. Y los 65 campos
   `<input type="date">` nativos —que el navegador pinta según su idioma—
   se reemplazaron por el `DatePicker` de Theos (ahora con max, id,
   disabled, className, style; muestra dd/mm/aaaa y se abre hacia arriba
   si no cabe). Excel sigue exportando fechas reales, que Excel muestra
   según cada compu.
 · **REP-19** — el ROL `reportes` ve los nueve reportes (2026-10-21). El módulo
   de paso (comunicaciones, coordinaciones) sigue abriendo solo los cuatro
   generales. Caso: la cuenta de Finanzas no veía Servidores.
 · **SEC-4** — tablas de `public` solo con la llave de servicio (aviso de
   Supabase: desde el 30-oct no hay GRANT automático). Regla en AGENTS.md,
   `permisos-de-tablas.test.ts`, y migración `20261020120000` con los
   permisos por defecto y sin `authenticated` en las 16 tablas con RLS sin
   políticas. El aviso «RLS Enabled No Policy» es a propósito.
 · **Orden de los reportes en todas las pantallas de gestión** — rango
   desde/hasta y Excel arriba, tarjetas, búsqueda con filtros a la derecha
   (piezas en `reporte-ui` y `BarraDeReporte`): pagos, devoluciones, saldos a
   favor (fecha = cuándo se generó el saldo, `llegadaDelPago`), becas (con
   tabs), cobros sin estudio, soporte, solicitudes (las cuatro pestañas),
   evaluaciones, folletos, aplicaciones de servicio (rango en el servidor) y
   cierres del prematrimonial (sin Excel: contenido pastoral).
 · **EST-29** — la demanda pasó a ser la pestaña «Análisis de demanda» de
   Solicitudes, con tres etapas (5+ listos, 2–4 potencialmente, 1 aún no),
   dirigentes detrás de un clic y «Abrir su solicitud» por persona. Zona
   «Virtual» en el interés de estudio, con el porqué obligatorio.
 · **Paquete de niveles (legacy)** — `study_enrollments.niveles_prepagados`:
   un cobro legacy pendiente se registra como paquete (N2+N3+N4) y el
   sucesor nace sin cobro. Caso Daniela Seas.
 · **Auditoría** — `audit_log.actor_id` apunta a auth.users y varios
   endpoints pasaban el memberId: la fila se perdía en silencio. Ahora van
   por `logAudit` con `auth.ctx.userId` (`auditoria-actor.test.ts`); se
   recuperaron 23 filas.
 · **Correcciones de datos** (respaldos en `docs/correcciones/2026-10-19-*`):
   pagos de Karol Villalobos, Kattya Abarca, Mariana Alvarado (3 reubicados
   borrados), Mirtha Cruz, Roberto Fernández y Luz Cáceres, Daniela Seas.
 · Otros: el grupo en la lista de pagos dice su dirigente; filtros de
   Dirigentes en una caja; submenú de Estudios alfabético; cierre
   prematrimonial de un grupo hecho a mano dice quién es la pareja.

### [x] Jornada del 2026-10-14 · lo que salió del día

Igual que la del 13: nada estaba en el plan. Todo en producción el mismo día,
menos lo que dice «staging».

 · **DIR-14 / DIR-15** — la lista de dirigentes mostraba DOS conteos distintos
   (encabezado por estado derivado, chips por estado administrativo). Manda el
   administrativo; «Dando ahora» pasó a ser una opción del filtro, al lado de
   Estado, combinable y con conteos contextuales (las opciones que dejan la
   lista vacía se apagan). Aparece el tercer grupo «sin ficha».
 · **FOR-x** — filtro «Creados por mí» en formularios, visible siempre.
 · **EVT-11** — un formulario compartido por N eventos inscribía a la persona
   en TODOS (Sabrina con 4 pagos de Volley; Sports Day + Hiking). Ahora se
   inscribe solo al día que eligió. Limpieza: 36 inscripciones fantasma y 19
   pagos borrados (no anulados: pedido de Floriana), 1 cobro huérfano de
   ₡17.500 borrado, 124 `paid_at` rellenados desde la fecha del comprobante.
 · **MAT-5** — en el perfil, tab Participación: «Pago pendiente · vence …»
   para las matrículas sin comprobante, con el mismo reloj que usa el cron.
 · **FIN-11 (acceso)** — viáticos vive en /empleados/viajes y solo entra quien
   tiene fila activa en `employees` o revisa (finanzas/dirección). Hoy nadie
   es empleado: la lista la llena RH.
 · **FIN-12** — adelantos de comida por sede (ver su ítem).
 · **INC** — incidente en prod: subir comprobante en una inscripción pública
   decía «No autenticado». Ruta pública nueva para el adjunto, con ventana del
   formulario y rate limit por IP.
 · **FIN-14** — se eliminó /finanzas/solicitudes: becas y devoluciones ya la
   cubrían; las notificaciones apuntan a /finanzas/becas.
 · **DON-4** — 15.135 donaciones con monto 0 pasaron a null, y la lista
   distingue «Sin monto» de «monto oculto». Familias quedan como están.
 · **Cuenta** — borrada la cuenta de miembro «Coordinador de Estudios Theos
   Place» (la real es estudios@theosplace.org, intacta). Respaldo en docs.
 · **UI-4** — el flyer llena el hero de la tarjeta (cuadrícula de eventos y
   calendario público): object-cover, sin franjas.

**Queda del lado de Floriana / otros:** RH llena `employees` (sin eso nadie
pide viáticos); fijar la tarifa por km (hoy ₡0); confirmar que Dirección
aprueba viajes; Meli con la hoja de donaciones de FIN-12; cargar montos de
donaciones jul–ago si se quieren (hoy son null).

### [x] REP-17 · Reporte de finanzas: rango de fechas y «por comité» — HECHO 2026-10-14 (staging)

Pedido de Floriana: «agregar un rango para hacer el reporte basado en el
rango; no entiendo de dónde salen los ₡4.102.500; donde dice por entidad,
agruparlos por comité (estudios, eventos de ayuda social, sports…)».

 · Los ₡4.102.500 eran la suma de los 384 pagos cancelados de TODA la
   historia: la pestaña no tenía rango. Ahora tiene Desde/Hasta por fecha de
   pago (cancelados) o de creación del cobro (lo demás), y el encabezado dice
   «Toda la historia» cuando no hay rango.
 · «Comité» = área + categoría (`lib/finance/categoria-de-pago.ts`, puro):
   Estudios · Niveles / Discípulos / Capacitaciones / Prematrimonial /
   Folletos; Eventos · <tipo del catálogo> (Ayuda Social, Sports, Taller…).
   Filtro por área entera o por categoría, y debajo el de entidad acotado a
   lo que se mira. Tabla «Por comité» con pagos, cobrado, pendiente y
   devuelto; el CSV lleva la columna.
 · El pago viaja con `event_type` y `plan_code/level` (query + adapter).

Lo que NO se hizo: un comité «Servidores». No hay nada en los pagos que
diga «lo pagó un servidor»; si se quiere, hay que decidir qué significa.

### [x] FIN-12 (acceso) · Adelantos: Encargado Logística y Coordinador Comida — 2026-10-14 (staging)

Decisión de Floriana: «solamente el encargado de logística y el encargado
de comida (puestos), además de finanzas, admin y dirección». El catálogo no
tiene «Encargado Comida»: el puesto real es «Coordinador Comida» (9 sedes), y
así quedó. Lista única `TITULOS_DE_ADELANTOS` para el rol y para el alcance
por sede. Migración `20261014210000` hace el backfill: 27 personas en 14
sedes lo reciben (medido en prod); nadie tenía el rol viejo.

Datos: el mes de Antares abierto por error (2026-10, ₡0, sin facturas) se
borró en prod; respaldo en `docs/correcciones/`. El presupuesto de Antares
(₡10.000) quedó.

Centro de ayuda: dos guías nuevas, `solicitar-viaticos` (pública) y
`adelantos-de-comida` (colaborador_finanzas, finanzas, dirección).

### [x] DON-4 · Donaciones dentro del reporte de finanzas — HECHO 2026-10-14 (staging)

«Podría incluirse en el primer tab del reporte y así eliminar la pantalla,
sin perder ninguna funcionalidad.» `DonacionesPanel` es la pantalla entera
(stats, lista paginada de 50 en 50, rango, identificar, alta manual, importar,
donantes y montos, CSV del filtrado completo vía `?all=1`). La ruta vieja
redirige al reporte; el menú ya no la lista. Los pagos del reporte se listan
todos, de 50 en 50 (antes se cortaban en 15). Fijado por
`sin-pagina-de-donaciones.test.ts`.

### [x] AYU-5 · Centro de ayuda: viáticos, adelantos, datos del dirigente — guías, infografías y GIF 2026-10-14

Guías nuevas: `solicitar-viaticos` (pública, sin códigos de anexo: «eso
ANX-01 no me dice nada»), `adelantos-de-comida` (colaborador_finanzas,
finanzas, dirección) y `datos-del-dirigente` (dirigente y los roles de
dirigentes). Infografías: `solicitar-viaticos.svg`, `adelantos-de-comida.svg`.
`registrar-donaciones` apunta a la pestaña del reporte.

GIF grabados en prod tras el deploy (`tutorial:viaticos`, `tutorial:adelantos`,
y `tutorial:donaciones` regrabado porque la pantalla cambió de lugar). Dos
gotchas de los flujos nuevos: las fechas del viaje son `datetime-local` (piden
hora), y la factura del tutorial tiene que caber en el presupuesto real de la
sede (Antares, ₡10.000) o el GIF enseña un sobregiro. Los datos de prueba se
borran al terminar (viaje, ficha de empleado, mes de Antares).

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

### [x] LINT-1 · De 93 a CERO warnings — CERRADO 2026-10-14

Seis tandas (93 → 70 → 60 → 57 → 53 → 46 → 0). El gate del CI quedó en
**`--max-warnings=0`**: a partir de acá un aviso nuevo rompe el build.

**Tanda 6 (2026-10-14): los 46 que quedaban, en tres familias.**

 · **Cargas al montar (24)** — `useCargaRemota` ganó dos cosas que faltaban
   para absorberlas: `activo` (no pedir sin permiso / con la pestaña cerrada,
   que era el `if (canView) refetch()` del efecto) y `setDatos` (ajustar lo
   cargado sin volver a pedir: quitar la fila borrada, marcar la aprobada).
   Migradas 20 pantallas/componentes y `useDashboard`, `useEvents`,
   `useEvent`. El vacío va en una constante de módulo (`SIN_DATOS`): un
   `datos ?? []` es un array nuevo por render y revienta los `useMemo`.
 · **Búsquedas con debounce (11)** — pieza nueva `useBusquedaDiferida`, con
   la regla pura en `lib/hooks/busqueda-diferida`: los resultados y «está
   buscando» se derivan comparando la consulta con la que produjo lo
   guardado. Debounce, `AbortSignal`, mínimo, apagado y dependencias
   (excluidos, id) van por parámetro. `useMembers` (paginado) usa la misma
   idea a mano: la lista guarda su clave y «cargando» es que no coincida.
 · **Sincronizar estado con props/URL (11)** — `usePrecarga` donde era un
   vuelco (canal→vista previa, plantilla por URL, config del dirigente) y
   pieza nueva `useUbicacionDeEntrada` (`useSyncExternalStore` sobre
   `window.location`: '' en el servidor, real en el cliente, sin romper la
   hidratación) para los deep links (grupos, becas, RequestBoard, cédula,
   completar-perfil). Dos eran acciones disfrazadas de efecto y pasaron al
   manejador (abrir/cerrar del combobox de dirigentes). El error del escáner
   de QR va atado al intento que lo produjo.

Verificado en staging: eventos, grupos con `?filter=without_leader`,
dirigentes, check-in con búsqueda, soporte. tsc, lint 0 y 5.953 tests.

---

#### Historia de las tandas 1–5 (referencia)

Van cinco tandas (93 → 70 → 60 → 57 → 53 → 46). El techo del gate bajó a **46**.

**Tanda 5 (2026-10-12): las precargas de formulario.** Siete avisos, todos la
misma forma: una pantalla de editar carga datos y los vuelca a sus `useState`
desde un `useEffect`. El aviso tenía razón y no era solo estilo — el efecto
corre DESPUÉS de pintar, así que el formulario aparece un instante vacío y
salta a sus valores; con conexión lenta se ve.

La pieza es **`usePrecarga`** (`src/hooks/`), con la regla en
`lib/hooks/precarga-una-vez`. Ajusta el estado DURANTE el render comparando
contra la clave de lo ya volcado — el patrón que React documenta como
«adjusting state when props change»: re-renderiza antes de pintar, sin
parpadeo y sin efecto que mantener.

Migradas: plantillas/editar, empleados/editar, empleados/puestos/editar,
eventos/editar, miembros/editar, servidores/puestos/editar y el comité.

Dos cosas que había que mirar y no dar por hechas:
 · **eventos/editar dependía de DOS cosas** (`[event, occParam]`): las fechas
   del formulario cambian según la ocurrencia que se abra. La clave lleva las
   dos; con solo el id, abrir otra ocurrencia habría dejado las fechas viejas.
 · **miembros/editar tenía DOS efectos** con la misma guarda. El segundo hace
   scroll y enfoca el input de cédula: eso SÍ es un efecto y se quedó como
   estaba. `usePrecarga` es para volcar estado, no para tocar el DOM, y hay
   un test que falla si alguien mete un `fetch`, un `document.` o un
   `setTimeout` adentro.

**Lo que NO entra en este patrón** (y por qué los 46 que quedan son otra
cosa): la carga al cambiar de pestaña (`becas`, que llama un refetch desde un
efecto) y los debounce de búsqueda (`grupos/[id]`, `servidores/[committeeId]`)
no son precargas — ahí el efecto es legítimo y lo que marca la regla es el
`setState` síncrono de adentro. Esos piden `useCargaRemota` o pensarse uno
por uno.

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

### [x] FAM-2 · Familias desde CCB + reglas de menores — CERRADO 2026-10-12

> **CERRADO, no en pausa (Floriana, 2026-10-12): «realmente no lo podemos
> arreglar, eso se irá arreglando en el futuro cuando las familias hagan
> check-in».**
>
> La parte A está aplicada. La parte B nunca fue un pendiente de desarrollo:
> no hay nada que construir, falta el DATO. Los 3 que califican para la
> invitación no tienen correo, y de los 65 que cumplieron 18 solo 1 lo tiene;
> sin correo no hay a quién invitar. CHK-5 ya le pide el correo a todo adulto
> que pasa por la puerta, así que el hueco se cierra solo, persona por
> persona, sin que nadie lo empuje.
>
> Dejarlo como pendiente solo hacía ver la lista más larga de lo que es. Si
> algún día hay masa suficiente de correos y se quiere mandar la invitación,
> entra como pedido nuevo.


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

### [x] DAT-9 · la nota pasó a ser un guard — 2026-10-13

El ítem decía «no es trabajo pendiente: es una nota para el próximo import».
Medido el 13-oct: la nota SE ESTÁ CUMPLIENDO —`src/` solo lee `external_id`
como dato de la ficha, nunca filtra por él, y los scripts que cruzan contra
CCB usan la función—. No había riesgo activo.

**Lo que se hizo es que deje de depender de que alguien lea AGENTS.md.** Una
nota en un archivo de 300 líneas sirve si la persona la encuentra justo el día
que escribe el import. El guard (`buscar-por-external-id.test.ts`) falla si
aparece un `.eq('external_id')` o un `where external_id =` en `src/`, con el
motivo escrito en el propio error.

Mira FILTRAR, no leer: traer la columna en un SELECT o copiarla en una fusión
es legítimo. Y mira solo `src/`: los scripts de un solo uso ya corrieron
—varios son anteriores a la regla— y reescribirlos no cambiaría ningún dato.

## Fase 21 — QA integral (pedido 2026-09-22, reordenado el mismo día)

**Orden decidido por Floriana**: NO se re-siembran cuentas de prueba en producción.
Primero lo que no necesita cuentas (QA-1), después staging (INF-1) con las cuentas
sembradas ahí, y desde staging el QA autenticado completo (QA-2).

### [x] QA-2 · QA autenticado completo, desde staging — INFORME 2026-10-15

`docs/qa-2026-10/informe-autenticado.md`. 123 pantallas con axe en dos anchos,
81 chequeos de acceso en 14 roles (sin fugas), 0 desbordes en móvil, 5 de 6
flujos por teclado. Hallazgos: 6 MEDIO (contraste sistémico en 6 tokens, 50
botones de ícono sin nombre, selects sin label, sin «saltar al contenido», el
modal no devuelve el foco con autoFocus, foco invisible en fechas de
RequestBoard) y 5 MENOR. Sin CRÍTICOS. Cinco tandas de arreglo propuestas al
final del informe; scripts reproducibles en `scripts/qa/`.


Con las cuentas de staging: axe + mobile + teclado sobre las pantallas de cada módulo,
y el recorrido heurístico por rol (dirigente cerrando grupo, finanzas aprobando pagos,
encargado en la puerta, miembro matriculándose desde el celular): ¿sé dónde estoy? ¿sé
qué hacer? ¿el error me dice cómo salir? ¿cuántos clics costó? El prompt se detalla
cuando staging exista, sumando lo aprendido en QA-1.

### [x] QA-3 · Auditoría de código: endpoints, llamados a la BD y rendimiento — INFORME 2026-10-15

`docs/qa-2026-10/informe-codigo.md` + `censo-endpoints.md` (397 handlers, 0 sin
guard, 0 IDOR, sec3 limpio). Hallazgos: 6 MEDIO (matrícula carga los 2.222
grupos: la consulta 1.ª de prod con 1.894 s acumulados; lista de eventos con 6
embeds; `get_group_attendance()` sin rango y derramando a disco; 82 escrituras
sin zod; 129 exports muertos incluidas 6 funciones de escritura; 85 clones) y 6
MENOR. Sin CRÍTICOS. Línea base: tsc/eslint limpios, 5.984 tests.

**Plan combinado de los dos QA en `docs/qa-2026-10/plan-de-corrida.md`:** seis
tandas (accesibilidad de base → nombres y foco → las tres consultas que dominan
prod → limpieza → menores → zod por módulo).

## Fase 23 — Reuniones de estudios y dirigentes (2026-09-24, dos llamadas grabadas)

Decisiones tomadas con Yeya, Fabiola (dirigentes) y Ariana (estudios). Minuta
completa en `docs/minutas/estudios-2026-09-24.md`. Orden sugerido: RET-1 y
SRV-10 son urgentes (privacidad); EST-14 es el grande y se prueba en staging
antes de producción (dicho en la reunión).

### [x] EST-14 · Niveles en dos bloques — CERRADO 2026-10-12

> **Fases 1-3 hechas el 2026-09-30.** La transición queda FUERA del plan de
> desarrollo: la está resolviendo Denise (decisión de Floriana, 2026-10-12).
> Las reglas de abajo se conservan porque son el contrato de lo construido;
> si la transición devuelve un cambio, entra como pedido nuevo.

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

### [x] DAT-14 · Histórico completo de process queues de CCB — APLICADO 2026-10-13

El export llegó completo (29.618 filas, 2013–2026) y **la decisión de Floriana
al verlo fue acotar el alcance**: *«lo único que queremos con este reporte de
CCB es confirmar si podemos encontrar alguno de los que teníamos dudas»*. No
hay limpieza masiva. Las 321 `en_revision` sin respaldo **se quedan como
están**: el archivo sirve para sumar lo que falta, no para borrar historia.

**LO QUE SE APLICÓ** (`scripts/dat14-2026-10-13/aplicar.cjs`, con respaldo y
dry-run; el criterio con tests en `src/lib/studies/conciliacion-ccb.ts`):

- **40 cierres** que CCB tenía y el sistema no tenía de ninguna forma: 11 N3,
  9 N1, 8 BUS, 5 DIS1, 4 N2, 3 N4. Entran como las 22.331 históricas —sin
  grupo, con plan y fecha— y con nota de procedencia.
- **Los 4 «CCB aprobó / el sistema reprobó», y resultaron ser tres casos
  distintos.** Mailyn Ulate: mismo intento, CCB se lo aprueba un mes después
  del cierre → se corrigió a `completed`. Roberto Acosta: reprobó en 2014 y
  aprobó en 2015, dos intentos → **se agregó la aprobación y la reprobación se
  quedó**; cambiarle la de 2014 le habría borrado que reprobó. Byron Pérez y
  José Manuel Avendaño: el sistema ya tenía razón, no se tocaron.

**TRES COSAS QUE SOLO APARECIERON MIDIENDO, y las tres cambiaban el resultado:**

1. **El histórico de CCB se cargó SIN grupo** — 22.331 matrículas llevan plan y
   resultado pero ningún `study_group`. Un `join study_groups` las desaparece y
   con ellas el 60% de la historia: la primera corrida dio 17.562 «cierres
   nunca registrados» que sí estaban. Con `left join`, 42.
2. **Las campañas nunca fueron cola en CCB.** 8.488 de los 9.114 «sin respaldo»
   son TRANS, PQET, TPS, CAMP, UFA, REDESC: no tienen cómo tener respaldo.
3. **Las colas «Reprueba» no son una aprobación, pero sí son la prueba de la
   reprobación.** De 54 reprobados sin cola de aprobación, 45 tienen su
   «Reprueba» con fecha compatible. Botarlas habría mandado 45 reprobaciones
   reales a la lista de «errores de unión al grupo».

**LAS FECHAS NO SE PUDIERON RECUPERAR, y conviene que quede escrito por qué.**
La fecha buena no está en `Due` (que es el vencimiento y difiere hasta por
cinco días) sino incrustada en `Queue Days`: `"5 Days in queue, completed on
24 jul 2020"`. Tomando `Due` salían 1.751 Nivel 2 con la MISMA fecha,
2019-06-13 — que Floriana confirmó que fue **un arreglo hecho en CCB en su
momento**, no el día en que nadie terminó nada. Esas filas dicen `completed
on ` en blanco. Medido: de las 2.179 matrículas `completed` sin fecha del
sistema, CCB tiene fecha real para **0**; 2.132 son exactamente las filas que
en CCB tampoco la traen y 47 ni aparecen. El hueco vino de CCB y no hay de
dónde sacarlo. Escribirles 2019-06-13 habría puesto una fecha falsa con pinta
de exacta en el expediente de 1.751 personas.

Queda sin tocar, por si alguna vez se decide: 321 `en_revision`, 109
`completed` y 9 `reprobado` sin respaldo en CCB.

<details><summary>El pedido original, 2026-09-28</summary>


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

</details>

Cierra lo que [~] DAT-5 dejó abierto y le da respaldo real a la limpieza.

### [x] FIN-11 · Viáticos y kilometraje — COMPLETO 2026-10-14 (fases A–D + PDF)

Base: `Anexos_Reglamento_Viajes_Asociacion_THEOSPLACE_Version1.docx` (5 anexos,
versión 1.0 del 05/05/2026). Candado de Tilopay retirado por Floriana.

**LO CONSTRUIDO (fase A): el expediente, la solicitud, el presupuesto y las
tres firmas.** Migración `20261013210000`: `travel_requests`,
`travel_budget_items` y `travel_request_status_history`, con RLS prendida y
sin políticas (todo pasa por el servidor; sin eso PostgREST publicaría los
viáticos de todo el mundo con la llave del bundle — SEC-3). Pantallas:
`/viajes` (bandeja, con pestaña «Por revisar» solo para quien revisa),
`/viajes/nuevo` y `/viajes/[id]`.

**LAS TRES FIRMAS SON TRES MANOS, y es lo único que de verdad había que
proteger.** `solicitante → finanzas revisa → la autoridad aprueba`. Finanzas
NO puede aprobar lo que revisó: si pudiera, el control de tres firmas del
reglamento se vuelve una sola. El camino vive en una tabla de pasos
(`lib/travel/estados-del-viaje`), no en `if`s repartidos, y la pantalla arma
sus botones de ESA tabla — así no puede ofrecer un paso que el servidor vaya
a negar. El actor sale de los roles de la sesión, nunca del cuerpo del
request.

**El presupuesto nunca da un total único.** `totales()` devuelve una lista por
moneda y no un número, y no existe —ni se le agrega— una función que
convierta: un viaje internacional tiene los pasajes en dólares y los peajes en
colones, y sumarlos inventa un tipo de cambio que nadie autorizó (INT-3). El
anticipo se compara contra el total DE SU MISMA MONEDA: pedir $300 en un viaje
presupuestado en colones no es un anticipo chico, es un error de captura.

**Los datos personales no se piden**: cédula, puesto, comité, correo y
teléfono salen de la ficha al imprimir. El `subtotal` tampoco se guarda —es
cantidad × tarifa— para que la fila no pueda decir 60.000 mientras sus
factores dicen otra cosa.

Probado contra staging de punta a punta: crear → enviar → finanzas toma y
valida → dirección aprueba, con ₡180.000 y $340 separados y las dos firmas
registradas. Y los cinco intentos que deben fallar fallan: saltarse la
revisión (409), finanzas aprobando (409), rechazar sin motivo (409), editar
una ya enviada (409) y un anticipo en una moneda que el presupuesto no tiene
(400).

**PARÁMETROS QUE FALTA QUE FLORIANA CONFIRME** (los tres en un solo lugar,
cambiarlos es una línea):
- *Autoridad competente* = `direccion` + `admin`; *revisión financiera* =
  `finanzas` + `admin`.
- *Quién puede pedir un viaje* = cualquiera con un rol que no sea `miembro` ni
  `solo_lectura`. Es una aproximación de «staff» (minuta 2026-09-29) porque el
  sistema todavía no tiene tabla de empleados; se corrige cuando EMP-1 la
  traiga.
- *Tarifa por kilómetro*: declarada en `lib/travel/presupuesto` y hoy en 0, a
  la espera de la versión final del reglamento.
- **Decisión tomada, no descuido**: con la cadena de hoy, quien dirige puede
  aprobar su propio viaje. Hay un test que lo deja escrito; si el reglamento
  pide otra cosa, se cambia ahí.

**FASE B · LA LIQUIDACIÓN (ANX-03), hecha el mismo día.** Migración
`20261013220000`: `travel_expenses` y las columnas de anticipo recibido y
declaración jurada. El ciclo completo es
`aprobada → anticipo entregado → ya volví → liquidada → cerrada`, con la
devolución de finanzas («falta la factura del hotel») exigiendo motivo.

- **La cuenta es por moneda, también acá.** Quien recibió $200 y gastó
  ₡150.000 debe los $200 Y le deben los ₡150.000: no se compensan. Un
  anticipo que no se gastó sale en la cuenta aunque no haya tiquetes en esa
  moneda — si solo miráramos gastos, esa plata desaparecería y nadie la
  pediría de vuelta.
- **El comprobante es obligatorio**, y la excepción del reglamento (un taxi,
  un parqueo de barrio) obliga a escribir por qué no hay. Queda visible en vez
  de escondida dentro de un monto; el CHECK de la base lo exige igual.
- **La declaración jurada guarda quién y cuándo**, no un booleano. El texto
  vive en el módulo, no en el JSX.
- A `liquidada` y a `anticipo entregado` NO se llega por el botón genérico de
  mover: el primero exige la firma, el segundo exige decir CUÁNTO se entregó.
  Los dos los rechaza el servidor por esa puerta.

**TRES COSAS QUE SOLO APARECIERON PROBANDO EL FLUJO COMPLETO:**

1. **`actorDe` devolvía UN actor y «el más alto ganaba»** — así que quien
   tiene finanzas Y dirección, y cualquier admin, quedaba como autoridad a
   secas y **ya no podía tomar un expediente para revisarlo**. El expediente
   se trababa sin forma de destrabarlo. Ahora es `actoresDe`, una lista.
2. **El botón de finanzas para devolver una liquidación decía «Ya volví del
   viaje»**: el nombre del paso salía solo del destino, y a
   `liquidacion_pendiente` se llega por dos caminos opuestos.
3. El cero negativo: una liquidación que cuadra mostraba «-0».

**FASE C · LA BITÁCORA DE KILOMETRAJE (ANX-05).** Migración
`20261013230000`: `travel_mileage_legs`, más `aprobacion_jefe_path` y la
tarifa congelada. Una fila por desplazamiento con origen, destino, horas y
ODÓMETRO; los kilómetros y el monto se calculan y no hay campo donde
escribirlos. El odómetro de un tramo arranca donde terminó el anterior, que
es de donde salen las lecturas mal tecleadas.

- **Por qué odómetro y no un campo «km recorridos»**: lo pidió la minuta, y
  la razón es que dos lecturas son verificables y un número suelto no. Se ve
  si un tramo se solapa o si quedó un hueco.
- **Un hueco AVISA, que el odómetro retroceda también — ninguno de los dos
  frena.** El carro se pudo usar para otra cosa en el medio; eso lo juzga
  quien revisa. Lo que sí frena es el odómetro final menor que el inicial o
  un tramo de cero kilómetros, que no tienen lectura inocente.
- **La aprobación del jefe es REQUISITO del kilometraje** (minuta
  2026-09-29): sin ese archivo la liquidación no se manda, ni con la
  declaración jurada firmada — son dos firmas distintas, una la pone quien
  viajó y la otra quien lo autorizó. Solo se exige si hay bitácora: un viaje
  en bus no la necesita.
- **LA TARIFA SE CONGELA al enviar la liquidación.** Si no, un expediente ya
  pagado cambiaría de monto el día que el reglamento suba la tarifa, y lo que
  alguien recibió dejaría de coincidir con lo que el sistema dice que se le
  reconoció.
- **El kilometraje entra en la cuenta de la liquidación**, no se muestra al
  lado: si no, el monto se calcula, se enseña y nadie lo liquida.
- **La tarifa está en CERO a propósito** hasta que Floriana la confirme.
  Inventar «₡250, que suena razonable» haría que las primeras bitácoras se
  liquiden con una tarifa que nadie autorizó, y eso se descubre cuando ya se
  pagó. Con cero, el monto sale en cero, la pantalla lo dice y los
  kilómetros igual quedan registrados.

Probado contra staging: odómetro al revés → 400; hueco de 50 km → aviso;
enviar sin la aprobación del jefe → 400 con el mensaje del reglamento; 300 km
registrados y la tarifa guardada en el expediente.

**FASE D · EL INFORME DE VIAJE (ANX-04).** Migración `20261013240000`: los
cuatro campos del anexo en el expediente y `travel_report_files` para la
evidencia.

**NO SALIÓ DEL MÓDULO DE FORMULARIOS, que era lo que este plan sugería, y la
razón está medida**: `lib/forms/fill-access` deja CERRADO por defecto todo
formulario suelto que no tenga audiencia definida ni envío registrado
(decisión del 2026-08-06, puesta para que nadie se preinscribiera a CDEB sin
ser recomendado). Un informe de viaje es justamente un formulario suelto, así
que cada persona que volviera se habría topado con «este formulario no está
abierto para vos» y habría que convocarla a mano por cada viaje. Lo que se
perdía por el otro lado era poder editar las preguntas sin desplegar; no
compensa, y si algún día compensa, el informe se migra con los datos que ya
están guardados.

- **Actividades y resultados son obligatorios; lecciones y recomendaciones,
  no.** Exigirlas lleva a que la gente escriba «ninguna» para poder seguir, y
  un «ninguna» parece una respuesta cuando no lo es.
- **Se guarda incompleto**: el informe se escribe de a poco y perder lo ya
  escrito por exigir el resto es la forma segura de que nadie lo escriba. La
  marca de «entregado» solo se pone cuando están los dos obligatorios.
- **NO bloquea la liquidación**, como pedía el plan: la plata y el reporte son
  trámites distintos, y retener el reembolso de alguien hasta que escriba un
  texto es una sanción que el reglamento no pide. Lo que sí hace es AVISAR en
  el modal de cerrar, para que quien cierra un expediente sin informe lo vea
  ahí y no en una auditoría.
- Se escribe desde que el viaje se aprueba —la gente lo arma durante el
  viaje— y hasta que se cierra.

**Lo que apareció probando**: la pantalla escondía el informe antes de la
aprobación y **la API lo aceptaba igual**. Es la misma clase de bug que se
repitió el 2026-10-12 con los permisos de eventos; ahora la ventana
(`sePuedeInformar`) la preguntan los dos.

**EL PDF DE LOS ANEXOS**, con el patrón de SRV-14: `/viajes/<id>/hoja` arma
el expediente completo —ANX-01, 02, 03, 05 y 04, en el orden del reglamento—
con el encabezado de marca, cada anexo en su propia página y las tres rayas
para firmar a mano. `?anexo=bitacora` imprime uno solo, incluso vacío, que es
lo que a veces hace falta para el archivo físico. El PDF lo hace el navegador:
sin librería, con los tokens de marca del sistema y con el texto
seleccionable. Los datos personales (cédula, teléfono, correo) salen de la
ficha al imprimir, nunca se re-piden en el formulario.

Qué dice cada anexo vive en `lib/travel/anexos` y no en la hoja: si la hoja
armara sus propias líneas, el papel que firma la Junta y lo que se ve en
pantalla se irían separando sin que nadie lo note — y el papel es el que
queda archivado. En el papel la plata no se formatea con `Intl`: una hoja que
se archiva no puede cambiar de separador de miles según desde qué computadora
se imprimió.

**UN BUG VIEJO QUE APARECIÓ ACÁ, y es de SRV-14, no de esto.** El bloque
`@media print` traía un comentario diciendo que al imprimir «se oculta TODO
lo demás —el menú, el encabezado del sistema, los botones»… **y esa regla
nunca se escribió**. O sea que todo PDF guardado desde la hoja del aplicante
salía con la barra lateral del sistema impresa al lado. Se descubrió
preguntándole al navegador qué reglas de `print` existían de verdad en vez de
creerle al comentario. Arreglado para las dos hojas y fijado con
`src/app/impresion.test.ts`.

## Fase 25 — Reunión TI + Finanzas (2026-09-29, Meli/Andrés/María José)

Minuta en `docs/minutas/finanzas-2026-09-29.md`. Además de los ítems nuevos,
esta reunión ACTUALIZA FIN-9 y FIN-11 (ver abajo) y confirma la meta de
FIN-5/Tilopay: listo en octubre para la fiesta de Navidad (venta ~8 nov).

### [x] BEC-5 · Solicitud de becas: razones cerradas, monto, estudio puntual y cupo — HECHO 2026-10-05 (los 6 puntos)

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

### [x] PAG-5 · Un solo comprobante para varios cobros — HECHO 2026-10-13

**Se desatoró de Tilopay por decisión de Floriana**: *«podemos seguir con
PAG-5, pero que no dependa de FIN-5, que se unan con un solo comprobante»*.
El pedido viejo decía «se implementa JUNTO con FIN-5, no antes», y la pasarela
nunca hizo falta para el problema real: alguien con tres cobros pendientes hace
UNA transferencia y hoy tiene que subir el mismo comprobante tres veces — y a
la tercera FIN-6 se lo bloquea, con razón. Cuando llegue Tilopay, la selección
y la suma ya están hechas y se reusan.

En Mis pagos, con dos o más pendientes aparece «Pagué varios con una sola
transferencia»: se marcan los cobros, se ve el total, y un comprobante los
cubre a todos.

**EL CHOQUE CON FIN-6, QUE ES LO ÚNICO DELICADO DE ESTO.** FIN-6 bloquea la
misma referencia de la misma persona porque esa es exactamente la forma del
bug de Adriana y Raquel (₡5.000 transferidos una vez, contados dos). Lo que
separa los dos casos no es la referencia ni el monto: es si la persona
DECLARÓ que ese comprobante cubre varios cobros. Eso es `comprobante_grupo`
(migración `20261013200000`). El guard se consulta UNA vez y por el TOTAL; dos
cargas sueltas de la misma referencia se siguen bloqueando igual, y la
banderita de referencia repetida de la cola de finanzas ya no se enciende sola
en los tres pagos de un mismo comprobante.

**El monto no viaja desde el navegador**: se lee de los pagos y se suma en el
servidor. Mandarlo desde la pantalla sería dejar que quien paga declare cuánto
pagó.

Reglas en `lib/finance/comprobante-multiple.ts` (21 tests), y la pantalla no
repite ninguna: solo cobros `pendiente` —uno `en_revision` ya tiene
comprobante encima—, una sola moneda (INT-3), una sola persona (una familia
pagando junta sigue subiendo el comprobante en cada ficha, que es lo que FIN-6
permite a propósito) y techo de 25.

Probado contra staging con cuatro cobros sembrados: ₡15.000 + ₡10.000 + ₡5.000
quedan pagados con un solo archivo, el de $20 no se deja mezclar, reusar la
referencia da 409 y los cobros de otra persona 403. **Hueco de ambiente que
apareció probando: staging no tenía el bucket `payment-receipts`** (no tenía
ninguno) — se creó privado.

### [x] PAG-6 · Pagos cancelados: rango de fechas + export para conciliación (Andrés) — HECHO 2026-10-05. El nombre quedó decidido: «Cancelado» en finanzas, «Pagado» en Mis pagos (son dos audiencias y el mismo término significa lo contrario para cada una)

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

**EL PUNTO 1 QUEDÓ DECIDIDO (2026-10-13).** Floriana eligió: `paid` se ve
«Cancelado» y el actual `cancelado` se ve «Anulado». Solo etiquetas; la base
no cambia. La decisión ya estaba implementada en `payment-outcome.ts`
—`etiquetaDeEstado(status, audiencia)`, con la audiencia OBLIGATORIA para que
una pantalla nueva no herede en silencio la de finanzas— y el 13-oct se
completó la última pantalla que la escribía a mano (`cobros-sin-estudio`).

Y se mantiene la asimetría a propósito: en **Mis pagos** el mismo estado dice
«Pagado». En contabilidad «cancelar» es pagar, pero para la persona que mira
su propio cobro «Cancelado» suena a que se lo anularon.

**Lo que se encontró midiendo, y es el motivo real del ítem:** `paid_at` es
timestamptz y hay pagos registrados a las 00:57 UTC, o sea las 6:57 p.m. del
día anterior en Costa Rica. Para el 31 de agosto hay 41 pagos en día CR y un
filtro ingenuo habría devuelto CERO. La conversión vive en
`src/lib/finance/rango-de-pagos.ts` con tests.

### [x] DON-3 · Donaciones con montos — FUERA DE LA LISTA DE FLORIANA 2026-10-12

> **Parte B hecha el 2026-10-05** (el reporte con montos por sede).
> **La parte A es de ANDRÉS**, no de desarrollo: depende de que él prepare el
> consolidado enero-septiembre con montos y moneda. Sale de esta lista por
> decisión de Floriana (2026-10-12). El prompt se conserva abajo para cuando
> el consolidado exista; ese día vuelve a entrar como pedido.

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

**Parte B HECHA** (commit `366d958c`): `/finanzas/donaciones/reporte`, por año,
por mes y por sede, con export XLSX de las tres vistas. Gate de finanzas /
dirección / admin, y el export en `audit_log`.

**EL DATO QUE CAMBIA LA PARTE A.** Medido el 2026-10-05: las **15 276
donaciones tienen `amount = 0.00`**, no nulo. Ni una positiva. O sea que el
consolidado de Andrés no es «completar lo que falta»: es cargar TODOS los
importes, de 2014 a hoy. La parte A sigue pendiente y es más grande de lo que
el ítem suponía.

Por eso el reporte NO escribe «₡0» cuando no hay importes: en una pantalla de
finanzas eso se lee como «no entró plata». Un monto de cero cuenta como dato
sin cargar — una donación de ₡0 no es una donación.

**Lo que ya sirve hoy, con los conteos de personas que sí son reales:**
1 882 donantes únicos, 792 en 2026. Por sede: Meridiano Martes 439, Pedregal
Domingos 392, Antares 227, y **250 sin sede** —los que no aparecen por ninguna
charla, que son los que a Meli le interesan—.

### [x] FIN-9 · «Congelar matrícula» por CRÉDITOS — CERRADO 2026-10-16

**Decisión de Floriana (2026-10-16): sale de pendientes.** Lo construido está en
producción; el manejo en QuickBooks se resuelve aparte, fuera del sistema.

**Lo construido:** congelar una matrícula quita a la persona del grupo y le
emite un CRÉDITO por lo que ya pagó, usable en estudios y actividades
grandes, vigente hasta que cierre la matrícula del bloque siguiente. Solo
finanzas y dirección lo emiten, con motivo obligatorio y al audit_log. Y el
reporte de reclasificaciones por mes/año, con XLSX.

**Lo que cambió respecto a la spec:** decía «mecanismo de cupones
existente», y no alcanzaba. Se midió: los cupones de hoy son
`kind='generica'`, SIN dueño y CON código, atados a un plan concreto. El
crédito es al revés en las tres cosas, así que entró como `kind='credito'`
relajando los CHECK (no borrándolos: cada forma sigue teniendo la suya).

**Lo que FALTA, y es de Meli:** la escalera de 4 opciones está definida y
testeada como reglas, pero solo la primera —guardarlo para el bloque
siguiente— tiene acción en el sistema. Donar como beca, usar en otra
actividad y devolución se resuelven a mano por ahora. Y sigue pendiente lo
que la spec condicionaba: que Meli confirme el manejo en QuickBooks con
Luis. El reporte ya le da los datos para esa conversación.

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
### [x] FIN-12 · Adelantos de comida por sede — COMIDAS HECHO 2026-10-14; DONACIONES pendiente de Meli

Reemplaza los Excels mensuales. Migración `20261014120000`: `sede_advance_budgets`
(presupuesto por sede, lo fija finanzas), `sede_advances` (el mes de cada sede)
y `sede_advance_expenses` (las facturas, por SEMANA de charla con su encargado,
proveedor, N° de factura electrónica, monto, estado pendiente/liquidada, foto).
Pantalla `/finanzas/adelantos`, una sola para los dos lectores: el colaborador
ve su sede; finanzas ve todas, fija presupuestos, cierra meses y exporta XLSX.

**QUIÉN.** El rol `colaborador_finanzas` lo da el puesto «Colaborador Finanzas»
de cada comité de sede (regla en `position-roles`, solo en comités de sede: el
área Finanzas central no cuenta). El ALCANCE sale por el mismo camino —
volunteers → puesto → área → sede por nombre (`sede-del-area`, verificado
contra las 12 sedes activas)— así que el rol y el alcance no pueden
desalinearse. Sede ajena = 403.

**LAS DECISIONES QUE QUEDARON EN EL CÓDIGO, con sus tests:**
- Lo PENDIENTE de liquidar también resta del saldo: la plata ya está
  comprometida; un saldo que no la cuenta invita a gastar lo que ya se debe.
- El sobregiro se MARCA (rojo, «SOBREGIRO»), no se bloquea: hay que
  identificar por qué y decidir el reintegro.
- No se cierra con facturas pendientes: el saldo final decide la reposición
  y mentiría.
- El presupuesto se COPIA al abrir el mes: subirlo en noviembre no reescribe
  el saldo de octubre. Sin presupuesto fijado el mes no se abre.
- Una factura de otro mes no entra: descuadra los dos.
- Cerrar ESCRIBE el saldo final y lo hace finanzas.

Probado contra staging de punta a punta: presupuesto → abrir → facturas →
pendiente resta → factura de otro mes 400 → cerrar con pendiente 409 →
cerrar 200 → después del cierre 409; saldo final guardado.

**FALTA — la hoja DONACIONES del Excel** (cierre semanal de sede: cajitas ₡
y $, efectivo con recibo, datáfono con voucher, depósitos con referencia).
Confirmar con Meli si va en este mismo módulo como segunda sección —lo llena
la misma persona la misma noche— o aparte. No se implementó a propósito.

## Fase 26 — Reunión 2026-09-30: Mi comité y accesos a reportes

### [x] SOP-1 · Tiquetes de soporte desde el check-in + rol de soporte técnico — HECHO 2026-10-14 (staging)

Lo construido, tal cual el prompt de abajo:

 · Botón «Tiquete de soporte» en el check-in de cada evento. Lo ve quien
   entra a esa pantalla (eventos:edit) y el endpoint pregunta por el MISMO
   permiso, no por una lista aparte. Tres cosas: quién (sesión), cuándo,
   texto (mínimo 10 caracteres). Queda ligado al evento; el miembro es
   opcional y hoy no se manda (el texto lo dice).
 · /soporte: el RequestBoard de siempre (tomar / resolver / rechazar, con
   historial). La ven `soporte_tecnico` y admin.
 · Rol `soporte_tecnico`: módulos `soporte` + `miembros` (edit, no create),
   familias (FAMILY_EDIT_ROLES), correo de acceso (ACCESS_EMAIL_ROLES) y
   reenviar activación. Nada de finanzas/reportes/estudios: el censo de
   requireRoles está fijado en `src/lib/support/sop1-cableado.test.ts`.
 · Rol automático por el puesto **«Soporte Técnico» del Comité Tecnología de
   Información**. Ese puesto NO existe todavía: TI lo crea y asigna, y el
   sync hace el resto. Los tres puestos actuales de TI no lo dan.
 · Migración `20261014200000`: tablas con RLS, CHECK de member_roles, y
   `private.ve_padron()` con el rol (INF-2).

De paso: el check-in por URL directa mandaba al dashboard a quien sí podía
operar, porque decidía antes de que cargaran los permisos. Arreglado.

#### SOP-1 · prompt original (referencia, ya ejecutado)

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

### [x] EST-20 · Página pública de matrícula de Nivel 1 — HECHO 2026-10-12

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

**EST-20 · lo que se hizo (2026-10-12)**

`/matricula-nivel-1`, sin login, en `PUBLIC_PREFIXES`. Sin iframe, como se
decidió. Botón «Copiar enlace público» en la matrícula interna, solo para
admin y coordinación de estudios.

**Dos cosas que se encontraron construyéndola, y las dos habrían llegado a la
gente:**

1. **El precio decía «gratis» y no lo era.** Nivel 1 cuesta 0 en el catálogo
   porque bajo el esquema nuevo lo que se cobra es el PAR N1+N2 (₡5.000) al
   entrar. Leer `plan.cost` —lo obvio— ponía «Gratis» en TRES de los seis
   grupos abiertos, y la persona se encontraba el cobro al matricularse. El
   costo sale de `montoDelBloque`, la misma función que cobra.
2. **La página se caía entera** cuando la respuesta cacheada no traía un
   campo nuevo (pasa en cada despliegue, por el cache de 2 minutos). Lo cazó
   el navegador, no tsc: el tipo decía que el campo existe. Ahora degrada en
   vez de romperse.

**Decisiones del filtro** (en `lib/studies/grupos-publicos`, un subconjunto
del de la matrícula interna — si la pública muestra algo que adentro no se
ofrece, esa persona creó una cuenta para nada):
 · VIRTUALES y RESTRINGIDOS no se publican: dependen de quién mira y sin
   sesión no se puede saber, así que esconderlos es el lado seguro.
 · El rango de EDAD sí deja pasar el grupo, y se muestra: casi todos tienen
   rango y esconderlos dejaría la página vacía.

El nombre de la sede lo resuelve el SERVIDOR: `sedeLabel` lee una caché que
llena el provider del admin, y sin sesión esa caché está vacía — salía
«casona-pedregal» en vez de «Casona Pedregal».

**Verificado en el navegador**: los 6 grupos reales con sus nombres, precios
y cupos; y «Apartar mi campo» lleva a
`/login?redirect=/matricula?grupo=<id>`. Lo que NO se probó de punta a punta
es el tramo DESPUÉS del login —requiere credenciales reales contra
producción—; la preselección está cubierta por tests puros.

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

### [x] UX-7 · Perfil propio: el botón "Editar" falla al guardar — HECHO 2026-10-05

El miembro puede editar en sitio sus campos (nombre, teléfono, cédula…), pero
el botón "Editar" le abre el formulario completo y al guardar falla por
permisos — llena todo y pierde el trabajo. Decisión: el botón se queda solo
para roles con edición de miembros.

Prompt para Claude Code:

```
FIX UX · Perfil: el botón "Editar" solo para quien puede usarlo

PROBLEMA: en el perfil propio, el botón "Editar" abre el formulario completo pero el
guardado falla (sin permisos) — el usuario llena todo y pierde los cambios en silencio
o con error al final.

DECISIÓN (2026-10-05): NO se amplían permisos. El botón "Editar" (formulario completo)
se muestra ÚNICAMENTE a roles con edición de miembros (el gate que ya usa el guardado —
alinear la visibilidad del botón con el permiso real del endpoint, que es la regla:
ningún botón visible cuyo guardado vaya a fallar por permisos).
El miembro sin ese rol conserva la EDICIÓN EN SITIO campo por campo (que ya funciona y
ya aplica las reglas de campo-editable + resolveTargetMemberId).

ADEMÁS:
1. Verificar que la edición en sitio cubra todos los campos que el miembro SÍ debe poder
   editarse (los que el formulario le mostraba y eran legítimos — ej. teléfono, correo
   según reglas, restricción alimenticia, autorización de imagen FAM-3): si alguno
   legítimo solo era editable por el formulario, agregarlo a la edición en sitio.
2. Revisar el mismo patrón en el perfil de FAMILIARES (papás editando menores): la
   edición permitida ahí también debe ser en sitio con sus reglas (FAM-2), sin botón de
   formulario completo si el guardado no lo respalda.
3. El error actual: si por cualquier camino alguien sin permiso llega al formulario, el
   guardado debe responder claro ("No tenés permisos para editar estos campos") — nunca
   fallo silencioso.
Tests: botón oculto sin rol, visible con rol; edición en sitio intacta; endpoint 403
claro. tsc/lint/vitest.
```

### [x] FOL-2 · Folletos: fix del cambio de estado múltiple + cambio libre de estado — HECHO 2026-10-05

Prompt para Claude Code:

```
FIX + FEATURE · Tiquetes de folletos: estados

1. BUG — CAMBIO DE ESTADO MÚLTIPLE NO PERSISTE: al seleccionar varios tiquetes y
   cambiarles el estado, el sistema confirma éxito pero el cambio no se guarda (o no se
   refleja). Uno a uno SÍ funciona. Diagnosticar: ¿el endpoint batch realmente escribe
   (revisar si es el bug clásico de reportar éxito sin await/sin verificar el resultado
   por fila, o el límite de 1.000 de PostgREST, o un filtro que no matchea los ids)? ¿o
   escribe y es la pantalla que no refresca (caché/estado local)? Arreglar la causa real:
   el batch debe reportar éxito POR TIQUETE (si 3 de 5 fallaron, decirlo) y la lista
   refrescar del servidor tras la operación.

2. FEATURE — CAMBIO LIBRE DE ESTADO en el detalle del tiquete: botón "Cambiar estado"
   con selector de TODOS los estados del flujo (adelante o atrás — los errores de dedo
   existen y hay que poder devolver). Guardas:
   - Confirmación mostrando el salto ("¿Cambiar de ENVIADO a EN IMPRESIÓN?").
   - Al RETROCEDER, nota breve obligatoria (el porqué — queda con el tiquete).
   - Todo cambio al audit_log (quién, de qué a qué, cuándo, nota).
   - Mismo rol que ya gestiona folletos; sin cambios de permisos.
   - Si algún estado dispara efectos secundarios (correos, generación de algo), el
     cambio manual NO los re-dispara por defecto — censar qué efectos tiene cada
     transición y reportar cuáles son seguros de repetir.
Tests: batch persiste y reporta por fila, retroceso exige nota, audit_log, efectos
secundarios no duplicados. tsc/lint/vitest.
```

### [x] EST-25 · Cierres LEGACY sin folletos ni cobros (urgente 2026-10-05) — HECHO 2026-10-05

EST-14 hizo que los cierres 1→2 y 3→4 dejaran de generar folletos y cobros.
Correcto bajo bloques —el par ya se pagó al entrar— y destructivo para los
grupos viejos, que pagaron y recibieron nivel por nivel. Cinco cierres de
Nivel 3 del 5 de octubre dejaron a 32 estudiantes sin cobro de N4 y sin
folleto de N4.

**Lo que cambió respecto al encargo, y por qué:**

- El criterio de fecha propuesto («creado antes del 2026-10-05 = legacy»)
  marcaba como «bloques» justo a los 5 grupos de N4 que había que reparar:
  nacieron el 5 de octubre como sucesores de grupos legacy. El sucesor HEREDA
  la modalidad del origen.
- Hay **grupos mixtos**, que es lo que rompe una sola marca por grupo: el N3
  de Michelle Guier (julio) tiene 9 estudiantes viejos y 1 que se matriculó el
  5 de octubre pagando el bloque N3+N4 completo. De ahí la segunda marca,
  `study_enrollments.cubre_bloque`, que evita cobrarle dos veces y evita
  imprimirle un folleto que ya tiene. Son 9 personas en total.

Migración `20261006120000`: `study_groups.modalidad`,
`study_enrollments.cubre_bloque` y `payments.reminder_exempt_until`.
Reparación aplicada el 2026-10-05: 5 tiquetes de folletos y 32 cobros, sin
ningún aviso a los estudiantes y exentos del recordatorio automático por 14
días (plazo elegido por Claude, no por Floriana).

**Cerrado también el mismo día:**

- Mariela Saravia Valverde: su matrícula se registró dos minutos antes del
  cierre, así que entró `pendiente_de_pago` y el cierre la saltó. Floriana
  confirmó que sí cursó. Quedó `completed` en N3 y matriculada en N4, con su
  cobro partido en dos líneas de ₡5.000 (como sus compañeros) y las dos
  exentas del recordatorio. NO pagó — el cobro sigue pendiente.
- El NOMBRE del grupo sucesor heredaba el mes del origen: los correos de
  folletos decían «Julio» en octubre. `conElMesDelInicio` lo corrige y se
  aplicó a los 30 grupos activos desalineados. Los finalizados no se tocan.
  Nombres viejos en `out/rollback-nombres-grupos-2026-10-05.sql`.
- La modalidad se puede **corregir a mano** desde la pantalla del grupo (solo
  N1-N4, solo quien administra grupos, con audit_log). La marca salió de un
  backfill y no hay backfill que acierte siempre.
- Prueba sembrada en staging con `scripts/est14-legacy-2026-10/sembrar-prueba-staging.ts`
  (N1 y N3, legacy y bloques, con dirigente) y su `--verificar`.

**Queda pendiente:** avisarles a los 5 dirigentes que sus estudiantes tienen
cobros nuevos. La exención del recordatorio vence el 2026-10-19.


### [x] CHK-1 · El check-in avisa si la persona ya está en otra sede hoy — HECHO 2026-10-05

Salió del análisis de Meridiano Miércoles: el 9 de setiembre tres personas
quedaron registradas en Pedregal Miércoles y, cuatro minutos después, en
Meridiano Miércoles. Quien registraba tenía la charla equivocada
seleccionada; nadie se enteró hasta que alguien barrió los datos un mes
después.

AVISA, no bloquea: hay casos legítimos (servir en una sede y asistir en
otra) y bloquear obligaría a pedir permiso con la fila esperando. El aviso
dice la sede y la hora, que es lo que deja decidir en la puerta.

Solo entre charlas; el «Youth» de la misma sede no dispara el aviso; el día
se mide en hora de Costa Rica.

### [x] EST-26 · Ver quién ofreció su casa — CERRADO 2026-10-12

(Se pidió como «EST-22» el 2026-10-06; se renumeró porque ese código ya lo
usaba el teléfono del dirigente en el export, cerrado el 2026-09-30.)

Prompt para Claude Code:

```
FEATURE · Estudios: exponer las respuestas de la inscripción al equipo de estudios

PREGUNTA OPERATIVA: cuando alguien se inscribe a un estudio y responde si OFRECE SU CASA
(u otras preguntas de la inscripción), ¿dónde lo ve el encargado de grupos/estudios?

ETAPA 1 — DIAGNÓSTICO: ¿dónde se guarda hoy esa respuesta? (¿pregunta del flujo de
matrícula? ¿formulario vinculado? ¿campo de la matrícula?) ¿Se está guardando del todo?
Reportar el dato real antes de construir.

ETAPA 2 — EXPONERLO donde se trabaja:
1. En el DETALLE DEL GRUPO (vista de gestión): columna/indicador "Ofrece casa" en la
   lista de matriculados (🏠 o sí/—), visible para coordinador_estudios y los roles de
   gestión — NO para el estudiante ni en la lista del dirigente salvo que Floriana diga
   lo contrario (el dirigente podría necesitarlo para elegir sede del grupo: preguntar).
2. Las DEMÁS respuestas de la inscripción (si hay más preguntas): visibles al abrir el
   detalle de la matrícula de la persona en ese grupo.
3. En el padrón/filtros: condición "ofreció casa" si el dato lo permite (reutilizar el
   sistema de condiciones — serviría para planificar zonas).
4. Export de la lista del grupo incluye la columna.
Tests: columna visible para gestión, no para estudiante; dato correcto. tsc/lint/vitest.
```

**MAT-3 · lo medido y lo que se hizo (2026-10-12)**

**El autoservicio ya estaba blindado.** El modal del comprobante no se deja
cerrar: sin botón de «después», sin Esc, sin fondo. Lo que fallaba era el
RESCATE de quien cierra la pestaña.

Medido un mes después de poner el aviso in-app: **de 11 avisos se leyó 1
(9%)**, y de las 11 personas avisadas **6 igual perdieron el cupo**. Bajas por
falta de comprobante: 4 en setiembre, 5 en octubre. El motivo es estructural y
no se arregla con más campanitas — quien necesita el aviso es justo quien ya
cerró el sistema y se fue. Mariel González (8528 6619) perdió el campo DOS
veces, el 16-set y el 4-oct, con las dos campanitas sin leer.

(Se corrigió de paso una medición previa equivocada: no había 137 matrículas
pendientes con 127 vencidas sin barrer. Hay 4, todas en plazo. El barrido
funciona.)

**Etapa 2 — hecho:** el aviso sale por CORREO además de la campanita, y pasó de
las 48 horas a las 24 (la salida sigue en 72, así que quedan 48 para
reaccionar). Coordinación de estudios recibe un resumen diario de quién está
por vencer. El modal avisa en coral el estado real al intentar salir, y cerrar
la pestaña pregunta. El plazo del texto sale de `HORAS_DE_GRACIA`, con un test
que falla si alguien lo vuelve a escribir a mano.

**Etapa 3 — la causa era otra.** El caso de Guido Chavarría no fue un lote
manual a medias. Reconstruido del audit_log: dos personas pagaron, las
trasladaron al grupo nuevo, y ocho segundos después alguien borró el grupo
viejo. `deleteGroup` borraba TODAS las inscripciones y el guard solo miraba los
estados activos, así que las filas `transferred` se fueron con el grupo — y
como las FK de `payments` son ON DELETE SET NULL, los cobros quedaron sin
matrícula y sin grupo. El monto nunca se calculó distinto: **se desconectó**.

Ahora el borrado mira el dinero (cobros sin cancelar) y el historial
(transferidas o completadas), y devuelve 409 con el motivo y qué hacer.

**Cobros huérfanos: 9 encontrados**, y aparecieron solo porque alguien los fue
a buscar. 2 reconectados; 4 pagados ya tenían su crédito del congelamiento;
Irene Arias no lo tenía y se le emitió (₡15.000, vence 2027-01-22); 2
anulados. Queda **uno de ₡17.500 sin `member_id`** — sin dueño, pendiente de
que Floriana diga de quién es.

Se agregó **Finanzas → Cobros sin estudio** y un aviso por campanita, que suena
solo por lo que pide acción: ni los anulados ni los ya resueltos con crédito.

### [x] EST-27 · Excepciones de niveles sin fecha de vencimiento — HECHO 2026-10-06

(Se pidió como «EST-23»; se renumeró porque ese código ya lo usaba el cierre
de N2 con sus dos semanas, cerrado el 2026-10-02.)

Las excepciones de matrícula de niveles (ej. repetir Nivel 1) se están creando
amarradas al calendario de bloques — incorrecto: los niveles NO siguen los 3
bloques anuales (eso es de capacitaciones).

Prompt para Claude Code:

```
CAMBIO DE REGLA · Excepciones de matrícula de NIVELES: sin vencimiento

REGLA NUEVA: una excepción de inscripción para estudios tipo NIVELES no tiene fecha
límite. Vive desde que se crea hasta que (a) SE USA — un solo uso: al matricularse con
ella queda consumida — o (b) alguien la quita manualmente.
Las excepciones de CAPACITACIONES u otros estudios por bloque quedan como están
(amarradas a su bloque) — la regla nueva es solo para niveles; bifurcar por tipo de plan,
no parejo.

1. Cambiar la creación: para niveles no se pide/asigna fecha de vencimiento (ni se
   calcula del bloque).
2. El cron/validación que expira excepciones debe IGNORAR las de niveles.
3. MIGRAR las excepciones de niveles existentes: quitarles el vencimiento que les puso
   el calendario de bloques (dry-run con la lista — cuántas estaban por vencer o YA
   vencieron sin usarse: esas últimas probablemente hay que revivirlas, confirmar con
   Floriana la lista).
4. Consumo: verificar que al usarse quede marcada como consumida (un uso) — si hoy no es
   así, implementarlo para niveles.
Tests: nivel sin vencimiento, capacitación con vencimiento intacto, consumo de un uso,
el cron no las toca, migración idempotente. tsc/lint/vitest.
```


**EST-26 · lo medido y lo que quedó (2026-10-06)**

El dato SÍ se guarda: la pregunta «¿Podrías ofrecer tu casa u oficina para el
estudio?» vive en el formulario «Matrícula a Nivel 1 — preguntas iniciales»,
con un campo «Ubicación» al lado. 30 respuestas, 5 que sí (4 personas:
Catalina Pagés contestó dos veces). Nadie lo veía en ninguna pantalla.

Es de la PERSONA, no de la matrícula: `form_responses` guarda `member_id` y
nada más. Se pregunta una vez al entrar, así que el cruce es por persona.

HECHO: columna «Ofrece casa» con la ubicación en el detalle del grupo, solo
para gestión — ni el dirigente ni el estudiante, y el dato NO VIAJA en el
JSON para ellos (decisión de Floriana).

- **Las demás respuestas al abrir la matrícula**: ya se ven todas en
  `/formularios/[id]/respuestas`. Se dejó así en vez de duplicar la pantalla.

**EST-26 · lo que faltaba, cerrado el 2026-10-12**

- **Filtro en el padrón (punto 3): YA FUNCIONABA, no hizo falta código.** La
  nota de arriba estaba equivocada: el sistema de condiciones SÍ lee
  formularios, con una condición de tipo `form`. Corrido contra producción
  devuelve las 6 personas exactas que contestaron que sí.
- **Export (punto 4): HECHO.** El export de participantes existía desde
  entonces; se le agregaron «Ofrece casa» y «Dónde ofrece» al final, solo
  para estudiantes y solo para los que dijeron que sí (en blanco los demás:
  la columna se filtra en Excel). La ruta usa `GROUP_ADMIN_ROLES`, así que
  sigue siendo de gestión y el dirigente no lo ve.
- De paso salió un bug que hacía la columna inútil: el `.in()` con los 831
  miembros del roster daba 400 por el largo de la URL, el error no se
  miraba, y salía vacía para todos. Ahora va en lotes de 100 y revienta si
  falla. Guard en `src/lib/supabase/queries/in-por-lotes.test.ts`.

**EST-27 · lo que estaba roto (2026-10-06)**

No hay cron: la vigencia se evalúa al leer, con `excepcionVigente`, y la daba
el `bloque_id`. TRES excepciones de Nivel 1 estaban MUERTAS sin que nadie lo
supiera, porque el «Bloque 3 2026» cerró matrícula el 13 de setiembre:

- Jose Fabio Quesada Matamoros — «tiene 29 años, puede matricular los de 30»
- Kenneth Campos Araya — repetir, decisión del dirigente
- Kristal Monge Segura — repetir, no había grupo al cual reubicarla

Las tres decían `active` y la elegibilidad las descartaba en silencio. La
migración les quita el bloque y las revive. Las de capacitaciones no se
tocan: ahí el bloque sí es la unidad real.

## Fase 27 — Pedidos del 2026-10-12

### [x] UX-8 · Ícono del acceso directo en el celular muy oscuro — HECHO 2026-10-12

Prompt para Claude Code:

```
FIX · PWA/favicon: el ícono de "agregar a inicio" sale fondo negro con la theta azul

Al crear un acceso directo en el celular, el ícono queda oscuro (fondo negro, círculo
theta azul) — debe verse con la identidad correcta (theta sobre fondo claro o navy de
marca, legible en home screen claro y oscuro).
1. Revisar qué se está sirviendo: manifest (icons 192/512, maskable), apple-touch-icon,
   favicon — ¿cuál está tomando el teléfono y de dónde sale el fondo negro? (un PNG con
   transparencia que Android rellena de negro es la causa clásica: los maskable deben
   llevar fondo sólido y margen de seguridad).
2. Generar el set correcto (192, 512, maskable con safe zone, apple-touch-icon 180) con
   los colores de marca (navy #161440 de fondo + theta en blanco/coral, o fondo claro —
   proponer las dos y que Floriana elija con un preview).
3. Verificar theme_color/background_color del manifest.
Probar en Android e iOS (agregar a inicio en ambos). tsc/lint.
```

**UX-8 · la causa y lo que se hizo (2026-10-12)**

**No era el diseño: era el CANAL ALFA.** Los PNG eran transparentes, y
Android rellena la transparencia de negro al generar el acceso directo —
theta navy sobre negro, o sea invisible. Es la causa clásica que el propio
prompt sospechaba, confirmada mirando los archivos (`hasAlpha: yes` en los
tres).

Y **no había manifest**, así que tampoco había íconos `maskable` ni
`theme_color`: el teléfono recortaba el que encontrara.

Qué hay ahora: set completo (192, 512, los dos maskable, apple-touch 180)
con **fondo navy sólido y sin alfa**, generado con la theta OFICIAL del
design system (`assets/icon-theta.svg`) y no redibujada a ojo. Los maskable
llevan la theta al 52% del lienzo: Android recorta hasta un 20% de cada
borde y uno a tamaño normal sale mordido. Manifest con `theme_color` y
`background_color` en navy, para que el arranque no destelle en blanco.

**Floriana eligió** fondo navy con theta blanca, viendo las dos opciones
renderizadas (incluido el recorte circular real).

**Lo que casi queda inservible:** el proxy mandaba `/manifest.webmanifest`
al login con un 307, así que el teléfono no lo leía NUNCA y todo el arreglo
del manifest no habría servido de nada. Se vio probándolo en el navegador;
ningún test de datos lo habría mostrado. Está en `PUBLIC_PREFIXES` y hay un
guard que lo vigila.

**Falta probarlo en un teléfono de verdad** (Android e iOS, «agregar a
inicio»). Eso no se puede hacer desde acá.

### [x] REP-15 · Crecimiento/asistencia: los números de la semana no cuadran — CERRADO 2026-10-12

Caso: semana 40 de 2026 — arriba dice 872 asistentes y 27 servidores de total
de check-ins; la sección de abajo dice 875 check-ins y 839 asistentes.

Prompt para Claude Code:

```
FIX · Reporte de crecimiento/asistencia: dos secciones, dos números distintos

Reproducir: 2026, semana 40 → sección superior: 872 asistentes + 27 servidores; sección
inferior: 875 check-ins / 839 asistentes. 872+27=899 ≠ 875; 839 ≠ 872. MISMA semana,
números incompatibles entre sí.
1. Documentar qué cuenta exactamente cada sección (¿check-ins vs personas únicas?
   ¿asistente/servidor con checked_in_as? ¿series unificadas REP-13 en una y no en otra?
   ¿una excluye [prueba] y la otra no? ¿snapshot viejo vs consulta viva?) y encontrar la
   diferencia CON FILAS, no con hipótesis (las ~3 y ~33 de diferencia tienen nombres).
2. Arreglo: TODAS las secciones del reporte salen de la misma definición/consulta base
   (el principio de EST-19/REP-7: si dos números de la misma pantalla pueden divergir,
   es bug por construcción). Etiquetar claro qué es check-ins y qué es personas únicas.
Test que compara ambas secciones contra los mismos fixtures. tsc/lint/vitest.
```

### [x] REP-16 · Reporte de estudios: estudiantes no cuadran — CERRADO 2026-10-12

Prompt para Claude Code:

```
FIX · Reporte de estudios (REP-9): tres números de estudiantes distintos en 2026

Reproducir: año 2026 → KPI dice 1.190 estudiantes; la SUMATORIA de la tabla por tipo da
1.822; el gráfico dice 1.896. Deberían reconciliar: el KPI es personas ÚNICAS
(des-duplicadas) y la tabla por tipo puede sumar más (una persona en 2 estudios cuenta
en cada tipo) — ESO es legítimo y el tooltip lo explica, PERO entonces tabla (1.822) y
gráfico (1.896) deberían ser iguales entre sí y no lo son: ahí hay bug seguro.
1. Documentar la definición de cada uno de los tres números y encontrar las diferencias
   con filas (74 entre tabla y gráfico; verificar si 1.190 vs 1.822 es solo
   des-duplicación legítima o también hay fuga — medirlo, no asumirlo). Sospechosos:
   límite de 1.000 de PostgREST (ya mordió 3 veces), estados contados distinto
   (canceladas, en matrícula), [prueba], grupos que cruzan año.
2. Unificar: tabla y gráfico de la MISMA consulta; KPI de personas únicas derivado de
   esa misma base; etiquetas que digan "inscripciones" vs "personas" donde corresponda.
Test de reconciliación (suma por tipo = gráfico; únicas ≤ inscripciones) con fixtures.
tsc/lint/vitest.
```

**REP-15 y REP-16 · lo medido (2026-10-12)**

Los dos se reportaron como «los números no cuadran». **En REP-15 no cuadraba
ningún dato: cuadraban mal las palabras. En REP-16 sí había un bug, pero no
donde la sospecha lo ponía.**

**REP-15 — semana 40 de 2026, reproducido exacto:**

| | |
|---|---|
| 899 | CHECK-INS (872 como asistente + 27 como servidor) |
| 875 | PERSONAS distintas los hicieron (24 vinieron dos veces) |
| 839 | de esas personas ya habían venido antes; 36 eran primera vez |

Las dos consultas miran el mismo universo (`event_type = 'charla'`) y la misma
ventana. No había fuga, ni tope de 1.000, ni snapshot viejo. Lo que fallaba:
abajo se llamaba «875 check-ins» a lo que son personas, arriba «872
participantes» a lo que son check-ins, y «asistente» significaba dos cosas en
la misma pantalla (arriba: vino a recibir y no a servir; abajo: ya vino más de
una vez). Arreglado con etiquetas por unidad, más una frase en pantalla que
reconcilia las dos secciones. El guard vigila el fuente, porque es un
invariante de redacción que ningún test de datos habría atrapado.

**REP-16 — 2026: KPI 1.191 · tabla 1.823 · gráfico 1.897.**

KPI y tabla siempre estuvieron bien: son personas contra persona × tipo, y es
intencional. El gráfico estaba mal por dos cosas, las dos en una sola línea
del RPC `report_estudios_series`:

1. Contaba el año en que el grupo ARRANCÓ, no los años en que estuvo en curso
   — la definición que `lib/reports/estudios.ts` documenta como la incorrecta
   desde que se escribió el reporte. La tabla la respetaba; la serie se quedó
   con la vieja.
2. Peor: con `starts_at` nulo caía a `created_at`, que en los grupos
   importados es la fecha del IMPORT (18-jul-2026). Grupos TRANSFORMADOS
   **cerrados en 2015** estaban contados como estudiantes de 2026 — de ahí
   TRANS (30), UFA (11), PLANDANIEL (9) y EVA (6).

La migración `20261012210000` le da a la serie los mismos dos extremos y el
mismo universo que la tabla. Verificado contra producción: calzan exacto en
2022, 2023, 2024, 2025 y 2026 (1.823 en el año en curso, antes 1.897).

**Queda para revisar con Denise:** los grupos históricos sin `starts_at` cuyo
cierre es anterior a su `created_at` no aparecen en NINGÚN año de la serie.
Es lo que la tabla ya hacía con ellos y es lo honesto —su fecha es
inconsistente—, pero si se quiere verlos hay que ponerles la fecha real.

### [x] MAT-3 · Matrículas a medias: gente queda sin comprobante sin darse cuenta — CERRADO 2026-10-12

Casos reales: la persona del teléfono 8816 2358 (estudios de Cartago) dejó la
matrícula sin comprobante; y en el estudio de Guido Chavarría la encargada
matriculó a las personas y 3 quedaron por fuera, con el cobro distinto al resto.

Prompt para Claude Code:

```
FIX UX + DIAGNÓSTICO · La matrícula se está quedando a medias (sin comprobante)

La desmatrícula a las 48h existe como red de seguridad, pero está atrapando gente a
diario — señal de que el flujo deja creer que ya terminaron. NO debería pasar casi nunca.

ETAPA 1 — DIAGNÓSTICO con los casos reales:
1. Caso 1: miembro con teléfono 8816 2358, matrícula a estudios de Cartago — reconstruir
   con audit_log qué pasó: ¿hasta dónde llegó? ¿cerró el modal antes del comprobante?
   ¿hubo error de subida silencioso?
2. Caso 2: estudio de Guido Chavarría — la encargada matriculó manualmente y 3 personas
   quedaron fuera con el cobro DISTINTO al resto: reconstruir cómo se crearon esos 3
   (¿otro camino de inscripción? ¿falló a medias el lote? ¿por qué el monto difiere?).
3. MEDIR el problema: cuántas matrículas quedaron sin comprobante y fueron desmatriculadas
   por el cron en los últimos 30 días, y por cuál camino entraron (autoservicio vs
   manual) — para saber el tamaño del hueco y dónde está.

ETAPA 2 — CERRAR EL GAP DE UX (autoservicio):
1. El modal de matrícula NO debe poder sentirse "terminado" sin el comprobante: al
   intentar cerrar con matrícula creada y comprobante pendiente, interceptar con un aviso
   claro: "Tu matrícula NO está completa: falta adjuntar el comprobante. Si no lo subís
   antes de 48 horas, perdés el campo" con botones "Subir comprobante ahora" / "Lo subo
   después (entiendo el plazo)".
2. Si sale igual: banner persistente en su perfil/Mis pagos ("Te falta el comprobante de
   X — te quedan N horas") + la notificación de campanita existente (NOT-2) verificada.
3. En la pantalla de ÉXITO de la matrícula, el mensaje principal debe decir el estado
   real: "Matriculado — PENDIENTE DE PAGO" (no un check verde genérico).
ETAPA 3 — el camino MANUAL (encargada): revisar el flujo de matrícula por staff — ¿deja
estudiantes a medias si algo falla en el lote? Debe ser transaccional por persona y
reportar por fila ("5 matriculados, 3 fallaron: …"), nunca éxito parcial silencioso (el
patrón del bug FOL-2). El cobro generado debe ser consistente para todo el lote.
Tests: intercepto al cerrar, banner, lote manual reporta por fila, montos consistentes.
tsc/lint/vitest.
```

### [x] EST-28 · Esquema viejo/nuevo visible en folletos, grupos y matrículas — HECHO 2026-10-12

Durante la transición de EST-14/EST-25 conviven los dos esquemas y hoy no se
distinguen a simple vista — hay que operar sabiendo cuál es cuál.

Prompt para Claude Code:

```
MEJORA · Transición de bloques: mostrar el esquema (viejo/nuevo) donde se opera

BASE: la marca legacy/bloques por grupo ya existe (la creó EST-25). Esto es EXPONERLA:

1. TIQUETES DE FOLLETOS: el título/detalle del tiquete debe decir qué folletos lleva
   según el esquema del grupo — esquema viejo: "Nivel 1" (solo el nivel); esquema nuevo:
   "Nivel 1 y 2" o "Nivel 3 y 4" (el par). Además una columna/campo "Esquema:
   viejo/nuevo" en la lista de tiquetes y dentro del tiquete.
2. LISTA DE GRUPOS: columna nueva "Esquema" (valores: "viejo"/"nuevo") — VISIBLE POR
   DEFAULT por ahora (se ordena después de estudio, dirigente, teléfono), en el selector
   de columnas para poder ocultarla, y pensada para retirarse cuando la transición
   termine (dejar comentario de que es temporal). Filtrable si el patrón de la tabla ya
   lo da gratis.
3. MATRÍCULAS/SOLICITUDES de estudio: donde se muestra el detalle de una matrícula o
   solicitud, indicar el esquema del grupo al que pertenece (una línea/badge — ayuda a
   soporte y finanzas a entender por qué un cobro es de ₡5.000 en par o del nivel solo).
4. Export de la lista de grupos incluye la columna.
Todo es LECTURA de la marca existente — este ítem no cambia ninguna regla de negocio.
Tests: tiquete legacy dice solo el nivel, tiquete bloques dice el par; columna presente
y exportada. tsc/lint/vitest.
```

**EST-28 · lo que se hizo (2026-10-12)**

Todo es LECTURA de `study_groups.modalidad`, que ya existía. Ninguna regla
cambió: quién cobra qué y qué folletos van lo siguen decidiendo
`nivelesACobrar` y `folletosQuePide`.

1. **Lista de grupos:** columna «Esquema» (viejo/nuevo), visible por default,
   en el selector para poder esconderla. El tooltip dice la consecuencia, no
   el nombre interno: «se cobra y se entrega el PAR al entrar».
2. **Export:** sale gratis con el `exportValue` de la columna.
3. **Tiquete de folletos:** badge del esquema, y cuando el grupo lleva el par,
   una línea que lo dice y avisa que por eso hay DOS tiquetes del mismo grupo.
   **Se apartó del pedido en un punto:** el tiquete sigue diciendo su propio
   nivel en el conteo, no «Nivel 1 y 2». Cada tiquete es de un nivel y hay dos;
   poner el par en el conteo de cada uno haría imprimir el doble.
4. **Expediente de la persona:** marca «esquema nuevo» solo en los estudios
   CON COSTO, que es donde sirve para entender el cobro. En todas las filas
   sería ruido.

Es temporal a propósito y está escrito en el módulo: el día que
`select count(*) from study_groups where modalidad = 'legacy' and status in
('en_curso','en_matricula')` dé 0, se quita `lib/studies/esquema-visible` y
todo lo que cuelga de él.

## Fase 28 — Estados y reporte de dirigentes (reunión Fabiola 2026-10-12)

Transcript y diagramas de la reunión. Dos diagramas de referencia: el "azulito"
de Fabiola (el real) y la infografía generada con IA (el look deseado del
reporte). Fabiola queda de pasar: su Excel actualizado de dirigentes (el de
Nao + sus updates, con notas) y la lista de comunidades.

### [x] DIR-8 · Taxonomía de estados del dirigente — COMPLETO 2026-10-13

Modelo, permisos de notas, ficha administrativa, badge, filtros, «mi
comunidad» (catálogo = sedes activas, por decisión de Floriana) y el check de
WhatsApp. La formación quedó separada en capacitaciones y campañas.

**EL BUG QUE APARECIÓ CERRÁNDOLO, y es el que conviene recordar:** la ficha
administrativa NO ESTABA GUARDANDO NADA desde el 12-oct. El endpoint buscaba
la fila con `.eq('id', …)` y recibe un `member_id`: los dos son UUID válidos
y distintos, así que el update no encontraba fila, no daba error y devolvía
200 OK. Un día entero diciendo «guardado» sin guardar. Se descubrió al
agregar el check de WhatsApp y ver que tampoco persistía. El guard tiene dos
mitades: la clave correcta, y un 404 cuando no toca ninguna fila — para que
la próxima variante del mismo error sea ruidosa y no silenciosa.

Prompt para Claude Code:

```
REDISEÑO · Estados del dirigente (diagrama acordado con Fabiola 2026-10-12)

ESTRUCTURA DE ESTADOS (reemplaza el set actual activo/inactivo/pausa/revisión/dando):

1. ESTADO BASE: Activo / Inactivo (la regla automática de PAR-2 se mantiene: dirigir un
   grupo activa; +12 meses sin dirigir desactiva — el "en curso" sigue automático).

2. INACTIVO lleva SUB-RAZÓN (manual, la pone coordinación):
   a) "No asiste a Theos".
   b) "Asiste pero no ejerce el servicio", con detalle: «No aprobó CDEB» (y dentro:
      definitivo / en seguimiento-proceso: cursos, oración, mejorar testimonio) o
      «Por decisión propia».

3. ACTIVO se divide en Disponible / No disponible. NO DISPONIBLE lleva razón:
   a) Dirigiendo un estudio (AUTOMÁTICA al asignarlo a un grupo en curso — EXCEPTO
      prematrimonial: dar prematrimonial NO cambia la disponibilidad; default
      automático, corregible a mano para los casos tipo doña Hilda que dan varios).
   b) Estudiante en una capacitación.
   c) En formación para dar una capacitación.
   d) En pasantía (dirigentes nuevos, regresando, o codirigente de apoyo).
   e) En pausa — SIEMPRE con fecha de regreso y justificación (nota ligada a la pausa).

4. "EN REVISIÓN" DEJA DE SER ESTADO → pasa a ser BANDERITA (flag) que coexiste con
   cualquier estado. Razones de la banderita: testimonio / compromiso (charlas, donación,
   servicio) / preparación (malas retroalimentaciones) / no confirmó sus datos.
   La banderita NO es automática y NO la ve el dirigente — solo la vista administrativa.

DÓNDE SE VE QUÉ:
- PERFIL DEL MIEMBRO (resumen superior): el badge "Dirigente" aparece SIEMPRE para quien
  es dirigente — APAGADO/gris si está inactivo, con tooltip "Dirigente inactivo" (hoy
  desaparece y confunde: arriba dice dirigente y abajo no sale nada). Solo
  activo/inactivo, SIN banderita (ese resumen lo ven más roles).
- La sección del tab del miembro se renombra a "Disponibilidad del dirigente" (no es el
  estado).
- FICHA ADMINISTRATIVA DEL DIRIGENTE (la de estrellita): el detalle completo — estado,
  sub-razón, razón de no disponibilidad, banderita con su razón, notas. Editable por
  coordinador_dirigentes con los selectores anidados (elijo Inactivo → me abre las
  sub-razones).

NOTAS (confidenciales):
- Dos tipos: la nota LIGADA A LA PAUSA (fecha + justificación) y una NOTA GENERAL del
  dirigente (texto libre, casos sensibles).
- Acceso: EDITA solo coordinador_dirigentes (Fabiola); LECTURA además para Luis y Yeya
  (rol lector — crear la variante de solo lectura si no existe). NADIE MÁS: ni
  editor_dirigentes (Andrés/Diego/Wilber actualizan datos pero NO ven notas), ni Ari por
  ahora (decisión explícita: exclusivo, se amplía después si hace falta). El dirigente
  JAMÁS ve sus notas.

FORMACIÓN — SEPARAR EN DOS RUBROS: "Capacitaciones" y "Campañas" (la precampaña llevada
habilita dar la campaña). En las búsquedas/filtros de formación salen separadas para no
ensuciar las búsquedas de estudios de Ari. (Las campañas como tipo de plan es CAM-1 —
aquí solo la formación del dirigente.)

COMUNIDAD DEL DIRIGENTE (campo nuevo): multiselect de sedes/charlas a las que SIENTE que
pertenece (United, Home, el este… — puede ser distinta de donde asiste y de las zonas
donde puede dar; es para invitaciones dirigidas: talleres, get-togethers, koinonías).
Fabiola pasa la lista de comunidades. Editable por el dirigente en su tab y por
coordinación.

EXTRAS:
- Check manual "está en el grupo de WhatsApp" en la ficha del dirigente.
- QUITAR del formulario de disponibilidad (SRV-9) la pregunta "dónde recibir folletos" —
  eso pertenece al flujo de creación del grupo, no a la disponibilidad (evitar el dato
  duplicado/basura).
- IMPORT MASIVO: script para actualizar estados/sub-razones/notas desde el Excel de
  Fabiola (ella lo pasa). REGLA: el sistema gana sobre el Excel en lo automático — si el
  Excel dice inactivo pero la persona tiene grupo EN CURSO, se ignora esa fila y se
  reporta; dry-run con lista antes de aplicar; las columnas de WhatsApp/notas entran;
  evaluar columnas extra del Excel (orador, koinonías) y reportar si se mapean a algo
  existente o se dejan fuera.
Tests: transiciones automáticas (asignar grupo → no disponible/dirigiendo salvo
prematrimonial), anidación de sub-razones, banderita coexiste, notas 403 para
editor_dirigentes, lector lee y no escribe, badge apagado. tsc/lint/vitest.
```

**DIR-8 · etapa 1 de varias: el MODELO (2026-10-12)**

Hecho: la taxonomía completa en `lib/leaders/estado-del-dirigente` (puro, 25
tests) y la migración con los CHECK que la hacen cumplir en la base, más un
guard que falla si las dos listas divergen — son la misma lista escrita en
dos lugares, que es la forma de bug más repetida de este repo.

**Dos precisiones del diagrama actualizado, confirmadas por Floriana:**
 · La banderita «no confirmó datos» es **manual**, como las otras tres,
   aunque el diagrama la pinte distinta.
 · Las notas opcionales van **solo en los cinco lugares con flecha roja**
   (revisión, CDEB definitivo, CDEB seguimiento, decisión propia, pausa), no
   en todos los estados. La de la pausa es la única obligatoria, junto con la
   fecha de regreso: una pausa sin fecha es una baja que nadie se anima a
   declarar.

**La conversión de los 505**, verificada contra producción con un SELECT
antes de tocar nada: 209 available → activo/disponible · 294 inactive →
inactivo SIN razón (nadie la registró nunca; inventarla sería peor) · 1
resting → activo/no disponible/pausa · 1 en_revision → activo/**disponible**
+ banderita, que es exactamente el caso que el rediseño arregla: esa persona
estaba disponible y el estado viejo lo escondía.

**Quedan 294 inactivos sin razón** para que coordinación llene, o que lleguen
en el Excel de Fabiola.

**Hecho también (etapas 2 a 4):** la ficha administrativa con los selectores
anidados, las notas confidenciales con sus permisos y el rol nuevo
`lector_dirigentes`, el indicador apagado en el perfil, el título
«Disponibilidad del dirigente» en el tab, y fuera la pregunta de dónde
recibir folletos.

**Lo que falta de DIR-8:** separar capacitaciones de campañas en la
formación, y el check manual de «está en el grupo de WhatsApp» (la columna
ya existe).

**Bloqueado hasta que Fabiola pase sus archivos:** el import masivo (su Excel)
y el catálogo de comunidades (su lista). El campo ya existe, vacío.

### [x] DIR-9 · Reporte de dirigentes rediseñado — HECHO 2026-10-13

**Lo que se entregó:** la jerarquía del diagrama (total → inactivos/activos →
desgloses) con cada número clicable, campañas separadas de la formación, el
cruce sede × formación y el export en xlsx. Los permisos suman
`lector_dirigentes` (Luis y Yeya ya ven la ficha de cada dirigente); la
banderita se decide en el servidor y viaja `null` —no cero— para quien no
puede verla.

**EL HALLAZGO, y no estaba donde parecía.** 109 dirigentes tenían un grupo
en curso o en matrícula y 106 figuraban `disponibilidad = 'disponible'`. El
reporte VIEJO no arrastraba el error porque nunca leyó ese campo: deriva
«dando ahora» de los grupos. El campo roto era el de DIR-8, que alimenta la
FICHA. Se arregló derivándolo en los dos lados con la misma función
(`esta-dirigiendo.ts`), en vez de correr un UPDATE que se desincroniza el
día que alguien cierre un grupo.

**Decisiones que vale la pena no reabrir:**
 · El cero del cruce se MARCA. Esa tabla se abre para encontrar huecos.
 · Las columnas del cruce van por cobertura, no alfabéticas: con el orden
   del catálogo abría como un muro de ceros y los números quedaban fuera de
   pantalla.
 · UN solo export, no uno por celda. Quince archivos no se pueden cruzar
   entre sí; uno con las columnas que definen cada celda sí.
 · El export NO lleva notas ni banderita, ni para quien puede verlas: un
   archivo se reenvía sin pensarlo.

**Lo que quedó sin tocar:** el campo viejo `availability_status` sigue
alimentando el listado de `/estudios/dirigentes`. No se migró porque ahí
acierta (deriva de los grupos), pero son dos taxonomías vivas para lo mismo.

#### DIR-9 · prompt original (referencia, ya ejecutado)

El reporte viejo de dirigentes del plan piloto está abandonado. Se rediseña
con la jerarquía de la infografía (total → inactivo/activo → desgloses) y los
números reales de DIR-8.

Prompt para Claude Code:

```
FEATURE · /reportes/dirigentes: rediseño completo (correr DESPUÉS de DIR-8)

ESTRUCTURA (la jerarquía de la infografía de Fabiola):
1. Total de dirigentes.
2. INACTIVOS (conteo y %): desglose "asiste pero no ejerce" vs "no asiste a Theos".
3. ACTIVOS (conteo y %): desglose Disponible vs No disponible, y dentro de No disponible
   las 5 razones (dirigiendo un estudio / estudiante en capacitación / en formación /
   en pasantía / en pausa) con conteo y % cada una.
4. Nota visible: "en cualquier estado puede haber banderita de revisión" + conteo de
   banderitas (solo para quien puede verlas).
5. CADA NÚMERO ES CLICABLE → lista de las personas que lo componen (el patrón drill-down
   de los reportes).
6. CAPACITADOS POR ESTUDIO (formación): conteo por estudio, clic → lista con nombres.
   Capacitaciones y campañas SEPARADAS (DIR-8).
7. DISPUESTOS A DAR (de la disponibilidad declarada del formulario SRV-9) por estudio.
8. POR ZONA: dirigentes disponibles por zona declarada (una persona puede contar en
   varias zonas — tooltip aclarando que la suma supera el total, como REP-7).
9. CRUCE SEDE × FORMACIÓN (el ejercicio de Liberia): tabla de qué estudios puede dar la
   gente de cada sede — para detectar huecos ("en el este sobran de Sirviendo como Jesús
   y no hay de Panorama").
10. Fecha de última actualización visible.
DISEÑO: estilo del sistema (no calcar la infografía IA — misma información y jerarquía,
componentes nuestros).
PERMISOS: coordinador_dirigentes y los lectores (Luis/Yeya), coordinador_estudios,
direccion/admin (el mapeo granular de REP-11). Los que no ven notas/banderitas no ven el
conteo de banderitas.
Export XLSX de cada lista drill-down. SQL agregado, números = los de la ficha (misma
definición central de DIR-8 — si difieren es bug). Tests de los desgloses con fixtures.
tsc/lint/vitest.
```

### [x] DIR-10 · Tab "Dirigente" rediseñado — COMPLETO 2026-10-13 («mi comunidad» incluida)

**Lo que se entregó:** cada dato como una línea que se lee («lunes por la
mañana y por la tarde; miércoles por la noche») con «Editar» al lado; la lista
completa solo se abre al tocar ese dato. «Confirmar mis datos» subió arriba.
Las campañas salen aparte de la formación. Verificado a 1024 y a 360px.

**La medida del problema:** el tab abría 122 controles a la vez (21 casillas de
horario, 30 estudios dos veces, las zonas).

**UN componente, dos presentaciones.** El formulario de la campaña (SRV-9)
sigue en modo completo: ahí la persona entró a llenarlo entero de una sentada.
El prop `modo` cambia cómo se PRESENTA, nunca qué se guarda, y hay un test que
lo cuida — la tentación al rediseñar uno de los dos es copiarlo, y ese día la
campaña de marzo y el perfil empiezan a preguntar cosas distintas.

**Detalle que parece menor y no lo es:** lo pendiente se dice con palabras
(«Todavía no lo dijiste: en qué zonas podés dar») y no con un guion, que se lee
como un error de la pantalla. Y un «no ofrezco casa» NO cuenta como pendiente:
es una respuesta, y marcarla como falta le pediría para siempre que conteste lo
que ya contestó.

**FALTA:** el campo «mi comunidad» que pedía el prompt. Sigue bloqueado por lo
mismo que el resto de DIR-8: no existe el catálogo de comunidades, y sin
catálogo sería un campo de texto libre que se llena de cuatro formas distintas
—exactamente lo que pasó con «¿dónde te dejamos los folletos?»—.

#### DIR-10 · prompt original (referencia, ya ejecutado)

Hoy el tab se ve abrumador y el dirigente no puede editar. Decidido en la
reunión: los "curiosos" editan directo en su perfil (y así ya están
actualizados cuando llegue la campaña); el formulario (SRV-9) queda para la
campaña masiva — ambos escriben sobre los MISMOS datos.

Prompt para Claude Code:

```
REDISEÑO UI · Tab "Dirigente" del perfil propio: simple, ordenado y editable

PROBLEMA: el tab actual es abrumador (todas las listas y opciones desplegadas de un
solo). El dirigente además no puede editar nada.

DISEÑO NUEVO — un RESUMEN limpio por secciones, no las listas abiertas:
1. "Mi disponibilidad" (EDITABLE por el dirigente, guardado directo por campo):
   qué quiero dar · cuándo puedo (días/franjas) · dónde (zonas) · ofrezco casa ·
   suplente · desde cuándo puedo empezar · MI COMUNIDAD (DIR-8). Cada dato como línea de
   resumen ("Días: lunes y miércoles por la noche") con lápiz para editar en sitio — las
   listas completas solo se abren al editar ese campo.
2. "Mi formación" (SOLO LECTURA): qué estoy capacitado a dar — capacitaciones y campañas
   separadas (DIR-8) — con el botón "esto no es correcto" que abre tiquete a coordinación
   (ya definido en SRV-9).
3. Botón "Confirmar mis datos" visible arriba: guarda la fecha de última confirmación
   (la que usa la campaña para saber quién ya revisó); si todo está bien, un clic y listo.
4. Lo que NO va en este tab: estado activo/inactivo con sub-razones, banderitas y notas
   (eso es la ficha administrativa de DIR-8 — acá el dirigente solo ve su propia
   información operativa).
SINCRONIZACIÓN: estos campos son LOS MISMOS que llena el formulario de la campaña
(SRV-9) — una sola fuente; editar aquí deja el formulario prellenado y viceversa
(verificar el round-trip). Quitar del tab cualquier campo que la reunión sacó (dónde
recibir folletos).
Mobile: el tab debe verse bien en 360px (criterio MAT-2).
Tests: dirigente edita disponibilidad (y 403 a formación), confirmación guarda fecha,
no-dirigente no ve el tab, sync tab↔formulario. tsc/lint/vitest.
```

### [x] DIR-11 · Graduados recientes de CDEB — 33 de 33 APLICADOS 2026-10-13

Listas de Fabiola (captura del 12-oct). Ojo: los encabezados no cuadran con lo
listado — "24 estudiantes" pero hay 26 nombres; "4 estudiantes" pero hay 5.
Confirmar con Fabiola los totales antes de aplicar.

LISTOS PARA DAR ESTUDIOS POR SÍ SOLOS (26 listados): José Rivera · Fulvio
Granados · Silvia Mora · Carolina Dahma · Karen Campos · Davis Badilla ·
Karina Cavero Sandoval · María Fernanda Madrigal Alvarado · María Fernanda
Valverde Domínguez · Falon Ceciliano Alvarado · Marco Araya Ramírez · Natalia
Alvarado Hernández · Julián Álvarez Gómez · Tatiana Fuentes Quirós · Alonso
Lopez · Eric Arguello · Isaac Leon · Luis Minor Cordero · Luz Caceres ·
Roberto Fernandez · Tatiana Arauz · Valeria Martínez · Johana Vasquez ·
Keylin Soto Pérez (Pasantía) · Jorge Delgado Montoya (Pasantía) · Brenda
Peralta Romero (Con codirigente).

NO APROBARON (5 listados): Marisol Soto · Milena Hansband · Antonio Buitrago ·
Esteban Hernandez · Warren Baez.

**DIR-11 · lo aplicado el 2026-10-13**

Las 33 personas con su estado correcto: **25 disponibles · 8 en pasantía ·
2 inactivas por no aprobar · 1 inactiva por no asistir.**

**El último lo destrabó Floriana el 13-oct.** «Luis Minor Cordero» no calzaba
con ningún CDEB de ninguna generación porque el apellido venía incompleto: es
**Luis Minor Cordero FONSECA**, del CDEB de Eddy Gómez que cerró el 6-dic-2025
—la misma fecha que ella dio, y la que trae `closed_at`—. Verificado antes de
escribir: una sola ficha viva con ese nombre, matrícula `completed`, grupo
`finalizado` y sin ficha de dirigente previa. Quedó activo / disponible.

**EL MATCH NO SE HIZO CONTRA EL PADRÓN sino contra quienes de verdad
llevaron CDEB.** Por nombre suelto calzaban 13 de 31 —la lista viene sin
segundos apellidos—; cruzando contra los inscritos de CDEB, 27. Y de paso
verificó la graduación de cada uno, que era el punto 1 del prompt.

**La lista de Fabiola tenía dos personas mal clasificadas, y se vio porque
el sistema decía otra cosa:**
 · **Antonio Buitrago** y **Milena Halsband** figuraban en «no aprobaron» y
   los dos APROBARON. Lo confirmaron los comentarios de Eddy Gómez.
 · Esa lista mezclaba «reprobó el curso» con «no va a dar estudios». Son
   cosas distintas y se registran distinto: Antonio quedó activo en
   pasantía (necesita más formación) y Milena inactiva por NO ASISTIR (se
   fue a Casa 242), no por no aprobar. Darles de alta como decía la lista
   les habría dejado un «no aprobó el CDEB» falso en el expediente.

**Tres nombres estaban mal escritos en la captura** y por eso no aparecían:
Carolina **Damha** (no «Dahma»), Milena **Halsband** (no «Hansband»), y
Meysi (no «Meisy»).

**Se cerraron dos grupos de CDEB** que estaban abiertos y bloqueaban el
alta: el de Eddy Gómez de mayo y el de Andrey Mora. Los dos SIN encuesta de
satisfacción —terminaron en agosto y una encuesta dos meses tarde se
responde poco y mal (decisión de Floriana)—. Se llamó al RPC `close_group`
directo en vez del endpoint, que es quien la programa.

**Ana Catalina Rodríguez** estaba inscrita como ESTUDIANTE del grupo de
Andrey y no lo era: acompañó como co-dirigente junto con Roxana Rojas. Salió
del cierre como retirada, con el motivo escrito.

**El bug que el punto 3 sospechaba NO existe:** no hay ningún automatismo
que convierta «tiene CDEB en el historial» en dirigente. El alta es manual,
así que los no aprobados no entran solos.

**Queda UNO: Luis Minor Cordero**, que no aparece en ningún CDEB de ninguna
generación. Falta su nombre completo o la cédula.

**Y dos cosas menores:** la razón del no aprobado de Marisol Soto («ver con
Fabi») y que la tabla `study_groups` NO TIENE campo de notas — el comentario
general de un cierre no tiene dónde guardarse y hubo que repetirlo en la
ficha de cada persona.

Prompt para Claude Code:

```
DATOS · Alta de la generación nueva de CDEB como dirigentes (correr DESPUÉS de DIR-8,
que define los estados; si DIR-8 no ha corrido, aplicar con los estados actuales y
anotar para re-mapear)

1. MATCH por nombre contra el padrón (candidatos ambiguos o sin match → lista para
   Floriana/Fabiola, NUNCA adivinar — regla de siempre). Verificar que todos tengan la
   graduación de CDEB registrada en su historial; si a alguno le falta, agregarla
   (son los cierres recientes — cruzar con las graduaciones del bloque).
2. APROBADOS (los 26): alta en el módulo de dirigentes con estado ACTIVO:
   - 23 → Disponible.
   - Keylin Soto Pérez y Jorge Delgado Montoya → Activo · No disponible · En pasantía.
   - Brenda Peralta Romero → Activo · En pasantía con nota "con codirigente" (el
     esquema DIR-8 trata el codirigente de apoyo como pasantía).
   Formación inicial: lo que CDEB habilita (verificar con el catálogo qué puede dar un
   recién graduado — niveles; confirmar con Fabiola si algo más).
3. NO APROBADOS (los 5): NO entran como dirigentes activos. Quedan INACTIVOS con
   sub-razón "Asiste pero no ejerce — No aprobó CDEB" (DIR-8), pendiente de que Fabiola
   marque por persona si es definitivo o en seguimiento. El sistema NO debe jalarlos
   como dirigentes por tener el curso en su historial: la regla de "graduado de CDEB →
   dirigente" debe respetar el RESULTADO del cierre (aprobó/no aprobó) — verificar que
   el flujo de recomendación/alta (cdeb-recommendation/leader-activation) mire el
   resultado y no solo la participación. Si hoy no lo mira, ESE es un bug aparte:
   arreglarlo aquí.
4. DRY-RUN con la lista completa de cambios para aprobación; audit_log; sin correos.
Tests: la regla de alta respeta el resultado (aprobado entra, reprobado no).
tsc/lint/vitest.
```

### [ ] EMP-1 · Módulo de empleados completo — PARA 2027, falta definirlo

**APARCADO A PROPÓSITO (decisión de Floriana, 2026-10-13): se retoma en 2027.**
No es que esté bloqueado por algo técnico — falta definir el alcance, y hasta
que eso pase no hay nada que construir. Queda escrito para no perder el
inventario.

Lo construido hasta ahora (perfiles, salarios, documentos, vacaciones básicas)
necesita completarse para ser el módulo de RRHH real. Requiere definición de
alcance con dirección antes de los prompts — este ítem deja el inventario:

- VACACIONES: saldo por empleado (acumulación según ley CR — 2 semanas por 50
  semanas—, o la política interna que dirección defina), solicitud del empleado
  → aprobación del jefe, calendario del equipo, historial.
- FERIADOS: calendario de feriados CR (de ley y de pago obligatorio vs no
  obligatorio) + feriados internos de Theos; afecta el cálculo de jornadas.
- JORNADAS: definición por empleado (tiempo completo/medio/por horas, horario),
  base para vacaciones proporcionales y control de tiempo si se quiere.
- CONTRATOS: tipo (indefinido/plazo/servicios profesionales), fechas, puesto,
  salario vigente con historial de cambios, documentos adjuntos (el módulo de
  documentos ya existe), alertas de vencimiento de plazo/período de prueba.
- Permisos: módulo exclusivo (RRHH/dirección) — censar quién ve salarios hoy.
PASO 1: reunión con dirección para el alcance (¿planillas/aguinaldo quedan
fuera? ¿control de asistencia del staff?) → luego se fasean los prompts como
FIN-11.

### [x] DIR-13 · CSV de Fabiola IMPORTADO — 2026-10-13

**Aplicado:** 470 de 485 filas. El cuerpo quedó en 248 activos disponibles, 75
en pausa, 9 en pasantía, 1 estudiante en capacitación y 245 inactivos, más 49
banderitas y 185 marcados en WhatsApp. Se crearon 64 fichas de dirigente
nuevas y 300 personas sumaron formación (solo aditiva).

**Verificado después de aplicar:** ningún inactivo con grupo abierto —la regla
que podía hacer daño—, e idempotente (la segunda corrida comparó las 578
fichas campo por campo y no cambió nada).

**Dos bugs del propio script que el dry run atrapó**, y los dos habrían pasado
desapercibidos al aplicar: el RPC se llamaba con el nombre de parámetro
equivocado y devolvía vacío para las 485 filas; y el padrón se traía sin
paginar, así que PostgREST cortaba en 1.000 de ~18.000 y los resueltos a mano
no aparecían. Ese segundo es el MISMO corte que esa noche dejó 82 check-ins
fuera de la pantalla de Meridiano.

**QUEDA PARA FABIOLA, y conviene no perderlo de vista:**
 · **75 pausas sin fecha.** Cada una con su nota; el sistema exige la fecha.
 · **245 inactivos sin sub-razón.** El CSV no la traía y no se inventó.
 · **13 filas ignoradas**, que son la señal de que su Excel está viejo: 10 que
   da de baja y el sistema tiene activas, 2 contradicciones, y 1 que da de baja
   teniendo un grupo en curso.
 · **2 sin resolver:** «Solis, Adriana» —cuatro candidatas, ninguna dirigente,
   y se decidió no adivinar— y una fila sin nombre.

**Fuera por decisión:** «Es orador» se maneja por puestos de servicio y «En
koinonía» no se importa.

### [x] DIR-13 · prompt original (referencia, ya ejecutado)

Archivo: `data-import/dirigentes-status-fabiola-2026-10-13.csv` (485 filas,
latin-1). Analizado con Floriana; reglas acordadas abajo.

Prompt para Claude Code:

```
IMPORT · Dirigentes: estados, formación y datos desde el CSV de Fabiola

ARCHIVO: data-import/dirigentes-status-fabiola-2026-10-13.csv — OJO: encoding latin-1,
booleanos como VERDADERO/FALSO, fechas M/D/YYYY. 485 filas; 471 con Individual ID (CCB),
14 sin ID, 0 IDs duplicados. Es manual: puede traer errores — por eso todo pasa por
dry-run.

MATCH: por Individual ID = external_id (member_por_external_id, DAT-9). Los 14 sin ID:
match por nombre SOLO si es único e inequívoco; el resto a lista de revisión manual.

REGLA DE ESTADOS — ASIMÉTRICA (decidida 2026-10-13):
- CSV Activo + sistema Inactivo → REACTIVAR con el sub-estado del CSV (la lista completa
  de reactivaciones va en el dry-run para aprobación).
- CSV Inactivo + sistema Activo o dirigiendo → EL SISTEMA GANA: no se desactiva a nadie.
  Reportar estas filas (son el CSV desactualizado).
- Mapeo de la taxonomía vieja → DIR-8:
  · "Activo + En Curso" / "CoDirigente En Curso" → el sistema ya los tiene (automático);
    solo verificar coincidencia.
  · "Activo + Disponible" → Activo · Disponible.
  · "Activo + Descanso" (51) → Activo · No disponible · EN PAUSA SIN FECHA, marcados
    "pausa por completar" para que Fabiola agregue fecha/justificación.
  · "Activo + En Capacitación" → Activo · No disponible · Estudiante en capacitación.
  · "Pasantía" (2) → Activo · No disponible · En pasantía.
  · "En revisión" (50) → BANDERITA de revisión + estado subyacente según su columna de
    disponibilidad (Descanso→pausa sin fecha, Disponible→disponible, En Curso→lo
    automático, vacío→disponible con nota).
  · "Inactivo" (183) → Inactivo · sub-razón "POR CLASIFICAR" (el CSV no la trae).
  · Contradicciones ("Inactivo + Disponible" x2, 1 sin status) → lista de revisión, no
    se importan.

⚠️ PREREQUISITO EN EL MISMO PR: el recálculo automático de dirigente activo (PAR-2, cron
del 1°) debe RESPETAR los estados con clasificación manual de DIR-8 (pausa, capacitación,
formación, pasantía, y las reactivaciones de este import): el cron solo mueve a quienes
NO tienen sub-estado manual. Sin esto, el import se deshace solo el 1° de noviembre.
Test explícito de que el cron no pisa un estado manual.

FORMACIÓN — SOLO ADITIVA (regla de Floriana): agregar Niveles, SCJ, Discípulos y
Prematrimonial donde el CSV diga VERDADERO y el sistema no lo tenga. JAMÁS quitar
formación existente (las columnas en FALSO no niegan nada — el CSV casi no las usó).
Año de CDEB: guardarlo si hay campo para eso; "Pendiente"(15) y "-"(21) no son años —
reportarlos aparte.

OTROS CAMPOS:
- "Están en el grupo de whatsapp" → el check de WhatsApp de DIR-8 (190 en VERDADERO).
- "Es orador" (80) y "En koinonía" (44): REPORTAR primero dónde vivirían (¿puesto de
  orador existente? ¿campo nuevo?) — no inventar campo sin confirmar con Floriana.
- Zona/Ubicación/teléfono/correo: NO pisar datos del perfil — solo reportar diferencias
  grandes (el perfil del sistema es la fuente de contacto, no este CSV).

DRY-RUN OBLIGATORIO con: conteo por tipo de cambio, lista nominal de reactivaciones,
lista de conflictos/no-matcheados/contradicciones, y muestra de 10 filas aplicadas.
Aplicar solo tras aprobación. Idempotente (segunda corrida = cero cambios). Audit_log.
Sin correos. tsc/lint/vitest.
```

## Fase 29 — Centro de recursos (decidido 2026-10-16)

### [x] REC-1 · Centro de recursos con acceso segmentado — HECHO 2026-10-16 (en staging)

- Tabla `resources` + bucket PRIVADO `resources` (15 MB, PDF/PNG/JPG/WebP) en la
  migración `20261016150000`; rol nuevo `recursos` (asignable desde Accesos).
- Audiencia = la `Restriccion` de GRU-2/FRM-5 MÁS una condición nueva `role`
  (member_roles activo, incluye los roles por puesto). El rol entra SOLO en la
  lista de recursos (`TIPOS_DE_AUDIENCIA_DE_RECURSOS`), no en grupos/formularios
  ni en el padrón; el contador de audiencia lo acepta solo con `recursos:create`.
- Sin audiencia = BORRADOR (solo gestión), no «para todos».
- Abrir/descargar por `/api/resources/[id]/file`: valida la audiencia y redirige
  a una URL firmada de 5 min; 403 a quien no es audiencia aunque adivine el id.
- Probado en staging con cuentas [prueba]: por rol, por puesto, combinada (O),
  pierde el puesto → deja de ver, sin permiso no sube/edita/borra, el ejecutable
  disfrazado de PDF se rechaza, borrar quita el archivo del bucket.

Decisión de arquitectura ya tomada (análisis Dropbox/SharePoint/admin hecho):
va en el sistema admin con Supabase Storage. SharePoint queda para el trabajo
interno editable del staff (actas, contabilidad); el admin distribuye recursos
con control de acceso. Razón de fondo: la lista de voluntarios vive en el
admin — ahí ya se autentican, los permisos son granulares, el patrón bucket
privado + URL firmada ya funciona (comprobantes), y quien deja un puesto
pierde acceso solo. Contenido: PDFs e infografías (sin video; si algún día hay
video → Microsoft Stream con solo índice/permiso en el admin). Egress de
Supabase no es problema con este contenido.

Prompt para Claude Code:

```
FEATURE · Centro de recursos (/recursos): documentos con acceso segmentado

QUÉ: biblioteca de PDFs e infografías (manuales, registros, guías) donde cada recurso
define QUIÉN lo ve, con dos ejes COMBINABLES de audiencia:
  a) por ROL (ej. "todos los dirigentes"),
  b) por PUESTO de servicio (ej. "encargados de logística").
Ambos ejes existen — REUTILIZAR el sistema de condiciones/audiencias (GRU-2/FRM-5) y los
roles automáticos por puesto; NO inventar un modelo de permisos nuevo.

ALMACENAMIENTO — el patrón de comprobantes de pago, calcado:
- Bucket PRIVADO en Supabase Storage (jamás público).
- Descarga/vista SIEMPRE por URL firmada temporal, emitida por un endpoint que valida el
  acceso server-side (la UI también filtra, pero el server es el candado).
- Tipos permitidos: PDF e imágenes (validar MIME y tamaño razonable al subir).

GESTIÓN:
- Permiso NUEVO `recursos` (asignable/removible como todos — nunca hardcodeado a
  personas) para quienes suben y organizan: subir, editar metadatos (título, descripción,
  categoría/carpeta), definir la audiencia y retirar recursos.
- Registro de quién subió qué y cuándo (audit_log + columna visible).
- Borrado con el patrón global: DeleteConfirmModal + ActiveWarningModal; si el recurso
  tiene audiencia activa, avisar antes.
- Organización simple: categorías/carpetas + búsqueda por título.

CONSUMO:
- Página /recursos para cualquier usuario autenticado: ve ÚNICAMENTE los recursos cuya
  audiencia lo incluye (cálculo server-side; lista vacía con mensaje amable si no hay
  nada para su perfil). Abrir/descargar vía la URL firmada.
- Entrada de menú visible solo si tiene al menos un recurso o el permiso de gestión.
- Mobile 360px (criterio MAT-2) — los voluntarios lo van a abrir del teléfono.

ESTILO: navy/coral/teal del sistema, componentes existentes.
Tests: audiencia por rol, por puesto y combinada (incluido: pierde el puesto → deja de
ver); URL firmada denegada server-side a quien no es audiencia (403 aunque adivine el
id); solo `recursos` sube/borra; borrado con confirmación. tsc/lint/vitest.
```

### [x] FIN-REP · Comité «Servidores» en el reporte de finanzas — DESCARTADO 2026-10-16

**Decisión de Floriana (2026-10-16): se deja como está.** La «Actividad
Servidores» sigue como tipo `taller` y sus pagos salen en «Eventos · Taller».
No se crea el tipo ni se agrega el comité. Lo de abajo queda como registro.

**Definición propuesta:** un pago es del comité Servidores si es de un evento
de tipo «Actividad de Servidores». O sea: se agrega ese tipo al catálogo
(`event_types`) y la «Actividad Servidores» del 10-oct, hoy tipo `taller`, se
pasa a él. El reporte agrupa por tipo de evento, así que aparece solo como
«Eventos · Actividad de Servidores», sin código. Hoy esos 90 pagos salen como
«Eventos · Taller» (los otros 3 talleres no tienen pagos).

Lo que NO es la definición, a propósito: «lo que paga un servidor». Eso
mandaría a Servidores la inscripción de un servidor a Sports o a un taller.


## Backlog post-Tilopay (apuntados 2026-10-16, sin detallar todavía)

### [x] EST-29 · Análisis de demanda desde las solicitudes de estudio — HECHO 2026-10-16 (staging)

Pantalla **/estudios/demanda** («Demanda declarada»), para STUDY_ADMIN_ROLES
(incluye coordinador_dirigentes, como el resto de estudios).
- Censo de fuentes: «me interesa» (plan, días, franja; zona = NOMBRE de sede o
  texto libre), reubicaciones (zonas en código) y becas «por modificar» (sin zona).
  En prod 30 de 35 solicitudes se ubican en una zona; el resto va a «Otra zona».
- Clústeres plan × zona (capacitaciones solo por plan), umbral 3+, cruce con
  dirigentes disponibles (`disponibilidadEfectiva` + `qualified_study_codes` +
  `zone_preference`), tendencia semanal de 12 semanas, export XLSX.
- «Abrir grupo con estos datos» prellena Nuevo grupo y, al crearlo, vincula las
  solicitudes (`study_requests.grupo_propuesto_id`, migración `20261016200000`).
  No resuelve ni matricula: se avisa y se resuelve en la cola, como siempre.
- Pendiente de producto: el formulario de «me interesa» no pide zona en código;
  pedirla con la misma lista de zonas evitaría el «Otra zona».


Convertir las solicitudes acumuladas en decisiones de apertura: "hay 4
solicitudes de Nivel 1 en el este → abramos ahí".

Prompt para Claude Code:

```
FEATURE · Demanda de estudios: análisis de solicitudes para decidir aperturas

QUÉ ES: pantalla para el equipo de estudios (coordinador_estudios, direccion, admin —
probablemente en /estudios, no en /reportes: es operativa, se actúa sobre ella) que
agrupa TODAS las solicitudes de estudio ABIERTAS/NO RESUELTAS y encuentra los factores
en común para armar grupos.

FUENTES DE DEMANDA (censar primero cuáles existen y reportar):
1. Solicitudes de estudio ("me interesa un estudio" — las que hoy viven en la cola de
   solicitudes; el cron study-requests-expire las vence por bloque: las vigentes).
2. Solicitudes de reubicación pendientes y en espera (REU-2) — también son demanda de
   un grupo que no existe.
3. Becas aprobadas/pendientes cuyo grupo se llenó (BEC-5 "por modificar") — demanda
   insatisfecha.
Si alguna fuente no guarda zona o franja, reportarlo (es un dato a empezar a pedir).

LA VISTA — AGRUPACIÓN POR FACTORES COMUNES:
1. CLÚSTERES: agrupar por plan de estudio × zona (× franja día/horario si el dato
   existe), ordenados por tamaño: "Nivel 1 · Este de San José · 4 personas". Umbral
   visual configurable (constante, default 3+) que destaca los clústeres accionables.
2. Al abrir un clúster: la LISTA de solicitantes (nombre, fecha de solicitud, qué pidió
   exactamente, contacto) — para confirmar que el grupo les sirve antes de abrirlo.
3. CRUCE CON OFERTA: junto a cada clúster, los DIRIGENTES DISPONIBLES para ese estudio
   en esa zona (la disponibilidad declarada de DIR-8/SRV-9 + formación — el mismo cruce
   sede×formación de DIR-9: REUTILIZAR). El insight completo es "hay 4 pidiendo Nivel 1
   en el este Y hay 2 dirigentes disponibles ahí" vs "hay demanda pero nadie que lo dé"
   (eso alimenta a quién capacitar).
4. CAPACITACIONES: misma agrupación por tipo (sin zona si son centralizadas): "8 piden
   Hermenéutica" → decidir si se abre.
5. TENDENCIA simple: solicitudes nuevas por semana por plan (¿la demanda de X crece?).

ACCIÓN DESDE EL CLÚSTER:
- Botón "Abrir grupo con estos datos" → crear grupo prellenado (plan, zona) por el flujo
  normal de creación; al crearse, las solicitudes del clúster quedan VINCULADAS para
  resolverlas con el mecanismo existente (resolveStudyRequest) cuando el grupo abra
  matrícula — no auto-matricular: avisar/resolver como hoy.
- Export XLSX del análisis.

RENDIMIENTO: SQL agregado. Excluir [prueba] y solicitudes vencidas.
Tests: clúster agrupa bien (mismo plan+zona), umbral, cruce con dirigentes disponibles,
solo roles de estudios (403 al resto). tsc/lint/vitest.
```

### [x] DIR-14 · Banderita de revisión automática por compromisos (pedido 2026-10-16) — ACTIVO

**2026-10-16, ACTIVADO con el visto bueno de Floriana.** Primera corrida aplicada
en prod a mano (172 banderitas: 50 donación, 60 asistencia, 62 ambas; respaldo en
`docs/correcciones/2026-10-16-dir14-primera-corrida.json`). El cron queda agendado
los lunes 11:30 UTC.

**Estado anterior (construido y probado en staging; el cron NO estaba agendado).**
Falta que coordinación de dirigentes apruebe la lista del ensayo. Para activarlo:
agregar a `vercel.json` `{ "path": "/api/cron/dirigentes-compromisos", "schedule":
"30 11 * * 1" }` y crear el check de Healthchecks (`HEALTHCHECK_URL_DIRIGENTES_COMPROMISOS`,
grace 360).

- Columnas propias `revision_auto_faltan` / `revision_auto_desde` (migración
  `20261016120000`): la manual y la automática no se pueden pisar.
- «Por compromiso» ya no se marca a mano (`RAZONES_DE_REVISION_MANUALES`).
- Regla pura en `src/lib/leaders/revision-por-compromiso.ts`; donación por
  `members.is_donor` (FIN-10) y asistencia por `getActiveAttendanceMemberIds()`.
- Freno: si la asistencia llega vacía, no escribe y responde 503.
- Ensayo en prod (2026-10-16, solo lectura): **172 de 333 activos** (50 solo
  donación, 60 solo asistencia, 62 ambas; 38 ya tienen una manual). **84 de los
  172 no están en el Comité de Dirigentes** aunque la ficha los diga activos:
  conviene revisar ese estado antes de encender el cron.

Pedido de la encargada de dirigentes: automatizar la banderita de "en
revisión" cuando el dirigente no cumple compromisos, con su justificación, y
quitarla sola cuando vuelve a cumplir. Corre semanal.

Prompt para Claude Code:

```
FEATURE · Cron semanal: banderita de revisión automática para dirigentes por compromisos

CAMBIO SOBRE DIR-8: la banderita era 100% manual; ahora la razón "POR COMPROMISO" pasa a
ser AUTOMÁTICA. Las demás razones (testimonio, preparación, no confirmó datos) siguen
siendo manuales y EL CRON NO LAS TOCA — distinguir el origen de la banderita
(manual/automática, el patrón source de siempre).

REGLA (sobre dirigentes ACTIVOS):
- Si NO cumple alguno de los compromisos según LAS DEFINICIONES CENTRALES existentes —
  donante activo (FIN-10: mes actual + 3 meses, cónyuge cuenta) o asistencia activa (la
  regla de siempre) — se le ACTIVA la banderita automática "por compromiso" con la
  justificación generada: "No cumple: donación" / "No cumple: asistencia" / ambas.
  REUTILIZAR las funciones de SRV-4/REP-7 que ya calculan esto — cero definiciones nuevas.
- Si vuelve a cumplir TODO → la banderita automática se QUITA sola (las manuales jamás).
- Si ya tiene banderita manual, la automática no la pisa ni la duplica: se suman como
  razones visibles por separado.

CRON SEMANAL (patrón vercel.json + CRON_SECRET + check de Healthchecks nuevo con su
schedule correcto y grace — documentar en .env.example): recalcula todo el cuerpo de
dirigentes activos. Idempotente. Cada puesta/quitada al audit_log con la justificación.
SIN correos ni notificaciones al dirigente (la banderita es administrativa y confidencial
— solo la ve quien ya la ve según DIR-8).

VISIBILIDAD: en la ficha administrativa, la banderita automática muestra su justificación
y desde cuándo; en el reporte de dirigentes (DIR-9), el conteo de banderitas distingue
automáticas de manuales.

DRY-RUN antes de activar el cron: lista de a quiénes se les pondría la banderita HOY con
las reglas (van a ser varios — la encargada debe ver la lista antes de que aparezcan 80
banderitas de golpe).
Tests: no dona → banderita con justificación; vuelve a donar → se quita; manual no se
toca; ambas razones listadas; idempotente. tsc/lint/vitest.
```

## Fase 30 — Perfil S.I.R.V.E. (pedido 2026-10-20)

### [x] SRV-20 · Perfil S.I.R.V.E. — ETAPAS 1–3 HECHAS 2026-10-20; etapa 4 (invitación desde el grupo + filtros del padrón) 2026-10-21; 4A en producción, 4B en staging

**Decisiones de Floriana al construirlo (2026-10-20):**
- UNA tabla y UNA pestaña: va en `member_spiritual_data` junto al bautismo, y la
  pestaña se llama «Espiritual y S.I.R.V.E.». Los dones NO se repiten: el texto
  libre `spiritual_gifts` se quitó y los 20 que lo tenían pasaron a «otros dones».
- Del CSV de CCB NO se importan datos personales ni comité/sede/dirigente: el
  sistema los tiene más al día. Solo lo propio del perfil.
- Puestos de dirección y roles de lectura: `ROLES_QUE_LEEN_SIRVE` en
  `lib/servers/perfil-sirve.ts`.

**Lo hecho:** migraciones `20261020200000` (columnas) y `20261020210000`
(tipo de campo `sirve_profile`), componente `PerfilSirve` (resumen con lápiz /
modo formulario), PATCH con zod + audit_log, formulario espejo con audiencia
«completó SCJ» (`scripts/srv20/sembrar-formulario-perfil-sirve.ts`), import
`scripts/srv20/importar-perfil-sirve-ccb.ts` (dry run en producción: 956 de 970
resueltas, 0 ambiguas, 14 sin ficha).

**Ajuste del 2026-10-21 (Floriana), en staging:** la formación y la ocupación
se FUNDEN en UN campo «Formación académica / Profesión» que es
`members.occupation` — el mismo «Profesión» de Info Personal, editado con el
mismo control y el mismo PATCH, y la ficha se refresca al guardar desde el
S.I.R.V.E. Regla «juntar los dos» (`unirProfesion`): ficha · formación ·
ocupación, sin repetir. Dry run en producción: 581 → 1254 fichas con
Profesión, 935 unidas. Y se QUITA la trayectoria de servicio (3 campos): el
sistema la sabe por los puestos. Migración `20261021120000`; lo borrado queda
en `docs/correcciones/2026-10-21-perfil-sirve-profesion-unica.json`.

**APLICADO EN PRODUCCIÓN 2026-10-21.** Import: 956 resueltas → 952 filas
(4 colapsaron porque dos IDs de CCB apuntan a la misma ficha fusionada).
De los 14 sin ficha, 11 se asociaron por TELÉFONO (8 dígitos, exactamente una
ficha activa) + nombre, y lo confirmó la regla de Floriana: casi todos llenaron
el formulario a 7–35 días de completar SCJ (`completed_at`). Respaldo en
`docs/correcciones/2026-10-21-perfil-sirve-ccb-match-por-telefono.json`.
Quedan 3 sin asociar: Lina Solano (el teléfono es de Glenda Salas Solano, otra
persona), Carol González Villarreal (nadie con ese nombre, correo ni teléfono) y
la fila basura «xcvcxv kjnjk». Dato suelto: 23 importados no tienen SCJ
completado en el sistema — casi todos respuestas 2018–2021, antes del
histórico importado; no se tocó.

**Etapa 4, parte A — HECHA 2026-10-21 (staging): el botón del grupo de SCJ.**
Pedido de Floriana: en todo grupo de Sirviendo como Jesús, un botón para el
dirigente que manda un correo a los estudiantes pidiendo llenar el formulario
del perfil. Decisiones: a TODOS los matriculados activos (no solo los que
completaron; la audiencia del formulario pasó a «completó o cursando»); un
correo por persona, y un segundo clic ofrece REENVIAR solo a quien no ha
llenado; también mientras el grupo está en curso. Quién lo aprieta: la misma
regla que cerrar el grupo (`puedeCerrarEsteGrupo`: coordinación, dirigente o
co-dirigente). Piezas: reglas puras en `lib/servers/invitacion-perfil-sirve.ts`,
correo `sirve_invitacion` + tabla `sirve_form_invites` (migración
`20261021140000`), envío en `lib/email/sirve-invite-notify.ts`, endpoint
`/api/studies/groups/[id]/sirve-invite` (GET estado, POST `{action}`),
componente `InvitarPerfilSirve` (botón «Enviar encuesta S.I.R.V.E.», renombrado el 2026-10-23 porque «Pedir el perfil» no decía que mandaba un correo). Dos reglas aprendidas probándolo: se registra
solo lo que SALIÓ (`enviado`, BEC-3: un `.invalid` daba `ok` y quedaba como
invitado), y quien no tiene correo o apagó los avisos no cuenta, porque si no
el botón se queda para siempre en «enviar» y el reenvío nunca sale.
**Pendiente:** sembrar el formulario en producción con la audiencia nueva
antes de que alguien apriete el botón ahí (`ENV_FILE` por defecto, `--aplicar`).

**Etapa 4, parte B — HECHA 2026-10-21 (staging): filtros del padrón.** En
Filtros → Perfil: «Formación académica / Profesión» (texto libre sobre
`members.occupation`, busca dentro del texto) y cuatro desplegables de
selección múltiple sobre los catálogos del perfil: Dones (test u oración),
Habilidades, Pasiones y Estilo (primario o secundario). Los cuatro de
S.I.R.V.E. solo los ve quien lee el perfil (`puedeLeerSirve`) y el servidor
rechaza con 403 en /api/members, /ids y /export si llegan sin el rol: no se
sanean en silencio, porque una lista que ignora parte de su filtro se
ensancha sola. No entran como audiencia de grupos ni formularios. Módulo puro
`lib/members/filtros-sirve.ts`; cada condición aporta UN set, así que se
pueden negar («Excepto —») como las demás. Más un quinto campo de texto libre, «Otros dones, habilidades o pasiones»,
que busca en las tres columnas «otros» del perfil (pedido el mismo día).
Etapa 4 cerrada.

#### Texto original del pedido (referencia)

Pedido de estudios/servidores: lo que hoy es un formulario de CCB (lo llenan
los estudiantes de Sirviendo como Jesús tras la oración de envío) pasa a vivir
como DATOS DEL PERFIL de cada persona — editables por ella misma — con un
formulario de actualización vinculado, y migrando las respuestas ya existentes.

**QUÉ SE GUARDA (del formulario actual, quitando lo que el sistema ya sabe):**
- Dones espirituales según el Test de Dones (multiselect, catálogo de 22).
- Dones según la Oración de Envío (mismo catálogo + "no me dijeron ninguno").
- Otros dones revelados/manifestados (texto).
- Estilo natural de relacionarse — primario y secundario (el DISC). Catálogo
  de 4 opciones: **Dominante · Influyente · Sólido · Concienzudo**.
- Formación académica (grado) y a qué se dedica (profesión/oficio).
- Habilidades vocacionales (multiselect: cocina, medicina, educación,
  consejería, finanzas, administración, mercadeo, creatividad, música,
  fotografía, diseño, audiovisuales, tecnología, construcción, mecánica,
  idiomas, deportes, manejo de personal + "otras").
- Pasión por servir (multiselect: bebés, niños, jóvenes, adultos, adultos
  mayores, mujeres, hombres, solteros, matrimonios, padres, misiones, ayuda
  social, oración, recreación + "otras").
- Trayectoria de servicio en Theos (texto), motivo de dejar puestos anteriores
  (texto), y "si no estás sirviendo, ¿qué estás esperando?" (texto).
**QUÉ NO SE PIDE (ya lo sabe el sistema):** datos personales, comité y sede
actuales (puestos de servicio), dirigente del curso (grupo de Liderazgo de
Jesús).

**PLAN EN 4 ETAPAS (cada una un prompt/corrida):**

ETAPA 1 — Datos + sección del perfil:
```
FEATURE · Perfil SIRVE, etapa 1: modelo de datos y sección en el perfil propio

1. Migración: estructura para el perfil SIRVE del miembro (tabla propia
   member_sirve_profile 1:1 con members, o columnas en el bloque espiritual — decidir
   según cómo está lo espiritual hoy y reportar). Catálogos de dones (22), habilidades y
   pasiones como constantes de lib/ (NO texto libre salvo los campos "otras"/texto).
2. Sección "Perfil S.I.R.V.E." en el perfil PROPIO (junto a los datos espirituales):
   resumen limpio por campos con edición en sitio (el patrón de DIR-10/FRM: lápiz por
   campo, listas solo al editar). Mobile 360px.
3. PERMISOS (confirmados por Floriana 2026-10-20): la persona ve y edita SOLO el suyo
   (resolveTargetMemberId). LECTURA además para: coordinador_estudios,
   coordinador_servidores/encargado_staff (RH) y direccion (solo lectura). admin todo,
   como siempre. NADIE MÁS — ni líderes de comité ni dirigentes.
4. Audit_log en cada edición. Tests: dueño edita, otro miembro 403, lectura solo roles
   definidos. tsc/lint/vitest.
```

ETAPA 2 — Formulario espejo (patrón SRV-9, calcado):
```
FEATURE · Perfil SIRVE, etapa 2: formulario de actualización vinculado

Formulario del módulo de formularios con campos VINCULADOS al perfil SIRVE (edición en
sitio/guardado directo): abre PRELLENADO con lo que la persona tiene, todo editable, al
enviar escribe al perfil. AUDIENCIA (FRM-5): graduados de "Liderazgo de Jesús" /
estudiantes de Sirviendo como Jesús (confirmar la condición exacta — es el momento del
flujo en que se llena, tras la oración de envío). Es el reemplazo del formulario de CCB:
el correo de campaña lo enlaza; el envío de ese correo es manual (coordinación), no
automático en este ítem. Tests: prellenado, round-trip formulario↔perfil, audiencia.
```

ETAPA 3 — Migrar las respuestas existentes de CCB:
```
IMPORT · Perfil SIRVE, etapa 3: migrar las respuestas del formulario 128 de CCB

ARCHIVO: data-import/perfil-sirve-ccb-2026-10-20.csv (utf-8-sig, 1.013 respuestas,
2018-2026). Radiografía hecha: 834 con Individual ID, 179 sin ID (match por
nombre+correo; ambiguos a lista manual), 35 personas con respuestas múltiples (gana la
más reciente). OJO: hay 3 columnas SIN encabezado (índices 17, 23 y 25) que por posición
son los campos de texto libre "otros dones", "otras habilidades" y "otras pasiones" —
verificar contra 2-3 filas antes de mapear. Los estilos DISC del CSV calzan con el
catálogo (Dominante/Influyente/Sólido/Concienzudo). Mapear las respuestas viejas a los
catálogos nuevos (los textos de opciones son idénticos; los "otras áreas" van al campo
texto). Si una persona tiene varias respuestas, gana la MÁS RECIENTE. Dry-run con
conteos y lista de no-matcheados antes de aplicar. Idempotente. No pisa un perfil que
la persona ya haya editado en el sistema (el dato fresco gana sobre el histórico).
```

ETAPA 4 — Uso por el equipo de servidores (fase posterior, definir con ellos):
búsqueda/filtros por dones, habilidades y pasiones para colocación de
servidores ("¿quién tiene don de enseñanza y pasión por jóvenes en Heredia?") —
probablemente condiciones del padrón (PAR-5/PAR-7 pattern) restringidas a los
roles de lectura de la etapa 1. **No se corre hasta validar con el equipo qué
buscan.**

### [x] FRM-7 · Formularios de actividades sociales: el link viejo pide login + no dejan reinscribirse (pedido 2026-10-26) — HECHO 2026-10-26 (staging; prod al desplegar)

**Diagnóstico y lo hecho (2026-10-26):**
- BUG 1: la publicidad salió con `/formularios/<id>/responder` (el módulo, que
  el proxy manda al login siempre) y la página pública vive en
  `/formulario/<id>`. No había caché ni «link nuevo»: eran dos rutas. Ahora el
  proxy, SIN sesión, traduce `/formularios/<id>` y `/formularios/<id>/responder`
  a `/formulario/<id>`; si el formulario pide cuenta, la página pública ofrece
  «Ingresá para contestarlo» y vuelve al llenado con sesión. Regla pura en
  `lib/forms/reanswer.ts` (`rutaPublicaDesdeModulo`). Con sesión nada cambia.
  Al medir, 9 de los 10 ya estaban abiertos sin cuenta; «Carnet Cárceles»
  sigue pidiendo cuenta (no se tocó: confirmar si es a propósito).
- BUG 2: columna `forms.reanswer_after_days` (default 2, migración
  `20261026120000`); con `allow_multiple_responses` se acepta otra respuesta
  pasados N días de la última de la misma persona (miembro o correo), como
  registro NUEVO; antes de eso 409 con `puede_desde` y «podrás volver a
  inscribirte después del <fecha>». Builder: casilla «Permitir responder más
  de una vez» + días. Pendiente al desplegar: activar en los 10 formularios
  (`scripts/frm7/activar-reenvio.cjs`).


Dos bugs reportados por la encargada de eventos, afectan ayuda social y sports:

Prompt para Claude Code:

```
FIX URGENTE · Formularios públicos: el enlace ya publicado exige login + bloqueo de
respuestas repetidas en eventos recurrentes

BUG 1 — EL MISMO LINK DEBE SERVIR, CON O SIN CHECK DE PÚBLICO:
La encargada creó formularios con login requerido, la publicidad salió con esos enlaces,
y DESPUÉS les marcó el check de "público sin login" — pero el enlace ya impreso/publicado
sigue pidiendo login.
1. Diagnosticar por qué: ¿la ruta /formularios/[id]/responder evalúa el flag al momento o
   quedó cacheado? ¿hay una ruta pública distinta de la autenticada (y el check genera
   OTRO link en vez de cambiar el existente)? ¿PUBLIC_PREFIXES no cubre esta ruta?
2. ARREGLO: el enlace canónico /formularios/[id]/responder (con o sin /responder — ambas
   formas aparecen en la publicidad, ver lista abajo: unificar/redirigir) respeta SIEMPRE
   el estado ACTUAL del check: si el formulario es público, se responde sin login con ese
   mismo URL; si no, pide login. Nunca debe existir "el link viejo" vs "el link nuevo".
3. Verificar los 10 formularios afectados (ids):
   Abuelitos 3d60d1ff-a21b-4c6a-9911-860263db7a6f · Abuelitos Guana
   7647e12d-691b-491f-883c-12803465bbbe · Calles AM 1b58cd13-c9fe-49c3-be9e-7231ca6fbd86 ·
   Calles PM af0a33f8-359f-4407-9eb2-17f91d52d682 · Calles Guana
   4c74325e-45d9-4b8e-9144-678ddf917947 · Calles Pérez a536c932-f140-4bf4-8a7f-38b4950aee7a ·
   Semillitas f4ba8c49-b7d3-422d-80a5-3d955487b97a · Valientes
   30b0c4c9-8bd4-490e-bcb4-7abc46acb4c4 · Renuevos 99aba2b1-ccf1-43c5-8473-0f08166f5166 ·
   Cárceles 5362437c-45a0-47ba-b15c-cae0bc804d4c
   — probar cada uno SIN sesión (ventana incógnita) y confirmar que abre y guarda.

BUG 2 — EVENTOS RECURRENTES: PODER RESPONDER DE NUEVO:
El mismo formulario se reutiliza para cada edición de la actividad (Calles de febrero,
Calles de octubre…) y el sistema dice "ya respondiste" y bloquea.
1. Agregar al formulario la opción "Permitir responder más de una vez" con ventana
   configurable "se puede responder de nuevo después de N días de la última respuesta".
   DEFAULT: 2 días — hay actividades con DOS ediciones en el mismo mes, así que la
   ventana solo debe impedir el doble envío accidental de la misma inscripción, no
   bloquear la edición siguiente. N configurable por formulario para quien quiera una
   ventana mayor.
2. Cada respuesta queda como registro NUEVO con su fecha (no sobreescribir — la lista de
   respuestas del evento de octubre no debe mezclarse con la de febrero: verificar que
   el consumo de respuestas/export distinga por fecha).
3. Activar la opción en los 10 formularios de la lista.
4. El mensaje al que aún no puede: decir CUÁNDO podrá ("Ya te inscribiste a esta
   actividad; podrás volver a inscribirte después del [fecha]"), no un rechazo seco.
   Con el default de 2 días el mensaje casi solo aparecerá en reenvíos inmediatos.
Tests: público sin login responde con el link canónico; privado exige login con el mismo
link; segunda respuesta tras N días se acepta y queda como registro aparte; antes de N
días mensaje con fecha. tsc/lint/vitest. DESPLEGAR PRONTO: la publicidad ya circula.
```

### [x] EST-30 · Folletos de Nivel 1: tiquete automático 2 semanas antes del fin de matrícula — HECHO 2026-10-27

Tipo nuevo `anticipado_auto` (migración 20261027120000). Regla en
`lib/studies/folletos-anticipados-auto.ts` (pura, con tests); enganchado al
cron diario `group-enrollment-windows` (pide antes de cerrar ventanas y
actualiza el mismo tiquete al abrir) y al cambio manual a «en curso» en el
PUT del grupo. Cantidad = cupo máximo (o los matriculados si ya lo pasaron);
la nota del tiquete guarda «confirmados · con pago pendiente» a la fecha y
el historial inicial → final. Convivencia: si ya había orden (EST-21 o
cierre), no duplica; sube la cantidad al cupo solo si sigue en «creada».
Solo N1 (constante `NIVELES_CON_TIQUETE_AUTOMATICO`); sin fin de matrícula
no dispara —queda el botón de EST-21—.

La gente de Nivel 1 se anota hasta el último día y la impresión no da tiempo:
se manda a imprimir por adelantado al CUPO MÁXIMO, y el tiquete se actualiza
con el número final cuando el grupo abre.

Prompt para Claude Code:

```
FEATURE · Grupos de Nivel 1 en matrícula: tiquete de folletos automático anticipado

REGLA NUEVA (complementa EST-18, el botón manual, y EST-21):
1. DISPARADOR AUTOMÁTICO: para todo grupo de NIVEL 1 en estado "en matrícula", DOS
   SEMANAS antes de que termine su período de matrícula se crea automáticamente el
   tiquete de folletos (del par 1+2, esquema de bloques) — vía el cron diario de
   folletos/ventanas existente (folleto-blocks o group-enrollment-windows: engancharse
   al que ya recorre los grupos, no crear cron nuevo).
2. CONTENIDO DEL TIQUETE: toda la información del estudio (grupo, zona/ubicación,
   horario, fecha de inicio), el DIRIGENTE, y la CANTIDAD A IMPRIMIR = CUPO MÁXIMO del
   grupo (se imprime al máximo aunque haya poca gente — la matrícula se llena al final).
   Además, informativo a la fecha: "matriculados confirmados: N · con pago pendiente: M"
   para que Denise sepa cuánta gente hay al momento del tiquete.
3. ACTUALIZACIÓN DEL MISMO TIQUETE: cuando el grupo pasa a "por iniciar"/abre (fin de la
   matrícula), el MISMO tiquete se actualiza con los números finales (matriculados
   confirmados y pendientes a esa fecha) y se notifica a folletos con el resumen
   actualizado — NO se crea un segundo tiquete. Dejar visible en el tiquete el historial
   (cifra inicial → cifra final).
4. CONVIVENCIA: si el tiquete manual (EST-18) ya se disparó para ese grupo, el automático
   NO duplica — actualiza el existente (misma regla anti-duplicados de EST-18/EST-25).
   Verificar también el caso de los grupos N3 creados por continuación (EST-21): su
   tiquete ya nace con el grupo, así que este disparador de 2 semanas aplica solo a los
   que no tienen tiquete aún.
5. Correo a folletos en la creación y en la actualización (plantilla/baseLayout de los
   avisos de folletos existentes; criterio EMAIL_SILENT_MODE de avisos internos).
Tests: grupo N1 a 14 días del cierre genera tiquete con cantidad = cupo máximo; al abrir
se actualiza el mismo (no duplica); con tiquete manual previo no duplica; idempotente
(cron corre dos veces = un tiquete). tsc/lint/vitest.
```

### [x] FIN-9b · Congelamiento visible: el crédito se ve en el pago, el perfil y finanzas — HECHO 2026-10-27

Diagnóstico de los tres casos de SCJ (Raquel Ulate, Dennise Castañeda, Ana
María Murillo): los créditos existían y estaban bien atados al pago; lo que
faltaba era mostrarlos (hipótesis b). Nada que reparar en datos
(`docs/correcciones/2026-10-27-diagnostico-congelamiento-scj.json`). Lo
construido: `lib/finance/credito-visible.ts` (puro, con tests); el pago
congelado dice «Congelado → crédito a favor de ₡X (vence …)» en el detalle
de finanzas y en «Pagos y cobros» del perfil y de Mis pagos, con la línea
«Crédito a favor: ₡X (origen: …)» arriba; `/finanzas/saldos#creditos` lista
todos los créditos con estado derivado; y congelar avisa por campana a
finanzas y admin, no solo a la persona.

### [x] FIN-9c · El crédito vence con el bloque siguiente y, si no se usa, se corre — HECHO 2026-10-27

Decisión de Floriana (2026-10-27): todo crédito por congelamiento vence al
cierre de matrícula del bloque siguiente, y si llega a esa fecha sin usarse
NO se pierde: se corre al bloque que sigue (sin bloque cargado, un año más).

Datos: los cinco créditos del 7-oct vencían el 07/10/2027 por el respaldo de
12 meses (ese día no existía Bloque 1 2027); se alinearon al 22/01/2027 con
`scripts/creditos-2026-10-27/alinear-vencimiento.cjs` (respaldo en
`docs/correcciones/2026-10-27-creditos-vencimiento-bloque-1-2027.json`,
rastro en `audit_log`). Código: regla pura `tocaCorrerElCredito` en
`lib/finance/credito-por-congelar.ts` (3b); `correrCreditosSinUsar` en
`queries/creditos.ts`, dentro del barrido diario `payment-holds-expire`
(`?dry=1` lo simula; responde `creditos_corridos`); avisa a la persona
(«Tu crédito sigue guardado») y a finanzas por campana, y audita sin actor.
De paso: la fecha de vencimiento se mostraba un día corrida (recorte UTC de
un timestamp que es 23:59 de Costa Rica); ahora `diaEnCostaRica`.

### [x] FIN-9d · Saldos a favor y créditos congelados en UNA lista, con tipo y detalle — HECHO 2026-10-27

Pedido de Floriana: en `/finanzas/saldos` una sola tabla con columna «Tipo»
(Sobrante de matrícula / Matrícula congelada), origen, monto, estado,
generado y vence; los totales suman solo lo vigente de las dos fuentes y
«Personas con saldo» cuenta cada persona una vez. Clic en la fila (o «Ver
detalle») abre el detalle de su fuente: el de sobrante ya existía; el del
crédito muestra estado, vencimiento, motivo, link al pago de origen y a los
pagos de la persona. Excel con la columna Tipo. Lógica pura en
`lib/finance/saldos-unificados.ts` con tests; `id="creditos"` se conserva
para que las campanas a finanzas sigan aterrizando.

## Fase 31 — Reunión TI + Finanzas (2026-10-21, Andrés/Meli)

### [ ] FIN-14 · Informe de transparencia: reporte real para Hacienda (beneficiarios finales)

El "informe de transparencia" actual es genérico. El real es el reporte de
transferencias y beneficiarios finales que se sube a la plataforma de
Hacienda: Andrés recopila donantes, Mari los beneficiarios (ayuda social).
**Andrés pasa el reporte del año pasado como referencia del formato.**

Prompt para Claude Code (correr cuando Andrés pase el ejemplo):

```
FEATURE · Reporte de transparencia (Hacienda): donantes y beneficiarios finales

1. PARTE DONANTES: por rango de fechas y A PARTIR DE UN MONTO configurable (no todas las
   donaciones — confirmar el umbral con Andrés), listar: nombre completo, CÉDULA, monto
   total del período, y DIRECCIÓN (verificar si la ficha la tiene; si falta en muchos,
   reportar el hueco de datos). Export en el formato que calce con la plataforma de
   Hacienda (del ejemplo de Andrés).
2. PARTE BENEFICIARIOS: los datos de a quiénes se les dio (ayuda social) — diagnosticar
   qué existe hoy en el sistema para esto y reportar el gap (probablemente es un registro
   que aún no se lleva aquí: proponer el mínimo para llevarlo).
3. Dentro de finanzas (montos = confidencial, roles finanzas/direccion).
Tests + export verificado contra el ejemplo del año pasado. tsc/lint/vitest.
```

### [x] FIN-15 · Arreglos de pago: período de validez + fechas personalizadas

**Hecho el 2026-10-30** (`lib/finance/limites-de-arreglo.ts`). Estudios: lo
que cae dentro de la matrícula es el PACTO (`FUERA_DE_MATRICULA` si ya cerró);
los tractos pueden vencer después. Niveles (`study_plans.level = 'niveles'`)
sin amarre de fechas. Actividades igual que FIN-13. Tercera frecuencia
«personalizada» (una fecha por tracto, en orden; migración `20261030150000`),
en la cola de pagos y en «Ofrecer arreglo» de becas. La ruta de becas no
traducía los rechazos y respondía 500: ahora comparten `ERRORES_DE_LIMITES`.
Caso Macy = Meysi Arias Ledezma: no es bug; comprobante 21-oct → aprobado
23-oct → la solicitud pasa a «pendiente» = falta armar el grupo (el paso no
queda en el historial de la solicitud: detalle menor, no tocado). Al
2026-10-30 no hay ningún arreglo en producción.

Dos hallazgos en vivo (el arreglo de Floriana no se dejó crear):

Prompt para Claude Code:

```
FIX + MEJORA · Arreglos de pago: validación de fechas

1. BUG/REGLA: la validación actual exige que los tractos caigan dentro del período de
   matrícula — incorrecta en dos sentidos (decidido 2026-10-21):
   a) El arreglo se PACTA dentro de la matrícula, pero el ÚLTIMO tracto puede vencer
      después de que la matrícula cierre (la matrícula dura ~15 días; un arreglo que
      quepa entero ahí no tiene sentido). Para eventos sigue la regla FIN-13: todo pagado
      antes del inicio de la actividad.
   b) NIVELES no van por bloques: excepción para estudios tipo niveles (sin amarre al
      calendario de bloques).
2. TERCERA FRECUENCIA "PERSONALIZADA": además de quincenal/mensual, poder fijar la fecha
   de CADA tracto a mano (caso Meli: "el 20 le pago") — al elegir personalizada, un date
   picker por tracto.
3. Verificar el caso visto en vivo: pago de prematrimonial con comprobante subido que
   muestra "pendiente" (Macy) — diagnosticar si es por grupo sin abrir o bug de estado.
Tests: arreglo pactado en matrícula con tracto posterior al cierre se acepta; evento
rechaza tracto posterior al inicio; personalizada guarda fechas; niveles sin bloque.
tsc/lint/vitest.
```

### [x] PAG-7 · Pagar varios cobros de una vez — también con comprobante (antes de Tilopay)

**Hecho el 2026-10-30.** El lado de la persona ya existía desde PAG-5. Faltaba
finanzas: la cola marca «1 comprobante · N cobros · ₡total» y aprobar o
devolver ofrece (marcado por defecto) hacerlo con los N; un solo aviso a la
persona. Tilopay (una transacción por la suma, por moneda) queda para FIN-5.

Extiende PAG-5 (que era solo para Tilopay): la unificación se necesita YA con
comprobantes.

Prompt para Claude Code:

```
FEATURE · Mis pagos: seleccionar varios cobros pendientes y pagarlos con UN comprobante

En "Mis pagos pendientes": checkbox por cobro + botón "Pagar seleccionados juntos".
- HOY (comprobantes): sube UN comprobante que queda asociado a TODOS los cobros
  seleccionados (los cobros siguen siendo registros separados — no se fusionan; el
  comprobante los valida en conjunto y finanzas los aprueba de un solo en la revisión:
  agrupar en la cola los que comparten comprobante para aprobarlos juntos).
- MAÑANA (Tilopay/FIN-5): el mismo selector genera UNA transacción por la suma (por
  moneda — jamás mezclar monedas, INT-3).
- Caso típico: los tractos de un arreglo que la persona decide pagar de un solo (hoy se
  arregla a mano por detrás — eso desaparece).
Tests: un comprobante valida N cobros, aprobación conjunta, monedas separadas.
tsc/lint/vitest.
```

### [x] FIN-16 · Presupuestos de sedes: generalizar los adelantos de comida + mejoras de la demo

**Hecho el 2026-10-30** (migración `20261030160000`, `lib/finance/presupuestos-de-sedes.ts`).
Catálogo `sede_budget_types` (comida, bienvenida, desechables, ideas
especiales) administrable por finanzas, con los puestos que ven cada tipo
(vacío = todo el equipo de la sede). Presupuesto y mes por sede + tipo. Cada
mes = saldo del mes anterior (solo lo que sobró de un mes CERRADO; un
sobregiro no se arrastra) + depósito; al cerrar un mes, el siguiente abierto
recibe el sobrante. «Cargar depósitos» desde el Excel/CSV de Andrés con
dry-run (match exacto por nombre o código de sede; «Pedregal» solo no casa con
nada). «Ver detalle» con la foto de la factura. Selector de mes y año. Excel
con tipo, saldo anterior y depósito. Lo de producción quedó como «comida».

FIN-12 quedó construido como piloto de comida. Decidido con Meli: se
generaliza a "Presupuestos de sedes" con múltiples TIPOS de presupuesto.

Prompt para Claude Code:

```
MEJORAS · De "Adelantos de comida" a "Presupuestos de sedes"

1. GENERALIZAR: el módulo pasa a manejar varios TIPOS de presupuesto por sede — comida,
   bienvenida, desechables, ideas especiales… (catálogo administrable por finanzas).
   Cada tipo con su presupuesto mensual por sede. El acceso sigue por ROL/puesto de la
   sede (como el check-in): el colaborador ve solo su sede y sus tipos.
2. IMPORTAR PRESUPUESTOS DESDE EL EXCEL DE ANDRÉS: botón para cargar el archivo de
   control (nombre de sede + monto depositado del mes) y fijar los presupuestos del mes
   de un solo — match por nombre de sede, dry-run con diferencias.
3. DOS LÍNEAS VISIBLES al abrir el mes: "saldo del mes anterior: ₡X" + "depósito del
   mes: ₡Y" = presupuesto total disponible (pedido de Andrés — así queda claro por qué
   se depositó menos cuando sobró).
4. FOTO DE LA FACTURA: adjuntarla al registrar (mecanismo de comprobantes) y botón "ver
   detalle" con la imagen en cada factura de la lista — Andrés deja de buscar números de
   factura en el correo.
5. SELECTOR DE MES: lista simple "mes + año" (el control actual es poco usable), pensado
   para varios años.
6. Export XLSX ya existe — verificar que incluya los campos nuevos.
Tests: tipos múltiples por sede, acceso por sede/tipo, import con dry-run, saldo
arrastrado. tsc/lint/vitest.
```

### Notas que actualizan ítems existentes (2026-10-21):
- **FIN-11 (viáticos)**: la página preliminar ya existe ("nuevo viaje" para
  empleados/freelancers). Pendiente de esa reunión: la APROBACIÓN DEL JEFE
  dentro del sistema (cada empleado con jefe asignado; al enviar, el jefe
  recibe y aprueba/devuelve; aprobado → pasa a la lista de pago de finanzas) —
  reemplaza el "adjuntar correo de aprobación". Y el de KILOMETRAJE es el
  siguiente (ya vigente en papel, mismo flujo). Bloqueado por tener EMPLEADOS
  poblados (hoy la tabla está vacía — nadie puede llenar viáticos).
- **EMP-1 (empleados)**: sumar al inventario (a) COMPROBANTES DE PAGO self-service:
  Andrés carga la planilla con un formato definido y el sistema genera los
  comprobantes; cada empleado descarga los suyos desde su cuenta (login = la
  clave; Andrés/Lucy con acceso total, dirección NO ve comprobantes); aparte,
  carta de constancia salarial generable por RRHH. (b) VACACIONES confirmado
  el flujo: empleado solicita → jefe aprueba → finanzas rebaja los días; hoy
  se lleva en Excel y "ya no podemos seguir así" (Meli). La reunión de alcance
  con dirección/Lucy sigue pendiente, pero estos dos van fijos.

### [x] EVE-14 · Inscripciones sin ficha: vincular a miembros existentes + totales reales — URGENTE (evento de matrimonios este sábado)

**Hecho el 2026-10-30** (sobre FRM-9 y EVE-15 del 29): PARTE 1 — el candidato
se propone por cédula exacta, correo exacto, teléfono (últimos 8 dígitos) y
nombre exacto, en ese orden (`lib/forms/vinculo-de-respuesta.ts`; cédula y
teléfono solo cuando el formulario los capturó en `personal_data` — el link
público hoy guarda nombre y correo); «Buscar su ficha…» con el buscador de
miembros; y «Crear ficha nueva» (`POST …/crear-ficha`): propone nombre y
apellidos desde lo escrito, crea la ficha con el correo del link SIN correo de
bienvenida, la vincula y crea la inscripción (si el correo ya es de alguien,
vincula a esa ficha en vez de duplicar). PARTE 2 — `events.personas_por_inscripcion`
(migración `20261030120000`, 1 por default, Matrimonios = 2) configurable en
crear/editar evento; el encabezado y la pestaña dicen «X inscripciones · ~N·X
asistentes (A con ficha + B por el link sin ficha)» y la ocupación se mide en
personas. PARTE 3 (asociar desde el origen por correo/cédula sin revelar
datos) queda para después.

Caso en prod: 13 inscripciones con ficha y 39 "sin ficha" (gente que se
inscribió sin loguearse), varias de personas que SÍ existen en el padrón. Y el
evento es por PAREJA: el total real de asistentes es ×2.

Prompt para Claude Code:

```
FIX + FEATURE · Inscripciones de eventos sin login: vinculación y conteos — ANTES DEL
SÁBADO (evento de matrimonios)

PARTE 1 — VINCULACIÓN ASISTIDA (la urgente):
1. MATCH AUTOMÁTICO PROPUESTO: para cada inscripción sin ficha, buscar miembro existente
   por CÉDULA (exacta), EMAIL (exacto, normalizado) o TELÉFONO (normalizado) — en ese
   orden de confianza. El patrón de DON-1: match evidente se propone, nunca se aplica
   solo si hay ambigüedad.
2. UI en la lista de inscripciones del evento: las "sin ficha" muestran el candidato
   detectado ("¿Es María Rojas, cédula 1-xxx?") con botón "Vincular" (y selector manual
   con el buscador de miembros para las no evidentes — MemberCombobox). Al vincular, la
   inscripción queda asociada al member_id (y el pago/check-in posterior le queda en su
   historial). Rol: quienes gestionan el evento + admin.
3. Si NO existe en el padrón: botón "Crear ficha desde la inscripción" (reutilizar el
   flujo de crear miembro desde check-in) — así el sábado el check-in los encuentra.
4. Todo al audit_log; sin correos.

PARTE 2 — CONTEOS REALES:
1. El resumen del evento muestra el TOTAL unificado (con ficha + sin ficha) además del
   desglose, y por TIPO de inscripción.
2. INSCRIPCIÓN POR PAREJA: si el tipo de inscripción cubre a N personas (pareja = 2), el
   resumen muestra "X inscripciones · ~2X asistentes" — el multiplicador sale del tipo
   de inscripción del evento (configurable, no hardcodear "pareja"). Revisar que
   check-in/capacidad usen el número correcto (una inscripción de pareja = 2 campos).

PARTE 3 — PREVENIR: en el formulario público de inscripción, si el email/cédula tecleado
coincide con un miembro existente, asociar la inscripción a esa ficha desde el origen
(sin revelar datos: la asociación es interna). Así "sin ficha" queda solo para gente
realmente nueva.
Tests: match por cédula/email/teléfono, ambiguo no se auto-vincula, conteo por pareja,
asociación en origen. tsc/lint/vitest. PARTE 1 Y 2 ANTES DEL SÁBADO; la 3 puede ir
después.
```

### [x] EVE-15 · Check-in de eventos con inscripción: alertar no-inscritos y check-in de invitados sin ficha (pedido 2026-10-29, ideal antes del sábado)

Complementa EVE-14, para la puerta del evento.

**Hecho el 2026-10-29** (migración `20261029150000`, `lib/events/puerta-con-inscripcion.ts`):
alerta fuerte de «NO está inscrito/a» con «Dejar pasar sin inscripción» (flag
`event_checkins.sin_inscripcion`, lo calcula el servidor; en evento pago siguen
los dos caminos del cobro en sitio), el buscador de la puerta encuentra a los
inscritos por el link sin ficha y los marca contra su respuesta
(`form_checkins.form_response_id`), sugerencia de vínculo con UNA ficha del
mismo nombre (PATCH `guest-responses`: liga la respuesta, crea la inscripción
`pending` sin correo y el disparador pasa el check-in a la persona), conteos
en vivo «X de Y inscritos presentes · Z sin inscripción», tarjeta «Llegaron
sin inscripción» en el tab Check-in del evento y columna «Inscripción» en el
CSV. Queda para EVE-14: el match asistido por cédula/correo/teléfono y los
totales por tipo de inscripción (pareja).

### [x] FRM-9 · Respuestas sin ficha: vincular a una persona del padrón (pedido 2026-10-29)

**Hecho el 2026-10-29.** En la pantalla de respuestas de cualquier formulario
y en la pestaña Inscripciones del evento, la tarjeta «Por el link público, sin
ficha» propone UNA ficha por correo exacto (o, si no, por nombre exacto) con
«Sí, vincular», y ofrece el buscador de miembros para el resto («Buscar su
ficha…» / «Es otra persona…»). Rutas: `GET /api/forms/[id]/responses/sin-ficha`
y `PATCH /api/forms/[id]/responses/[responseId]`, con el mismo permiso que
leer las respuestas (`lib/auth/respuestas-guard.ts`). Al vincular: la
respuesta pasa a la ficha, se crea la inscripción por el MISMO camino que una
respuesta con ficha (`linkResponseToRegistration`: pagada si adjuntó comprobante,
si no pendiente; sin correo) en el evento cuyo formulario de inscripción es ese, el disparador EVE-15 pasa
el check-in del invitado a la persona, y queda en audit_log. Medido en prod:
25 de las 29 respuestas de Matrimonios tienen UNA ficha con el mismo correo.
Cubre la parte 1 de EVE-14 salvo el match por teléfono y «crear ficha desde la
inscripción».

Prompt para Claude Code:

```
FEATURE · Check-in en eventos que requieren inscripción: estado de inscripción visible

En eventos con "requiere inscripción", la puerta debe saber al instante quién viene
inscrito y quién no:

1. ALERTA DE NO INSCRITO: al hacer check-in de alguien que NO tiene inscripción al
   evento, el panel lo dice fuerte y claro ("⚠️ [Nombre] NO está inscrita a este evento")
   — el check-in NO se bloquea (la puerta decide dejarla pasar), pero queda la marca
   visible y el registro lleva un flag "sin inscripción" para que el equipo del evento
   maneje aparte el pago. Estos salen en una lista/tab del evento ("llegaron sin
   inscripción") con conteo.
2. INSCRITO CON FICHA: lo normal — al seleccionarlo, confirmación de que está inscrito
   (y su tipo de inscripción: pareja, etc.).
3. INSCRITO SIN FICHA (el caso EVE-14): la BÚSQUEDA del check-in debe encontrar también
   a los inscritos sin ficha (buscar sobre las inscripciones del evento por nombre), y
   permitir hacerles CHECK-IN COMO INVITADOS contra la inscripción misma — sin exigir
   crear/asociar ficha en la fila. El check-in queda vinculado a esa inscripción (la
   misma persona que se inscribió es la que llegó); si después se vincula la ficha
   (EVE-14), el check-in viaja con ella.
   - Si hay un miembro con el mismo nombre+apellido, mostrar la sugerencia de vínculo
     (un toque, patrón EVE-14) pero NO obligar — la fila no se detiene.
4. CONTEOS de la puerta: inscritos presentes / inscritos ausentes / llegaron sin
   inscripción — en vivo, para el equipo del evento.
Server-side como siempre (requireEventAccess de la puerta); los invitados sin ficha no
crean members fantasma. Tests: alerta de no inscrito (check-in procede con flag),
check-in de invitado contra inscripción, vínculo posterior arrastra el check-in, conteos.
tsc/lint/vitest.
```

### [x] EST-31 · Continuación N2→N3: avisos al dirigente y tiquete de folletos con continuación (pedido 2026-10-29)

**Hecho el 2026-10-29** (`lib/studies/continuacion-n3.ts`, cableado en
`queries/folletos.ts`, el cron `group-enrollment-windows` y `email/close-summary.ts`):
(1) el resumen del cierre al dirigente dice que los folletos ya se mandaron a
imprimir y hasta cuándo queda el grupo en matrícula; (2) el tiquete de cierre
del sucesor en matrícula nace con la nota «⚠️ EN MATRÍCULA hasta el … habrá una
actualización al cierre. Cantidad inicial = N aprobados», visible en el tiquete
y en el correo a folletos (la nota ya se renderiza); (3) y (4) un día después
del fin de la ventana el cron actualiza el MISMO tiquete con el total final y
la nota «Cierre de matrícula (fecha): … CONTINUACIÓN: +N folletos adicionales»
o «Sin cambios, cantidad final confirmada», y manda el correo a folletos;
(5) correo al dirigente SOLO si entró alguien después del tiquete, con los
nombres y el pedido de sumarlos al chat. Idempotente por la marca en la nota.

Lo que ya existe (verificado): el check obligatorio de "¿continúa a N3?" en el
cierre de N2, el grupo sucesor con los aprobados y la matrícula abierta. Lo
nuevo: el circuito de avisos y la actualización/continuación del tiquete.

Prompt para Claude Code:

```
FEATURE · Continuación N2→N3 (esquema de bloques): avisos y tiquete de folletos en dos
tiempos

AL CREARSE EL GRUPO N3 POR CONTINUACIÓN (dirigente dijo sí en el cierre):
1. CORREO AL DIRIGENTE confirmando: "Tu grupo de Nivel 3-4 quedó creado con N estudiantes
   (los que aprobaron Nivel 2). Ya mandamos a imprimir sus folletos. El grupo queda en
   matrícula ~2 semanas y pueden sumarse más personas."
2. TIQUETE DE FOLLETOS a Denise (ya se genera — verificar) CON NOTA VISIBLE en el tiquete
   y en su correo: "⚠️ Este grupo queda EN MATRÍCULA hasta el [fecha]: potencialmente se
   matricularán más personas — habrá una actualización al cierre." Cantidad inicial =
   los aprobados de N2.

AL CERRARSE LA MATRÍCULA DEL N3 (pasa a por-iniciar, EST-21):
3. ACTUALIZAR EL MISMO TIQUETE con el total final (patrón EST-30: historial inicial →
   final visible) y correo de actualización a Denise.
4. SI ENTRARON MÁS personas después del tiquete inicial: la actualización dice explícito
   "CONTINUACIÓN: este grupo necesita +N folletos adicionales" (los ya mandados a
   imprimir no se repiten — el delta claro para que Denise imprima solo lo que falta).
   Si no entró nadie: "sin cambios, cantidad final confirmada".
5. CORREO AL DIRIGENTE con el resultado de la matrícula: "Se matricularon N personas más:
   [nombres]. Por favor asegurate de AGREGARLAS AL CHAT DE WHATSAPP del grupo." (Si no
   entró nadie, no se le manda nada — cero ruido.)
Correos internos/operativos con baseLayout y criterio EMAIL_SILENT_MODE de siempre.
Idempotente (el cierre de ventana corre una vez; re-corridas no duplican correos ni
deltas). Tests: nota de matrícula abierta en el tiquete, delta correcto (+N), sin
cambios no genera correo al dirigente, historial del tiquete. tsc/lint/vitest.
```

### [x] COM-5 · Boletín mensual: botón "Cambiar imagen" sin tocar código (pedido 2026-10-29)

**Hecho el 2026-10-29** (`lib/communications/ranuras-de-imagen.ts`,
`components/communications/ImagenesDePlantilla.tsx`): la imagen reemplazable se
marca con `data-imagen-slot="nombre"`; en «Editar plantilla» aparece la tarjeta
«Imágenes de esta plantilla» con vista previa, tamaño recomendado (el `width`
de la imagen) y «Cambiar imagen» (JPG/PNG ≤ 2 MB → bucket público
`email-images` → reemplaza SOLO el `src` de esa etiqueta; el resto del HTML
byte-idéntico, nada pasa por TipTap). La vista previa se actualiza sola y el
guardado es el de siempre. Sin ranuras no aparece. La imagen del «Boletín
mensual» quedó marcada en prod (script `com5-2026-10-29`, respaldo en
docs/correcciones). Documentado en la guía «Plantillas de correo y el editor».
Nota de entorno: en staging no existía el bucket `email-images`; se creó.

Quien arma el boletín cada mes no sabe de código, y abrir la plantilla en el
editor arriesga el formato (el gotcha conocido de TipTap que aplana el HTML
avanzado). Se necesita reemplazar la imagen del cuerpo adjuntando una nueva,
sin editar HTML.

Prompt para Claude Code:

```
FEATURE · Plantillas de correo: imagen reemplazable sin editar el HTML

PROBLEMA: la plantilla del boletín mensual es HTML avanzado; cambiar la imagen del body
requiere editar código, y abrirla en TipTap aplana el formato (gotcha conocido,
isAdvancedHtml). La persona que lo hace cada mes no es técnica.

DISEÑO — "ranuras de imagen" en las plantillas:
1. En el HTML de la plantilla, la imagen reemplazable se marca con un atributo
   (ej. data-imagen-slot="principal") — marcar así la imagen del boletín actual.
2. En la pantalla de la plantilla/comunicación, si el HTML tiene ranuras, mostrar un
   panel "Imágenes de esta plantilla" con la vista previa de cada ranura y un botón
   "Cambiar imagen": file picker → sube a Supabase Storage (el bucket/patrón de hosting
   de imágenes de correo que ya usamos para las miniaturas del campa: público, URL
   estable) → reemplaza SOLO el src de esa ranura en el HTML, sin pasar por TipTap y sin
   tocar nada más del markup. Validar tipo (jpg/png) y avisar el tamaño recomendado (el
   ancho de la imagen actual, ej. 600px).
3. Vista previa renderizada del correo después del cambio, para confirmar antes de
   guardar.
4. Guardado con el guardarraíl de HTML avanzado existente (el HTML no se re-procesa).
5. Funciona para cualquier plantilla con ranuras (no hardcodear "boletín") — documentar
   en el centro de ayuda interno cómo marcar una ranura al crear plantillas.
Permisos: los mismos que editan plantillas (comunicaciones/admin).
Tests: reemplazo cambia solo el src, el resto del HTML byte-idéntico; plantilla sin
ranuras no muestra el panel; upload validado. tsc/lint/vitest.
```

### [x] FRM-8 · Editor de formularios: enlace a las respuestas (pedido 2026-10-30)

**Hecho el 2026-10-30.** En la barra del editor, «Ver respuestas (N)» con el
conteo, solo si esta persona puede verlas: lo contesta el servidor en
`GET /api/forms/[id]?export_access=1` (`export_access.respuestas`) con la misma
regla que las rutas de respuestas (`puedeVerRespuestas`, en el guard). El
camino inverso ya existía: «Editar formulario» en la pantalla de respuestas,
con el permiso de edición del módulo.

Prompt para Claude Code:

```
MEJORA CHICA · Al editar un formulario, acceso directo a sus respuestas

En la pantalla de edición de un formulario, agregar en el encabezado un enlace/botón
"Ver respuestas (N)" — con el conteo — que lleve a la vista de respuestas de ESE
formulario. Y verificar el camino inverso: desde las respuestas, volver a editar el
formulario en un clic. Mismo gate de permisos que ya tiene cada vista (editar y ver
respuestas pueden tener roles distintos: el enlace solo se muestra si el usuario puede
ver respuestas). Test: enlace presente con permiso, ausente sin él. tsc/lint.
```

### [x] PAR-8 · Búsqueda de miembros: los filtros sobreviven al "atrás" + botón limpiar (pedido 2026-10-30)

**Hecho el 2026-10-30** (`lib/members/filtros-en-url.ts`). La búsqueda y los
chips ya vivían en la URL; ahora también las condiciones avanzadas, grupos y
operadores, en `?f=` (JSON en base64url). Si pasa de 1.800 caracteres va a
sessionStorage y la URL lleva `?fk=` con una clave corta. El hook
`useMemberFilters` se hidrata desde la URL; si la URL cambia desde afuera
(menú, enlace) se recarga. El perfil muestra «Volver a los resultados» con la
última URL de /miembros (además del «atrás»). «Limpiar todo» pasó a «Limpiar
filtros (N)» y deja la URL limpia. Las listas guardadas no cambian: viven en
/miembros/listas/[id], con su propia URL. Probado: atrás, refresh y limpiar.

Caso: filtrás el padrón, abrís un perfil, volvés con "atrás" — y los filtros
desaparecieron. Hay que rearmarlos cada vez.

Prompt para Claude Code:

```
FIX UX · /miembros: preservar los filtros al navegar + "Limpiar filtros"

1. FILTROS EN LA URL: el estado completo de los filtros activos (condiciones, búsqueda,
   columnas si aplica, página/orden) se serializa en query params de /miembros — el
   patrón que ya usamos en reportes (?semana=, ?comite=): el "atrás" del navegador
   restaura la búsqueda exacta, el enlace se puede compartir, y un refresh no pierde
   nada. Si el set de condiciones es muy largo para la URL, usar una clave corta con el
   estado en sessionStorage como respaldo — pero la URL es la opción preferida (los
   enlaces compartibles valen oro con las listas guardadas).
2. Al abrir un PERFIL desde los resultados, el link de regreso/breadcrumb vuelve a
   /miembros con los mismos params (además del "atrás" nativo).
3. BOTÓN "LIMPIAR FILTROS": visible cuando hay al menos un filtro activo, con el conteo
   ("Limpiar filtros (3)") — un clic deja la búsqueda vacía (y la URL limpia).
4. OJO: las listas guardadas existentes no cambian — esto es el estado efímero de la
   sesión; verificar que abrir una lista guardada siga funcionando y se refleje en la
   URL también.
Tests: atrás restaura filtros, refresh conserva, limpiar vacía, lista guardada → URL.
tsc/lint/vitest.
```

### [x] PAR-9 · Listas guardadas: editar el filtro con el que se crearon (pedido 2026-10-30)

**Hecho el 2026-10-30** (`lib/members/editar-lista.ts`). Diagnóstico en
producción: 17 listas; 13 con filtro completo (`v: 2`) y 4 fijas sin filtro
(importadas o armadas a mano). Las usan comunicaciones (el cron recalcula la
lista al enviar un programado, por `recipient_filter.list_id`), el listado y el
detalle. «Editar filtros» abre /miembros con la búsqueda exacta en la URL
(patrón PAR-8, más `?lista=`); al guardar se elige «Actualizar» (PATCH al mismo
id, el servidor recalcula la membresía) o «Guardar como nueva» (POST, la
original no se toca). Si un comunicado programado usa la lista, se avisa y se
pide confirmar. Las fijas ofrecen «Agregar o quitar personas» (el PATCH lo
rechaza en listas con filtro: el recálculo lo borraría). Renombrar y
descripción desde el listado y el detalle. El detalle muestra quién la creó y
la última edición (de `audit_log`). Permisos: los roles que gestionan listas o
quien la creó; `created_by` no se guardaba y ahora sí. Cada cambio va a
`audit_log`. De paso: «Actualizar snapshot» del listado solo cambiaba una
fecha y ahora recalcula de verdad.

Hoy una lista guardada no se puede ajustar: si el filtro necesita un cambio,
hay que crearla de nuevo (y perder su nombre/uso en comunicaciones).

Prompt para Claude Code:

```
FEATURE · Listas guardadas: editar sus filtros

ETAPA 1 — DIAGNÓSTICO (reportar antes de construir):
1. ¿Qué guarda hoy una lista guardada: la DEFINICIÓN del filtro (dinámica, se recalcula
   al abrirla) o una FOTO de los miembros (estática)? ¿O hay de los dos tipos (ej. las
   importadas desde Excel, como "Servidores — agosto 2026", son estáticas)?
2. ¿Dónde se usan las listas? (audiencias de comunicaciones, envíos programados,
   exports…) — censar consumidores.

ETAPA 2 — EDITAR:
1. Listas DINÁMICAS (con filtro): botón "Editar filtros" en la lista → abre /miembros con
   sus condiciones cargadas (en la URL, patrón PAR-8), el usuario ajusta, y al guardar
   elige "Actualizar esta lista" (mismo id, mismo nombre — sigue funcionando en todo lo
   que la usa) o "Guardar como lista nueva". También renombrar y editar descripción.
2. Listas ESTÁTICAS (foto de miembros): no tienen filtro que editar — ofrecer "Agregar o
   quitar personas" manualmente (buscador de miembros) en lugar de editar filtros, y
   dejarlo claro en la UI ("Esta lista es fija: se armó con personas específicas").
3. AVISO DE IMPACTO al guardar cambios: si la lista es audiencia de un envío PROGRAMADO o
   en uso, mostrar "Esta lista se usa en: [comunicación X programada para el …] — el
   cambio afectará a quién le llega" y pedir confirmación.
4. Mostrar en la lista: última edición (quién/cuándo) y el conteo actual de miembros
   antes y después del cambio en la vista previa.
5. Permisos: quien creó la lista + los roles que hoy gestionan listas; audit_log de
   cada cambio de filtro.
Tests: editar filtro conserva id y uso en comunicaciones, guardar como nueva no toca la
original, estática ofrece agregar/quitar, aviso de impacto con envío programado.
tsc/lint/vitest.
```

## FIN-5 · Tilopay — DISEÑO DE INTEGRACIÓN (2026-10-30, acceso ya obtenido)

Fuente: colección Postman oficial de Tilopay (API v1). Camino elegido:
**Hosted payment page** (ninguna tarjeta toca nuestro servidor).

### Lo que dice la API (endpoints relevantes)
- `POST {{url}}/api/v1/login` — apiuser + password (del panel
  admin.tilopay.com/admin/checkout) → bearer token con `expires_in`.
- `POST /api/v1/processPayment` — key, amount, currency, orderNumber,
  capture=1, billTo*, `redirect` (nuestra URL de regreso, GET), `returnData`
  (string base64 que nos devuelven tal cual), hashVersion (V1/V2),
  subscription=0, platform → responde `type 100` + `url` de la página de pago
  de Tilopay a la que redirigimos al usuario.
- Regreso: Tilopay redirige por **GET** a nuestro `redirect` con
  `code` (1 = aprobada), description, auth, order, tpt, OrderHash, returnData.
- `POST /api/v1/consult` — key + orderNumber → monto procesado y estado REAL.
- `POST /api/v1/processModification` — type 1 captura / **2 devolución** /
  3 reversa, por orderNumber y monto.
- `POST /api/v1/consultTransactions` — transacciones por rango de fechas.
- (Tokenización, pagos recurrentes y planes existen — no se usan en fase 1;
  candidatos futuros para donaciones mensuales.)
- En esta colección NO aparecen webhooks (la doc nueva de developers sí los
  menciona — preguntarle a Tilopay).

### Principios de diseño (no negociables)
1. **El regreso por GET NO es prueba de pago**: viaja por el navegador y se
   puede falsificar. Al recibirlo, el SERVIDOR llama `consult` con el
   orderNumber y solo marca el cobro como cancelado si Tilopay confirma
   aprobado Y el monto coincide. (Además, pedir a Tilopay activar la
   verificación de OrderHash V2 como segunda capa.)
2. **Un intento = un orderNumber único** (tabla de intentos de pago que
   referencia uno o varios cobros). Idempotente: el mismo regreso procesado
   dos veces no aplica dos veces.
3. **El que cierra el navegador**: cron de conciliación que toma los intentos
   pendientes de más de N minutos y los resuelve con `consult` (y, si Tilopay
   habilita webhooks, se suman como señal adicional — nunca única).
4. **Credenciales solo en servidor** (Vercel Secret, Production; sandbox
   aparte). Pruebas y producción comparten host: lo que distingue son las
   credenciales — jamás mezclar.
5. **Una moneda por transacción** (INT-3): el pago múltiple suma por moneda.

### Fases (cada una un prompt)
- **F1 — Núcleo en staging/sandbox**: cliente Tilopay (token con caché),
  tabla de intentos, `processPayment` + redirect, endpoint de regreso con
  verificación `consult`, aplicado a UN flujo: matrícula de estudios. Botón
  "Pagar en línea" junto a "Subir comprobante".
- **F2 — Robustez**: cron de conciliación de intentos abandonados, manejo de
  errores (300/400/402/403) con mensajes humanos, reintentos, check de
  Healthchecks del cron, logs/auditoría.
- **F3 — Extender**: inscripciones a eventos, tractos de arreglos de pago,
  pago múltiple (PAG-5/PAG-7 con un orderNumber por varios cobros).
- **F4 — Devoluciones y conciliación**: `processModification` type 2 desde la
  pantalla de devoluciones existente; reporte para Andrés con
  `consultTransactions` por rango (cruce con PAG-6 y las liquidaciones de
  Tilopay, que vienen netas de comisión y retenciones).
- **F5 — Producción**: credenciales prod, prueba real de bajo monto,
  decisión sobre el comprobante manual (convive o se retira), anuncio.
  Meta: fiesta de Navidad.

### Pendientes de decisión / preguntas a Tilopay
- ¿URL base del ambiente de pruebas y credenciales sandbox? ¿tarjetas de prueba?
- ¿Webhooks disponibles para esta cuenta? ¿Activar OrderHash V2?
- ¿SINPE Móvil aparece en la página hospedada por defecto?
- ~~¿Comisión?~~ **DECIDIDO 2026-10-30: se SUMA al precio, siempre.** Ojo de
  diseño: el método (tarjeta 4.25%+$0.35 vs SINPE 2%+$0.35) se elige DENTRO de
  la página de Tilopay, después de que mandamos el monto — no sabemos de
  antemano cuál comisión aplica. Propuesta: cargo por pago en línea calculado
  con la tarifa de TARJETA (la mayor), mostrado desglosado antes de pagar
  ("Matrícula ₡5.000 + cargo por pago en línea ₡392 = ₡5.392"); quien paga
  por comprobante no paga cargo. Constante configurable. Confirmar con
  Tilopay/Meli que cobrar recargo al cliente está permitido (algunas reglas
  de marcas de tarjeta lo restringen).
- ~~¿Comprobante?~~ **DECIDIDO 2026-10-30: se mantiene por ahora**, y se
  vuelve CONFIGURABLE por estudio/grupo y por evento: al crearlo se elige
  "Métodos de pago: Tilopay · Comprobante · Ambos" (default: Ambos). La
  pantalla de pago solo ofrece lo habilitado. Va dentro de F1 (campo + UI) —
  así cada actividad decide, y el día que se quiera retirar el comprobante es
  cambiar el default.

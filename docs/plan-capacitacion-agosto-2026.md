# Plan de agosto 2026 — staging, capacitación y apertura

> Dos frentes en paralelo: (a) montar un ambiente de staging para dejar de trabajar en
> producción, y (b) enseñar el sistema por oleadas. El entregable más importante del mes es
> **la página de ayuda con sus infografías y tutoriales**.
>
> Estado del desarrollo al 29 de julio: **todo el plan de mejoras está implementado** salvo
> la Fase 0 (operativo) y MNT-1 (squash de migraciones). O sea: agosto es de estabilizar,
> documentar y enseñar — no de construir features.
>
> **Decisión 2026-07-29: no hay correo masivo de cambio de plataforma (AUTH-2).** Las
> instrucciones para entrar por primera vez viajan dentro de los correos de **invitación a
> estudios e inscripciones**. Mejor así: llegan con un motivo concreto para entrar, en
> tandas naturales, y evitan la ola de consultas de un envío a 23 000 personas de golpe.
> Requisito: las tres plantillas de invitación (COM-2, ya listas) llevan el bloque "¿Primera
> vez que entrás al sistema?" con el paso a paso y el link a `/ayuda`.

---

## Calendario

| Semana | Fechas | Entrenamiento (a quién) | Foco de la semana | Desarrollo |
|---|---|---|---|---|
| **0** | jue 30 jul – dom 2 ago | — (preparación) | Montar staging · escribir los 5 tutoriales base | Sí (staging + ayuda) |
| **1** | **lun 3 ago** – dom 9 | 🚀 **Staff y usuarios clave** — sesión en vivo 45 min, lun 3 | Uso real · documentar las preguntas que llegan | Sí, ya en staging |
| **2** | lun 10 – dom 16 | *Nadie nuevo* — el staff prueba solo con guía escrita | **Floriana fuera · SOLO PRUEBAS, cero desarrollo** | ❌ Congelado |
| **3** | **lun 17** – dom 23 | 🚀 **Servidores y encargados de comités** — sesión en vivo, lun 17 | Arreglar lo reportado en la semana de pruebas | Sí (arreglos) |
| **4** | lun 24 – dom 30 | *Refuerzo* al staff y comités según dudas · nada nuevo | Tutoriales de miembro · preparar tandas de invitación | Sí (solo ajustes) |
| **5** | **lun 31 ago** | 🚀 **Miembros / estudiantes** — sin sesión en vivo: aprenden por correo + `/ayuda` | Invitaciones a inscripción de estudios, por tandas | Congelado ese día |

**Ojo con la oleada 3:** los miembros son los únicos que no reciben capacitación en vivo — son
~23 000 personas. Su "entrenamiento" es el paso a paso dentro del correo de invitación más los
5 tutoriales de `/ayuda`. Por eso esos tutoriales tienen que estar impecables y con capturas de
celular antes del 31.

La semana 2 es una restricción dura: si no hay quien desarrolle, **no se puede desplegar
nada a producción**. Eso obliga a que todo lo que el staff necesite esté estable el viernes
7 de agosto. Es una buena restricción: fuerza un corte limpio y una semana entera de pruebas
reales antes de abrir a más gente.

---

## Prioridad 1 · Ambiente de staging (esta semana, antes del lunes 3)

Hoy todo se trabaja en producción. Con usuarios reales entrando el lunes, eso deja de ser
viable: un cambio a medias rompe la operación de alguien en vivo.

Prompt para Claude Code:

```
Montar un ambiente de STAGING separado de producción. Hoy todo el desarrollo se hace
directo en prod y a partir del 3 de agosto entran usuarios reales, así que hay que separar.
Contexto: Next.js en Vercel + Supabase (Postgres, Auth, Storage) + AWS SES + crons en
vercel.json. Entregá:
1) Proyecto de Supabase nuevo para staging con el esquema aplicado desde las migraciones
   del repo (verificá que las migraciones levanten una BD de cero — si algo falla, es señal
   de que hay cambios hechos a mano en prod que no están en migraciones: reportámelos).
   Crear también los buckets de Storage que no viven en migraciones: payment-receipts,
   employee-docs, email-images, event-flyers.
2) Datos de prueba: NO copiar producción con datos reales de 23 000 personas. Generá un
   seed con datos ficticios representativos (unas decenas de miembros, grupos, eventos,
   pagos, becas) que cubra los flujos que vamos a probar. Si hace falta un subconjunto de
   datos reales para una prueba puntual, anonimizarlo (nombres, cédulas, correos, teléfonos).
3) Deploy de staging en Vercel: branch `staging` → deploy propio con sus env vars apuntando
   al Supabase de staging. Documentá qué env var cambia entre ambientes.
4) SEGURIDAD DEL CORREO EN STAGING (crítico): staging NO puede mandar correos a personas
   reales. Configurá SES en modo sandbox o una variable tipo EMAIL_SAFE_MODE que redirija
   todos los envíos a una casilla de prueba, y dejá un guard en el código de envío que
   falle ruidosamente si detecta que está en staging con destinatarios reales.
5) Crons: desactivarlos en staging o dejarlos apuntando solo a datos de staging (un cron de
   recordatorios de pago que corra contra datos reales desde staging sería un desastre).
6) Flujo de trabajo documentado en el README: desarrollo → staging → prod, cómo promover un
   cambio, y cómo correr las migraciones en cada ambiente.
7) Env vars de Supabase también en los deploys Preview de Vercel (hoy solo están en
   Production y los previews fallan — es un pendiente conocido de la Fase 0).
Reportá qué quedó pendiente de configurar a mano en los dashboards de Vercel y Supabase.
```

**Además, esta semana (Fase 0, sin código):** configurar SMTP propio en Supabase Auth (lo
necesita el correo masivo de la semana 4), Sentry, y las env de healthchecks.

---

## Prioridad 2 · Página de ayuda `/ayuda`

Es el entregable más importante del mes, porque es lo que hace que la capacitación escale
sin vos. **Público por capas:** el tutorial de "crear mi contraseña" no puede estar detrás
del login — quien no puede entrar no podría leerlo — y los correos de invitación a estudios
van a linkear ahí desde el celular de gente sin sesión.

| Capa | Quién entra | Contenido |
|---|---|---|
| **Pública** (sin sesión) | Cualquiera con el link | Primeros pasos + todo lo de miembro |
| **Interna** (con sesión, por rol) | Staff y comités | Estudios, servidores, finanzas, comunicaciones |

Prompt para Claude Code:

```
Crear un centro de ayuda con contenido en archivos Markdown, con dos niveles de acceso:
1) PÚBLICO: /ayuda como ruta pública (agregar a PUBLIC_PREFIXES del proxy, junto a
   /calendario y /vacantes). Muestra las secciones marcadas como públicas: "Primeros pasos"
   y los tutoriales de miembro. Debe abrir sin sesión porque los correos de invitación a
   estudios/inscripciones van a linkear ahí, y el tutorial de crear contraseña se lee ANTES
   de poder entrar. Poner también un link a /ayuda en la página de login.
2) INTERNO: los tutoriales de gestión (estudios, servidores, finanzas, comunicaciones) solo
   con sesión y FILTRADOS POR ROL — cada persona ve los de los módulos a los que tiene
   acceso, usando el mismo can()/permisos de roles.ts que usa el sidebar. Con sesión
   iniciada, el índice muestra las dos capas juntas.
3) Contenido en archivos .md en el repo (content/ayuda/*.md) con frontmatter: titulo,
   seccion, visibilidad (publica | roles: [...]), orden. Imágenes en public/ayuda/.
   Sin tabla de base de datos: se edita con un commit.
4) Mobile-first: la mayoría entra desde el celular. Tipografía cómoda, imágenes que no se
   desbordan, navegación "siguiente tutorial", buscador simple por título.
5) SEGURIDAD: el loader que sirve los tutoriales debe respetar la visibilidad del
   frontmatter — un .md marcado con roles NO se sirve a una petición sin sesión aunque se
   adivine la URL. Test: petición anónima a un tutorial interno → 404/403.
6) Entregá la estructura con 2 tutoriales de ejemplo escritos ("Entrar al sistema por
   primera vez" — público — y "Encontrar una persona" — interno) para validar el formato.
```

**Por qué archivos .md:** escribís un tutorial en 10 minutos y lo publicás con un commit,
sin pantalla de administración que construir ni mantener. Cuando alguien pregunte algo,
escribís el .md ahí mismo.

**Cuidado con las capturas:** nada de nombres, cédulas, teléfonos o montos reales — usá el
ambiente de staging con datos ficticios. Una captura se reenvía por WhatsApp y sale del
sistema.

---

## Contenido a producir, por oleada

Regla de oro: **una tarea, una página, máximo 6 pasos.** Si necesita más, son dos tutoriales.

### Antes del lunes 3 — los 5 base (aplican a todos)

1. **Entrar al sistema por primera vez** — crear contraseña, MFA, qué hacer si no llega el correo.
2. **Moverte en el sistema** — el menú, qué es cada módulo, por qué ves lo que ves (roles).
3. **Encontrar una persona** — búsqueda del padrón, filtros, abrir un perfil.
4. **Leer un perfil** — qué significa cada pestaña.
5. **Pedir ayuda** — a quién escribir, cómo reportar algo raro.

### Semana 1 (3-9 ago) — por rol, según lo que el staff pregunte

No los escribas antes: escribí los que la gente pida. Candidatos probables:

- **Estudios:** crear grupo · matricular a alguien · cerrar un grupo · importar cursos.
- **Dirigentes:** ver mi grupo · pasar asistencia · cerrar con notas · recomendar a CDEB.
- **Finanzas:** revisar comprobantes · registrar donaciones · importar CSV · becas y cupones.
- **Comunicaciones:** armar un envío · elegir audiencia · usar plantillas.

### Semana 3 (17-23 ago) — servidores y comités

1. **Ver mi comité** — mis servidores, quién está activo.
2. **Solicitar una vacante** — con el detalle de que la ventana abre el 25 de cada mes.
3. **Revisar aplicaciones** — quién aplicó y cómo se escoge.
4. **Check-in de eventos**.

**Infografía clave acá:** el flujo de vacantes completo — solicitud de puesto nuevo vs.
solicitud de vacante vs. aplicación. Son tres cosas distintas que todo el mundo confunde;
un diagrama de una página lo resuelve mejor que tres tutoriales.

### Semana 4 (24-30 ago) — miembros, con capturas de CELULAR

Deben estar publicados **antes** de que salgan las invitaciones del 31:

1. **Crear mi contraseña y entrar** — el que va linkeado en los correos de invitación.
2. **Ver mi perfil y corregir mis datos**.
3. **Matricularme en un estudio** — incluye qué hacer si no aparece el que quiero.
4. **Ver el calendario e inscribirme a un evento**.
5. **Mis pagos: pagar y subir el comprobante**.

### Infografías de proceso (las que valen la pena)

No hagas una por tutorial. Solo donde el problema es *entender el flujo*, no *dónde hacer clic*:

1. **Flujo de vacantes** (puesto nuevo / vacante / aplicación).
2. **Camino del estudiante** (N1 → N2 → N3 → N4 → etapas inicial, intermedia, avanzada) con los compromisos de cada etapa.
3. **Ciclo de un grupo de estudio** (matrícula → en curso → cierre → folletos del siguiente nivel).
4. **Ruta de un pago** (pendiente → comprobante → revisión → aprobado, y qué pasa a las 72 h).

---

## Las tres entregas

### Lunes 3 · Staff y usuarios clave
- 45 minutos, en vivo, sistema proyectado.
- Cada quien entra **con su cuenta desde su compu** durante la sesión; primera tarea: crear su contraseña.
- Grabá la sesión: sirve para quien falte y como base de tutoriales.
- Cerrá con: "todo esto está en /ayuda, y las dudas van a este WhatsApp".
- **Antes del viernes 7**: todo lo que reporten queda estable, porque la semana siguiente no hay desarrollo.

### Lunes 17 · Servidores y encargados de comités
- Misma dinámica. Cada líder entra y revisa su propio comité en vivo.
- Los tutoriales de servidores y la infografía de vacantes ya publicados.

### Lunes 31 · Invitaciones a inscripción de estudios
- Es la puerta de entrada de los miembros al sistema: usa el flujo de invitaciones y las
  plantillas COM-2 (ya listas), que llevan dentro el paso a paso de "primera vez".
- **No es un envío único a 23 000 personas.** Andá por tandas — por sede, por estudio o por
  grupo de interés — para que las consultas lleguen a ritmo manejable y para no chocar con
  el límite diario de correos (EMAIL_DAILY_LIMIT, default 5000/día).
- Los 5 tutoriales de miembro publicados desde la semana anterior.
- **Ese día no se despliega nada.** Alguien de guardia en el WhatsApp.
- Antes de la primera tanda: probá con una lista chica (el staff) y verificá que el correo
  se vea bien en celular y que el link a /ayuda abra sin sesión.

---

## Semana 2 (10-16 ago) · Congelamiento y pruebas

Vos estás fuera, así que no hay despliegues. Aprovechá la semana como banco de pruebas:

- Dejá al staff una **guía de pruebas**: una lista de tareas concretas a ejecutar y un
  formulario (o WhatsApp) para reportar qué salió mal. Es más útil que "úsenlo y me cuentan".
- Todo lo reportado se acumula y se prioriza el lunes 17. Nada se arregla en caliente.
- Dejá claro a quién escribir si algo se rompe de verdad en producción, y qué se considera
  "de verdad" (no se puede hacer check-in vs. un texto mal escrito).

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Staging no está listo el lunes 3 | Es la prioridad #1 de esta semana. Sin staging, cualquier arreglo en caliente se hace sobre gente trabajando |
| Algo se rompe durante la semana 2 sin quien lo arregle | Corte estable el viernes 7 · lista clara de qué es urgencia real · contacto de respaldo definido |
| Las invitaciones generan una ola de consultas | Enviar por tandas, no todo de golpe · tutoriales publicados antes · alguien de guardia |
| Alguien invitado no logra crear su contraseña | El paso a paso va dentro del correo y en /ayuda público · tener claro a quién escribe esa persona |
| Documentar de más y que quede desactualizado | Solo los 5 base antes del kick-off; el resto por demanda real |
| Capturas con datos reales de personas | Tomarlas siempre desde staging con datos ficticios |

---

## Señales de que está funcionando

1. **Preguntas repetidas**: si la misma llega 3 veces, falta un tutorial (o no se encuentra).
2. **Cuentas activadas**: cuántos crearon su contraseña tras el correo masivo (`account_confirmed_at`).
3. **Matrículas por autoservicio vs. por staff**: si el staff sigue matriculando a todos, el tutorial de matrícula no funciona.

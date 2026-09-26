# Staging (INF-1)

Cómo levantar un ambiente desde cero, qué falta para tener el de la nube, y qué
se encontró al hacerlo por primera vez.

## El link para quien prueba (2026-09-25)

**https://theos-admin-git-staging-theos-ti-s-projects.vercel.app**

Público, sin cuenta de Vercel, y con el banner de STAGING arriba de todo.
`admin.theosplace.org` es y sigue siendo PRODUCCIÓN: son dos links distintos a
propósito.

Sale del alias de rama que Vercel le da a la rama `staging`. Los Preview de
este proyecto usan las variables de Preview, que apuntan al Supabase de staging
— verificado revisando el bundle servido, no la configuración: trae
`ellequrgrrqhtqksfrug` y no la base de producción.

**EL FLUJO VA EN UNA SOLA DIRECCIÓN.** Se commitea sobre `staging` y de ahí
sube a `main` cuando se pide:

```
git push origin staging:main
```

`staging` está siempre adelante, así que eso es un fast-forward y nunca hay que
forzar. Lo contrario —`main:staging`— falla, y está bien que falle: significa
que algo se commiteó directo a producción, que es lo que la regla evita.

Y si Vercel no construye nada, es porque el SHA ya está desplegado y
**deduplicó** — pasó al crear la rama—. Un commit vacío en `staging` le da un
SHA propio y dispara el build.

**Cuentas de prueba**, todas con la contraseña de `SEED_TEST_PASSWORD`:

| Cuenta | Para probar como |
| --- | --- |
| `ti@theosplace.org` | admin |
| `estudios@theosplace.org` | coordinación de estudios (9 roles, los mismos que en producción) |
| `dirigentes@theosplace.org` | coordinación de dirigentes |

Se crean o se sincronizan con:

```
node scripts/staging/crear-usuario.mjs <email> <nombre> <apellido> <roles...>
```

Gotcha que costó una corrida: la columna que une la ficha con el usuario es
`auth_user_id`, no `user_id`. Sin eso la sesión entra pero queda sin ficha y
media app se apaga.

**AL VERIFICAR UN LINK, MIRAR EL CONTENIDO Y NO EL CÓDIGO DE RESPUESTA.** El
alias devolvía 200 mientras el build todavía corría, porque Vercel sirve una
página propia de «instant preview site» en el interín. Estuve a punto de pasar
ese link como listo.

## Traer la estructura de producción (2026-09-25)

```
node scripts/staging/sincronizar-estructura.mjs            # dry run
node scripts/staging/sincronizar-estructura.mjs --aplicar
```

Copia áreas, comités y puestos con todos sus datos. **No trae servidores**:
staging es de datos sintéticos y copiar `volunteers` arrastraría a personas
reales —quién sirve dónde— a una base que se comparte con quien prueba.

Tampoco copia `areas.leader_id`: apunta a una ficha de producción que en
staging no existe. No se pierde nada, porque desde SRV-5 quién encarga un
comité se deriva del puesto «Encargado…» y ese campo dejó de ser la fuente.

**No borra.** Lo que exista en staging y no en producción se reporta y se deja
—ahí viven los datos de prueba, y `[prueba] Puesto de servicio` tiene
voluntarios colgando—. Los IDs se conservan, así que `area_id` sigue apuntando
al comité correcto y volver a correrlo actualiza en vez de duplicar.

## Una persona en cada puesto

```
node scripts/staging/sembrar-servidores.mjs            # dry run
node scripts/staging/sembrar-servidores.mjs --aplicar
```

Las pantallas de servidores —el detalle del comité, los conteos por área, el
export de estructura— se ven vacías sin gente asignada. Esto pone UNA ficha de
prueba en cada puesto que no tenga a nadie.

**Una ficha por puesto, no unas pocas repartidas.** Con 53 fichas y 357 puestos
habría que repetir cada una siete veces, y los conteos de «cuánta gente sirve»
dejarían de parecerse a la realidad, que es lo que se quiere mirar.

**La ficha se deriva del ID del puesto**, no de un contador: por eso volver a
correrlo no duplica a nadie y solo llena lo que falte, aunque cambie el orden o
entren puestos nuevos.

Van marcadas `[prueba]` y con correo en **`.invalid`**, un TLD reservado que no
existe: ni por error puede salir un envío hacia una dirección real. Corrido el
2026-09-25: 356 fichas, y los 357 puestos quedaron con alguien.

## Aplicar una migración a staging

```
node scripts/staging/aplicar-sql.mjs supabase/migrations/2026…_algo.sql
```

Staging NO tiene `SUPABASE_DB_URL` —la contraseña de la base nunca se pudo
resetear por el API—, y con solo la llave de servicio no se puede hacer
`create function`: PostgREST expone tablas y RPC, no DDL. Este script va por el
API de gestión, con el `SUPABASE_ACCESS_TOKEN` de `.env.local` y el proyecto de
`.env.staging.local`. Son dos archivos distintos y además comprueba el ref, así
que no hay forma de apuntarle a producción por accidente.

Hace falta porque **el deploy NO aplica migraciones en Preview**: el runner
corre en seco ahí y solo escribe con `VERCEL_ENV=production`. Empujar a la rama
`staging` deja el código nuevo contra el esquema VIEJO, y la prueba no prueba
nada. Acordarse de esto es la mitad de la regla de «staging primero».

Después conviene registrar la versión para que el registro no quede atrasado:

```sql
insert into supabase_migrations.schema_migrations(version, name)
values ('2026…', 'nombre') on conflict (version) do nothing;
```

## Con un comando

```bash
export NEXT_PUBLIC_SUPABASE_URL=…      # el proyecto de staging
export SUPABASE_SERVICE_ROLE_KEY=…
export SUPABASE_DB_URL=…               # conexión directa, para las migraciones
export SEED_TEST_PASSWORD=…
./scripts/staging/arrancar.sh
```

Deja: el esquema completo, 499 filas de catálogo, 14 cuentas —una por rol—, 12
charlas de esta semana más 120 de las últimas 12 semanas, y el set de prueba
(37 personas, 12 grupos, pagos, becas, formularios).

**Probado de punta a punta** contra una base local en blanco el 2026-09-22.
Con `SOLO_ESQUEMA=1` aplica las migraciones y para ahí.

## Probarlo sin nube

```bash
colima start --cpu 4 --memory 8 --disk 60
npx supabase start
npx supabase db reset --local
```

**Nunca `--linked`.** El CLI de este repo está enlazado al proyecto de
**producción**, así que un comando sin destino explícito escribe ahí. Local
siempre con `--local` o `--db-url`.

## El Bloque E ya no existe (verificado 2026-09-22)

La nota de julio decía que todo build de rama moría con
`NEXT_PUBLIC_SUPABASE_URL: undefined` porque las variables de Supabase estaban
solo en Production. **Está arreglado**: hoy `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY` figuran en
`preview,production`.

No se dio por bueno leyendo la configuración: se subió una rama y **el Preview
compiló hasta READY**. En el historial no se veía porque hacía semanas que nadie
empujaba una rama — todos los deploys eran de `main`.

Falsa alarma que apareció de paso: `NEXT_PUBLIC_SUPABASE_ANON_KEY` no está en
Vercel. No hace falta. `src/lib/env.ts` exige **una de las dos** y
`PUBLISHABLE_KEY` está puesta.

## Staging existe (2026-09-22)

| | |
|---|---|
| Proyecto | `Admin Theos Place — Staging` · ref `ellequrgrrqhtqksfrug` |
| Región / versión | us-east-2 · PostgreSQL 17.6, **las mismas que producción** |
| Contenido | 51 miembros (37 `[prueba]` + 14 cuentas de rol), 133 eventos, 12 grupos, catálogo completo |
| Datos reales | **cero** — verificado: ninguna ficha fuera de las marcadas y las de rol |

Los deploys **Preview** de Vercel apuntan ahí (opción A). Comprobado en un
deploy real: el Preview muestra la franja «STAGING» y `admin.theosplace.org`
no muestra nada.

Las credenciales quedaron en `.env.staging.local`, que **no se versiona**:

```bash
set -a; . ./.env.staging.local; set +a
```

### Tres cosas que solo se ven montándolo

- **El pooler de staging es `aws-0-us-east-2`**, el de producción `aws-1`, aunque
  las dos estén en la misma región. Copiar la cadena de conexión de producción
  y cambiarle el ref da `tenant not found`.
- **La llave nueva `sb_secret_…` de este proyecto devuelve 401**; la
  `service_role` clásica funciona. El código prefiere `SUPABASE_SECRET_KEY`, así
  que esa variable **no** debe existir en el entorno de staging: si está, gana y
  todo falla con «Invalid API key».
- **Resetear la contraseña de la base por el API devuelve 200 y no surte
  efecto.** Por eso los seeds nuevos van por la llave de servicio y
  `SUPABASE_DB_URL` quedó opcional.

### Lo que quedó apuntando a producción, a propósito

En Vercel siguen en `preview,production` las variables que crea la integración
Supabase–Vercel y que **la app no lee**: `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_JWT_SECRET` y los `POSTGRES_*`. Se dejaron
porque tocarlas es pelearse con la integración.

**Vale tenerlo presente:** los `POSTGRES_*` de Preview apuntan a la base de
PRODUCCIÓN. Hoy nada en `src/` los lee —se verificó—, pero si algún día alguien
los usa, un preview escribiría en producción.

## Lo que falta, y es tuyo

Nada del montaje: está hecho. Queda **borrar el token de Vercel** que se usó
para configurarlo (<https://vercel.com/account/settings/tokens>), porque pasó
por el chat.

## Los guards ya no dependen de la memoria

Antes, sembrar o borrar datos de prueba se protegía con
`PERMITIR_SEED_PRUEBA=1`: una variable que hay que acordarse de poner, y que
habilita staging y el padrón real por igual.

Ahora la pregunta es **a qué base apunta** (`src/lib/entorno/base-de-datos`, puro
y con tests):

| Base | Sembrar datos de prueba |
|---|---|
| local | libre |
| staging (con `SUPABASE_STAGING_REF`) | libre |
| producción | exige `PERMITIR_SEED_PRUEBA=1` |
| **cualquier otra** | **exige el permiso** — cierra por defecto |

Producción gana siempre: aunque alguien ponga el ref real en
`SUPABASE_STAGING_REF`, sigue siendo producción. Si no, la variable que existe
para proteger sería la forma de saltarse la protección.

`seed-test-users.ts` **no tenía ningún guard** y crea catorce cuentas —una por
rol, incluida `admin`— todas con la misma contraseña. Con el `.env.local` de
siempre, nacían en producción sin que nada preguntara. Ahora también pasa por
la regla.

## Lo que se encontró levantando la primera base desde cero

### Los seeds no podían arrancar un ambiente nuevo

Están escritos contra producción, que ya tenía el catálogo cargado por los
importadores de CCB. En una base en blanco la cadena se cae en cuatro lugares
distintos, y cada uno apareció solo al llegar ahí:

| | Qué pasa |
|---|---|
| `seed-study-plans.ts` | **muerto**: importa `src/data/mock-studies`, que ya no existe |
| `seed-service-positions.ts` | pide `scripts/data/service-positions.xlsx`, que no está en el repo |
| `event_types` | vacía y sin seed → `seed-charlas` muere con «charla no existe» |
| charlas históricas | el set de prueba exige ≥6 de los últimos 170 días; una base nueva no tiene ninguna |

Se resolvió con tres piezas nuevas —`sembrar-catalogo`, `sembrar-charlas-pasadas`
y el `arrancar.sh` que las ordena— en vez de arreglar los dos seeds muertos, que
quedan para borrar.

### El catálogo sale de producción, y por qué eso no contradice «datos sintéticos»

`scripts/staging/exportar-catalogo.cjs` baja 6 tablas / 499 filas a
`supabase/seed/catalogo.json`, versionado: tipos de evento, sedes, áreas, planes
de estudio, puestos y categorías de pago. Es **configuración**. Lo que identifica
gente lo inventa `seed-datos-de-prueba`.

Dos cuidados, los dos porque se comprobó y no porque se supusiera:

- `areas.leader_id` y `study_plans.mentor_id` son FK a `members` y se exportan
  en nulo — en la base nueva esa persona no existe y la FK reventaría.
- **Los textos libres traían correos.** La primera exportación salió con cuatro
  metidos en las «funciones» de varios puestos: `facturacion@`, `finanzas@` y el
  de una persona con nombre. Tres son de rol y uno es de alguien; se tapan los
  cuatro, porque el archivo se versiona y lo que entra al historial de git no
  vuelve a salir.

### Tres funciones de `public` abiertas (cerradas en el mismo cambio)

Sobre un esquema en blanco, la auditoría de funciones dio tres que no deberían:

- `merge_members_resuelto` — su propia migración termina con
  `GRANT ALL … TO anon, authenticated`, que es lo que AGENTS.md prohíbe.
- `immutable_unaccent(text)` y `merge_no_copia()` — sin ningún GRANT escrito,
  pero conservando el **default de PostgreSQL**, que es EXECUTE para PUBLIC.

**Ninguna era explotable.** Las tres son SECURITY INVOKER, o sea que corren con
los permisos de quien llama: `anon` no tiene grants de escritura sobre `members`
y las políticas RLS exigen rol `admin`, `encargado_staff` o `editor_perfiles`.
Las dos últimas son puras y ni siquiera tocan datos. Se cerraron igual —
migraciones `20260922230000` y `20260922240000`, aplicadas también a producción —
porque la regla existe para que la defensa no dependa de una sola capa.

**El auditor tenía un punto ciego**: solo miraba las SECURITY DEFINER. Y el
cheque obvio también lo tiene, conviene saberlo: una consulta sobre `proacl` da
esas dos por cerradas, porque no tienen ACL explícita. La única forma de verlas
es `has_function_privilege`. El auditor ahora usa esa y revisa todas.

### RLS sobre `members` está rota, y falla cerrada

Encontrado de paso, **no arreglado** — es su propio ítem:

```
select como authenticated → infinite recursion detected in policy for relation "members"
select como anon          → permission denied for table members
```

Igual en local y en producción. La política de `members` consulta `members` para
averiguar el rol de quien llama, y eso vuelve a disparar la política.

No es una fuga: falla **cerrada**, con error y sin datos. Y la app no la toca,
porque escribe y lee con la llave de servicio, que salta RLS. Pero significa que
la capa de defensa en profundidad que todos damos por puesta hoy es un error, no
una política. El día que alguien mueva una consulta al cliente del navegador
esperando que RLS la acote, se va a encontrar con esto.

El arreglo habitual es una función SECURITY DEFINER que devuelva los roles de
quien llama sin volver a leer `members`, y reescribir las políticas contra ella.

## Las migraciones se aplican solas al desplegar (2026-09-22)

`vercel.json` ejecuta `node scripts/migraciones/aplicar.cjs && next build`. El
orden ES la garantía: **migrar → construir → desplegar**, y si la migración
falla el build falla y no hay deploy.

Va en el build y no en un workflow de GitHub porque un workflow corre EN
PARALELO con el deploy, y esa carrera se pierde en silencio: el código nuevo
llega a una base vieja y la pantalla se rompe hasta que alguien se acuerde del
SQL.

**Solo en producción.** En los Preview las `POSTGRES_*` apuntan a la base real
(ver arriba), así que si esto corriera ahí, cada rama migraría producción.
Staging se migra a mano, a propósito: ahí es donde se prueba la migración antes.

`supabase/migrations/` **salió** de las rutas ignorables del build. Antes el SQL
se aplicaba a mano y un commit con solo una migración no tenía nada que
desplegar; ahora el build es quien la aplica, y saltárselo la dejaría sin correr.

### Lo que hubo que arreglar antes de encenderlo

**El registro de producción no cuadraba con el repo.** Había 17 migraciones
registradas con otro sello de tiempo pero el mismo nombre que 16 archivos: se
aplicaron en su momento y después el archivo se renombró. El runner las habría
visto pendientes y **las habría vuelto a correr**.

No era teórico. Una de ellas hace
`UPDATE study_enrollments SET status='enrolled' WHERE status='pendiente_de_pago'`,
y en producción hay **dos matrículas en ese estado** — de Irina Morales (14-set)
y Maureen Arguedas (21-set). Reaplicarla las habría cambiado solas.

Se verificó objeto por objeto que las 16 ya estaban aplicadas y se reconcilió el
registro **sin correr una línea de SQL**. Después el runner contra producción
dice «al día» y las dos matrículas siguen intactas.

### Un hallazgo suelto

Esas dos matrículas son del 14 y el 21 de setiembre, o sea **posteriores** a la
decisión del 2026-08-04 de no volver a escribir `pendiente_de_pago`. Algo lo
sigue escribiendo. No se tocó: es su propio ítem.

### Cuidado al escribir una migración

El build migra **antes** de que el código nuevo esté arriba, así que entre una
cosa y la otra la versión vieja corre contra el esquema nuevo. Conviene que las
migraciones sean aditivas: agregar columna sí, renombrarla o borrarla en el
mismo deploy no.

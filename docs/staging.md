# Staging (INF-1)

Cómo levantar un ambiente desde cero, qué falta para tener el de la nube, y qué
se encontró al hacerlo por primera vez.

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

## Lo que falta, y es tuyo

1. **Crear el proyecto de Supabase** de staging. El `SUPABASE_ACCESS_TOKEN` de
   `.env.local` está **vencido** (la API contesta 401), así que el CLI no puede
   crearlo ni enlazarlo. Renovalo en <https://supabase.com/dashboard/account/tokens>.
2. **Vercel.** El token de la sesión solo puede *listar* proyectos: leer
   variables o deployments da 403. Hace falta uno con permiso de escritura, o
   hacerlo a mano:
   - un entorno (o proyecto) apuntando al Supabase de staging;
   - las variables de Supabase habilitadas también para **Preview** — es el
     problema del Bloque E, que viene desde el PR #2 en julio de 2026 y hace
     fallar todo build de rama con `NEXT_PUBLIC_SUPABASE_URL: undefined`.
3. **`SUPABASE_STAGING_REF`** con el ref del proyecto nuevo, para que los guards
   lo reconozcan (abajo).

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

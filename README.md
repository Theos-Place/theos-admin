# Theos Admin

Sistema de administración de Theos Place: padrón de miembros (~23k), estudios
y capacitaciones, eventos con check-in, servidores/comités, empleados,
finanzas (pagos, donaciones, becas, devoluciones) y comunicaciones.

## Stack

- **Next.js** (App Router) + React + Tailwind — la UI es mayormente client
  components que consumen `/api/*`.
- **Supabase** (Postgres + Auth + Storage). Las queries del servidor usan
  service role (`src/lib/supabase/admin.ts`); la anon key del navegador solo
  hace Auth. RLS está en deny-by-default: el enforcement real vive en los
  guards de las rutas API.
- **Vercel** (deploy + crons definidos en `vercel.json`).

## Correr en local

```bash
cp .env.example .env.local   # llenar al menos las variables de Supabase
npm install
npm run dev
```

Las variables obligatorias se validan al arranque (`src/lib/env.ts`) — si
falta algo, el error dice exactamente qué. Usuarios de prueba:
`npx tsx scripts/seed-test-users.ts` (password por `SEED_TEST_PASSWORD`).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción (incluye typecheck) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (CI exige 0 errores; warnings con ratchet) |
| `npm test` | Vitest (lógica pura: elegibilidad, fechas, bloques) |

## Reglas del proyecto (resumen de AGENTS.md)

- **Toda ruta API llama `requireRoles(...)`/`requireModuleView(...)`** de
  `src/lib/auth/guard.ts` — las queries usan service role y saltan RLS.
- **Después de CADA migración**: regenerar `src/types/database.ts`
  (`supabase gen types typescript` o el MCP de Supabase). Sin esto la capa de
  queries pierde el typecheck.
- UI: seguir `Theos Place Design System/` (accesibilidad y layout).
- Migraciones en `supabase/migrations/` numeradas (no existe la 084 — hueco
  conocido, no rellenar).

## Crons y monitoreo

- Los crons de Vercel están **versionados en `vercel.json`** (folleto-blocks,
  start-reminders, leader-absence-check). Vercel manda
  `Authorization: Bearer $CRON_SECRET` automáticamente; las rutas lo validan.
- Cada cron hace ping a Healthchecks.io al terminar OK (variables
  `HEALTHCHECK_URL_*`) — si el ping no llega, alerta por correo.
- Errores de producción: Sentry (`SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`);
  sin DSN es no-op.
- Cola de correos: edge function `process-email-queue` (Supabase) + plantillas
  del sistema en la BD.

## Deudas conocidas

- CSP sin nonces (`script-src 'unsafe-inline'`): única capa faltante entre un
  XSS almacenado y el robo de sesión — reevaluar.
- ~160 warnings de lint (`react-hooks/set-state-in-effect`, patrón heredado):
  el ratchet del CI impide agregar más; migrar al tocar cada archivo.
- 2 cédulas duplicadas históricas marcadas `cedula_dup_legacy` — fusionar en
  `/miembros/duplicados` y retirar el flag.

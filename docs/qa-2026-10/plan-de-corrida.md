# Plan de corrida · arreglos de QA-2 y QA-3 — 2026-10-15

Un solo plan para los dos informes (`informe-autenticado.md` y
`informe-codigo.md`). Ordenado por riesgo y esfuerzo: primero lo que afecta a
toda la app con poco cambio, después lo que pesa en prod, al final la deuda.
Cada tanda es un commit a `staging` verificado; a prod cuando se pida.

Regla de cada tanda: medir antes y después (axe para accesibilidad,
`pg_stat_statements` para BD), y dejar un test o un ratchet que impida volver.

## Tanda 1 — Accesibilidad de base (QA-2 M1, M4, M5) · S · un día

- Seis tokens de color bajo 4,5:1 → arregla 268 elementos en 39 pantallas.
  Sumar los pares a `src/lib/contrast.test.ts`.
- «Saltar al contenido» en el AppShell (60 Tab hoy hasta llegar a trabajar).
- `Modal.tsx`: devolver el foco al botón que abrió aunque haya `autoFocus`
  (23 archivos se benefician sin tocarlos).

## Tanda 2 — Nombres accesibles y foco (QA-2 M2, M3, M6) · S/M · un día

- `aria-label` en los 50 botones solo-ícono y las 12 pantallas con selects sin
  etiqueta. Test que barra botones de ícono sin nombre.
- Foco visible en las fechas de `RequestBoard` y revisión de los 43 `outline-none`.

## Tanda 3 — Las tres consultas que dominan prod (QA-3 M1, M2, M3) · M · dos días

- Matrícula: `getStudyGroups` con filtro de estado y select sin inscripciones
  (1.894 s acumulados, la consulta 1.ª del sistema).
- Lista de eventos: `light=1` más conteos; paginar en servidor (1.290 s).
- `get_group_attendance()` y familia con rango de fechas, o vista materializada
  nocturna (868 s + 362 s). Revisar de paso la ficha del miembro (QA-3 N3).
- Medir antes y después con `pg_stat_statements`.

## Tanda 4 — Limpieza que evita bugs futuros (QA-3 M5, M6) · M · un día

- Borrar los 129 exports, 2 componentes y 265 tipos muertos; `knip` en CI.
- Flujo de comprobante único entre eventos y estudios; `getScope` una sola vez
  (`lib/auth/roles.ts` importado por `usePermissions`); un `escapeHtml`, un
  `norm`, un `EMPTY_RESTRICTION`.

## Tanda 5 — Menores de los dos informes · S/M · un día

- QA-2 N1–N5: blancos táctiles (SINPE primero), «Limpiar filtros» en vacíos,
  ARIA estructural, enlaces subrayados, `GET /api/travel-requests` con rol.
- QA-3 N1, N2, N4, N5: comentario de decisión en las 30 escrituras solo-sesión,
  `next/dynamic` para recharts, índices en las 6 FK que van a crecer, RPC de ids
  para el filtro de audiencia.

## Tanda 6 — zod en las 82 escrituras (QA-3 M4) · L · por módulo, en el tiempo

No va en una sentada. Orden por riesgo: finanzas y pagos (6) → estudios (22) →
miembros (11) → eventos (11) → servidores (10) → el resto. Cada módulo un
commit, con el test de «cableado» que ya se usa para los guards.

## Lo que queda fuera a propósito

- Las 7 pantallas sin datos en staging (empleados, viajes) y el flujo completo
  de matrícula con comprobante: se cubren cuando haya datos sembrados.
- `pg_timezone_names` (no es nuestro) y las cascadas de `useEffect` (sin
  evidencia de que lo sean).

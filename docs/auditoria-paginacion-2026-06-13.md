# Auditoría de paginación — 2026-06-13

Inventario de todos los listados/tablas del sistema, su fuente de datos, cómo
cargan y el plan de corrección. Patrón de referencia: `/miembros` (server-side,
`count: 'exact'` + range + "Cargar más" acumulativo).

## Inventario

| Ruta | Fuente | Carga actual | Volumen | Veredicto |
|---|---|---|---|---|
| `/miembros` | `getMembers` | Server-side paginado (50) | >10k | ✅ Referencia |
| `/finanzas/donaciones` | `getDonations` | Server-side paginado (50) | miles | ✅ Ya bien |
| `/estudios/grupos` | `getStudyGroups` (`useStudies`) | Todo (~1.680), filtro client | grande | 🔴 → server-side |
| `/servidores/aplicaciones` | `getApplications` (`useServers`) | Todo, sin límite | miles potencial | 🔴 → server-side |
| `/servidores/vacantes` | `getVacancies` (`useServers`) | Todo | cientos+ | 🟠 → server-side |
| `/finanzas/pagos` | `getPayments` (`useFinance`) | Todo, filtro client | miles | 🔴 → server-side |
| `/comunicaciones/[id]` (recipients) | `getMessageRecipients` | Todo, sin cargar más | cientos–miles | 🔴 → server-side |
| `/formularios/[id]/respuestas` | `getFormResponses` | Todo | miles potencial | 🔴 → server-side |
| `/estudios/dirigentes` | `useStudies` | Todo, filtro client | ~250–400 | 🟡 → client paginado |
| `/comunicaciones` (historial) | `getMessages` | Todo, filtro client | cientos | 🟡 → client paginado |
| `/comunicaciones/plantillas` | `getTemplates` | Todo | cientos | 🟡 → client paginado |
| `/formularios` | `getForms` | Todo | cientos | 🟡 → client paginado |
| `/empleados` | `getEmployees` | Todo | <100 acotado | ✅ OK |
| `/estudios/plan` | `getStudyPlans` | Todo (34) | catálogo | ✅ OK |
| `/estudios/solicitudes` | `getStudyRequests` | Todo | ~10–50 | ✅ OK |
| `/finanzas/solicitudes`, `/finanzas/devoluciones` | Supabase | Todo | acotado | ✅ OK |
| `/servidores`, `/servidores/admin` | `useServers`/`useOrg` | Todo | 5–20 | ✅ OK |
| `/miembros/listas`, `/duplicados`, `/listas/[id]` | endpoints | Todo | acotado | ✅ OK |
| Notificaciones (panel + dropdown) | `/api/notifications` | Todo | <50 | ✅ OK |

## Piezas reutilizables creadas

- `src/components/shared/LoadMoreFooter.tsx` — footer "Mostrando X de Y" + botón
  "Cargar más" acumulativo (loading-aware). Usado por server y client paginado.
- `src/hooks/usePaginatedList.ts` — hook genérico: dado un `buildUrl(page)` (o
  `null` para deshabilitar) acumula páginas, mantiene `total` (count exacto del
  endpoint), `hasMore`, resetea al cambiar la URL base (filtros/búsqueda). Espejo
  de `useMembers`.

## Decisiones

- **Server-side** cuando el volumen puede ser grande: la query trae una página
  con `count:'exact'` + range ordenado; filtros y búsqueda viajan al servidor.
- **Client-side paginado** solo para datasets chicos/acotados que ya viven en
  memoria por diseño y no crecen mucho: se pagina la vista (mostrar N, cargar
  más) sin rehacer el fetch.
- Export / "seleccionar todos" sigue trayendo el set completo por endpoint
  dedicado, nunca depende de lo cargado en pantalla.
</content>

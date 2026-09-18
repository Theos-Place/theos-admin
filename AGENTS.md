<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Accesibilidad

Toda UI nueva sigue `Theos Place Design System/accessibility.md` (estándar de la marca, meta WCAG 2.1 AA). Resumen: texto informativo mínimo `text-navy-light/80` (`/50`, `/60` y `/70` se eliminaron del código — no reintroducirlos; nada de `text-gray-400` ni hexes grises), nunca `/20`–`/30` para texto; `/40` SOLO para decorativo (separadores, íconos con `aria-hidden`) y controles deshabilitados, que están exentos de AA; tamaño mínimo de texto informativo `text-[13px]` (micro-labels uppercase pueden ser 11px; nunca 10px ni 9px); `aria-label` en botones solo-ícono y en inputs sin label visible; modales solo con el `Modal.tsx` compartido; todo operable con teclado.

**Texto sobre fondos de marca** (UI-1, medido el 2026-08-21 y fijado por `src/lib/contrast.test.ts`): `bg-coral` y `bg-teal-deep` llevan texto **blanco**; `bg-teal` lleva texto **navy**, nunca blanco (daría 2.15:1). Sobre un tinte coral, el texto va en `coral-deep`, no en `coral`. Los ratios no se estiman: se calculan con `src/lib/contrast.ts` y el test falla si un par baja de 4.5:1.

# Ancho y layout

Toda pantalla nueva sigue `Theos Place Design System/layout.md`. **Tres anchos, y
ninguno se escribe a mano** — salen de `<PageContainer width="…">`:

- `work` (1600px): tablas, listados, dashboards, colas. **Es el default**: el AppShell
  ya lo aplica, así que una pantalla de gestión no envuelve nada.
- `form` (896px): wizards y detalle/edición de un objeto.
- `reading` (768px): prosa (`/terminos`, guías de `/ayuda`).

Dentro del ancho, el contenido se distribuye en grids responsive (`grid-cols-1` →
`lg:grid-cols-2/3`), no una columna estirada. Los `max-w-*` de un elemento interno
(input, tarjeta, párrafo, pantalla de confirmación centrada) no son esto y se quedan.

# Seguridad en rutas API

El proxy (`src/proxy.ts`) excluye `/api`: **todo handler de ruta API debe llamar `requireRoles(...)` de `src/lib/auth/guard.ts`** (las queries usan service role y saltan RLS). Escrituras (POST/PUT/PATCH/DELETE) exigen roles explícitos, no solo sesión, salvo decisión documentada en el propio handler.

## Funciones nuevas en `public`

Una función creada en `public` nace con **EXECUTE para PUBLIC**, y PostgREST
publica todo ese esquema en `/rest/v1/rpc/`. O sea que por defecto la puede
llamar cualquiera con la llave pública que va en el bundle del navegador, sin
sesión. Toda migración que cree una función termina con:

```sql
revoke execute on function public.<nombre>(<args>) from public, anon, authenticated;
grant  execute on function public.<nombre>(<args>) to service_role;
alter  function public.<nombre>(<args>) set search_path to 'public';
```

No es teórico (SEC-3, 2026-09-17): `report_charla_attendance()` devolvía con
200 la asistencia de toda la organización a quien solo tuviera la llave
pública, y `member_por_external_id(text)` dejaba enumerar fichas. Las dos son
SECURITY DEFINER a propósito y la app las llama desde el servidor con la llave
de servicio, así que revocar no rompió nada — pero las otras 30 funciones del
esquema ya estaban cerradas y estas dos se quedaron atrás sin que nadie lo
notara.

`search_path` fijo va también en las que no son SECURITY DEFINER: si no, la
función resuelve sus nombres contra el path de quien la llama.

Para revisarlo: `node scripts/sec3/auditar.cjs` (sale con código 1 si algo
quedó abierto).

## Convención de rutas API

1. Errores: `{ error }` con mensaje humano; si el cliente distingue casos, campo `code` aparte.
2. Todo body de escritura se valida con zod; fallo → 400 `{ error: 'Datos inválidos', detalles: z.treeifyError(...) }`.
3. 500 solo en el `catch` final del handler.
4. Códigos: 201 al crear, 404/409/400 según el caso; DELETE responde 200 `{ ok: true }`.
5. Crear devuelve el recurso creado; las demás escrituras `{ ok: true }`.
6. Updates parciales usan PATCH.
7. Acciones puntuales van como `{ action }` validado (enum), no endpoints ad-hoc.
8. Listas paginadas responden `{ items, total, page, pageSize }`.
9. Sin "modo consulta" en DELETE (nada de `?check=1`); la consulta previa es un GET propio.
10. Paths nuevos en inglés y plural.

# Cruzar datos contra CCB

**Un external_id se resuelve con `member_por_external_id(id)`, nunca con `members.external_id` a secas** — en SQL directo, en un script de import y en cualquier consulta que cruce contra un export de CCB.

El motivo: la fusión de duplicados deja el external_id del duplicado en `members.external_id_fusionados` y **no** se lo copia al principal (`external_id` está en la lista de `merge_no_copia()`). La ficha del duplicado tampoco se borra: queda `is_active=false` con `deactivation_reason='merged'`, conservando su external_id. Así que un mismo ID vive en DOS fichas a la vez, y buscar por `external_id` devuelve la muerta — peor que no encontrar nada, porque la persona aparece inactiva cuando está sirviendo. La función ordena por ficha viva primero y por eso acierta (migración `20260915030000`, contrato fijado por `src/lib/members/resolucion-por-external-id.test.ts`).

Dos reglas más para estos cruces, las dos aprendidas rompiendo algo:

- **Match por external_id, nunca por nombre.** Si no queda otra, la condición es que haya EXACTAMENTE UNA ficha viva con el nombre idéntico; con cero o con dos, se reporta y no se toca. Un regex sobre apellidos ya confundió a dos personas distintas.
- **Que CCB no traiga una fila no prueba que el servicio se acabó.** Puede ser una edición hecha a mano en el sistema nuevo, que es la fuente correcta (así pasó con Sede Madrid el 13-set-2026). Antes de dar de baja en masa, comparar contra lo que el sistema sabe y preguntar.

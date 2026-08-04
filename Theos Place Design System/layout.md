# Ancho y layout — estándar Theos Place

Regla general para el admin (y prototipos que pasen a producción): **en desktop las
pantallas usan todo el ancho disponible y se adaptan de forma responsive hacia
tablet y móvil.** El shell (sidebar + padding del layout) ya define el margen; el
contenido NO se vuelve a encajonar con un `max-w-*` centrado.

## Los tres anchos (2026-08-04)

Toda pantalla usa uno de tres, y **ninguno se escribe a mano**: salen de
`<PageContainer width="…">` (`src/components/layout/PageContainer.tsx`).

| Ancho | Medida | Para qué | Ejemplos |
|---|---|---|---|
| `work` | 1600 px | Tablas, listados, dashboards, calendarios, colas de revisión. Ver más datos importa más que la comodidad de lectura. | `/miembros`, `/finanzas/pagos`, `/estudios`, `/mis-pagos`, check-in, el índice de `/ayuda` |
| `form` | 896 px | Wizards y el detalle/edición de UN objeto. | `/matricula/prematrimonial`, `/estudios/importar` |
| `reading` | 768 px | Prosa. Textos largos, ~75 caracteres por línea. | `/terminos`, las guías de `/ayuda` |

**El admin no necesita envolver nada**: el `AppShell` ya aplica `work` a todo, así
que una pantalla de gestión se escribe igual que siempre (`space-y-*`, sin
`max-w-*`). Solo las de lectura y las de formulario declaran su ancho:

```tsx
// Pantalla de gestión: nada que hacer, el AppShell la acota en 1600.
<div className="space-y-4"> … </div>

// Wizard / detalle de un objeto:
<PageContainer width="form" className="page"> … </PageContainer>

// Prosa:
<PageContainer width="reading"> … </PageContainer>
```

Fuera del AppShell (páginas públicas) se usa con `padded` o con su propio padding.

**Excepción de `/ayuda`:** el cuerpo del tutorial va en `reading`, pero las guías
de tipo `infografia` usan `work` — son diagramas anchos que a 768 px quedan
ilegibles. Además, tocar cualquier imagen la abre a pantalla completa.

Los `max-w-xs/sm/md/[400px]` **dentro** de un componente (un input, una tarjeta,
un párrafo de ayuda, una pantalla de confirmación centrada) no son esto: acotan un
elemento, no la página, y se quedan.

## La regla

- El contenedor raíz de una pantalla es **full-width**: `space-y-*` sin `max-w-* mx-auto`.
- "Full-width" **no** significa estirar una sola columna. Significa **distribuir el
  contenido** para que se lea bien en anchos grandes: grids y columnas que se
  reacomodan por breakpoint.
- Responsive de una vez: `grid-cols-1` en móvil → `sm:grid-cols-2` / `lg:grid-cols-3`
  en pantallas grandes. Nunca una columna de campos estirada a 1500px.

```tsx
// ✅ Pantalla full-width con contenido distribuido
<div className="space-y-4">
  <Header />
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    {/* pares de campos, o acciones | resultado */}
  </div>
</div>

// ❌ Columna angosta centrada en una pantalla de gestión
<div className="max-w-2xl mx-auto space-y-4"> … </div>
```

## Patrones por tipo de pantalla

- **Listas / tablas / dashboards**: full-width. Tablas con scroll horizontal propio
  (`overflow-x-auto`) si hace falta; tarjetas en grid.
- **Formularios**: full-width, campos en pares/tercios mitad-mitad (`grid lg:grid-cols-2`
  o `lg:grid-cols-3`). Agrupar campos relacionados en la misma fila. Textareas largas
  y campos únicos importantes pueden ocupar toda la fila.
- **Herramientas de una acción** (check-in): full-width en dos columnas —
  acción a la izquierda, resultado/lista a la derecha; se apila en móvil.
- **Detalle** (perfil, comité): full-width, con columnas o tabs.

## Excepción: ancho de lectura

Un `max-w-*` **sí** es correcto (y deseable) cuando el objetivo es **legibilidad de
texto largo o un foco único**, no gestión de datos:

- Páginas de texto largo (legal/`/terminos`): `max-w-3xl` para no pasar de ~75
  caracteres por línea.
- Pantallas de confirmación / éxito / vacío centradas: `max-w-md`/`max-w-sm` centrado.
- Vistas que **imitan** una superficie angosta real (preview de formulario público).
- `max-w-*` en un **elemento interno** para acotar el largo de línea de un párrafo de
  ayuda o el ancho de un input de búsqueda — se mantiene.

Regla mnemónica: **si la pantalla muestra o edita datos → full-width. Si es para leer
un texto o confirmar algo → ancho de lectura.**

## Checklist antes de mergear una pantalla nueva

1. ¿El contenedor raíz es full-width (sin `max-w-* mx-auto`), salvo que sea de lectura?
2. ¿El contenido se distribuye en grid/columnas en `lg:` en vez de estirar una columna?
3. ¿Se apila correctamente en móvil (`grid-cols-1`)?
4. ¿Las tablas anchas tienen `overflow-x-auto`?

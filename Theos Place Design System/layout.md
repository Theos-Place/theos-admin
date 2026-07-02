# Ancho y layout — estándar Theos Place

Regla general para el admin (y prototipos que pasen a producción): **en desktop las
pantallas usan todo el ancho disponible y se adaptan de forma responsive hacia
tablet y móvil.** El shell (sidebar + padding del layout) ya define el margen; el
contenido NO se vuelve a encajonar con un `max-w-*` centrado.

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

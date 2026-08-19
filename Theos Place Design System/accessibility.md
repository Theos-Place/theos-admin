# Accesibilidad — estándar Theos Place

Reglas mínimas para cualquier interfaz de la marca (admin, web, prototipos que
pasen a producción). La meta es WCAG 2.1 AA. Si una regla choca con la estética,
gana la regla: la marca se ve bien *y* se lee.

## Contraste de texto

Sobre fondo claro (blanco / `--surface`), usando navy con opacidad:

| Uso | Mínimo | Contraste aprox. |
|---|---|---|
| Texto normal (< 18px) | `text-navy-light/80` o color sólido | 6.4:1 ✓ AA, cerca de AAA |
| Texto grande (≥ 18px o ≥ 14px bold) | `text-navy-light/80` | 6.4:1 |
| Metadata secundaria pequeña | `text-navy-light/80` | 6.4:1 |
| Placeholders | `placeholder:text-navy-light/50` mínimo | — |
| Decorativo puro (íconos de empty state, adornos, separadores «·») | `/40` mínimo | exento de AA |

**Nunca** `/20` o `/30` para texto que comunica algo — a ese nivel el contraste
ronda 2:1 y es ilegible para mucha gente. Estado deshabilitado: usá `/40` *y*
otra señal además del color (cursor, opacidad del contenedor). Nada de
`text-gray-400` ni hexes grises sueltos: siempre los tokens de la marca.

> 2026-08-17: se saldó la deuda heredada (`/60` → `/70`, `/30` → `/40`, `/50`
> informativos → `/70`). 2026-08-19, segunda vuelta por legibilidad para
> adultos mayores: TODO `/70` → `/80` (navy, navy-light y white sobre navy;
> 4.8:1 → 6.4:1) y los `text-gray-400`/hexes grises pasaron a tokens o grises
> ≥ gray-600. No reintroducir `/60` ni `/70` en texto nuevo.

## Tamaño de texto

Piso de la marca (2026-08-19): **13px** para texto que comunica (metadata,
notas, celdas) — el barrido subió todo `text-[12px]` a 13px. Los micro-labels
uppercase con tracking (encabezados de tabla, chips) pueden usar `text-[11px]`.
`text-[10px]` solo para adornos contados (iniciales de avatar, contadores);
**nunca** 9px.

## Botones e inputs

- **Botón solo-ícono** → `aria-label` siempre. Si el estado cambia, el label
  también: `aria-label={open ? 'Cerrar menú' : 'Abrir menú'}`.
- **Input sin `<label>` visible** (búsquedas, filtros) → `aria-label` con el
  mismo texto del placeholder. El placeholder solo NO cuenta como label.
- **Error de campo** → texto visible debajo del input (no solo borde rojo) y
  vinculado con `aria-describedby` cuando se pueda.
- Área táctil mínima de 40×40px en controles (los íconos pueden ser más chicos,
  el hit-area no).

## Modales y foco

- Usar el `Modal.tsx` compartido: ya trae focus trap, cierre con Escape,
  `role="dialog"`, `aria-modal` y `aria-labelledby`. No armar modales con divs.
- Todo lo interactivo debe poder operarse solo con teclado, con foco visible
  (no quitar el outline sin reemplazarlo).

## Estructura

- `lang="es"` en `<html>` (ya está).
- Jerarquía de headings real (un `h1` por vista, sin saltos h1→h4).
- No comunicar nada solo con color: acompañar con ícono o texto
  (ej. badges de estado llevan texto, no solo el punto de color).
- `target="_blank"` siempre con `rel="noopener noreferrer"`.

## Checklist rápido antes de mergear UI nueva

1. ¿Todo texto informativo está a `/60` o más (`/70` si es chico)?
2. ¿Cada botón de ícono tiene `aria-label`?
3. ¿Cada input tiene `<label>` o `aria-label`?
4. ¿Se puede completar el flujo solo con teclado?
5. ¿Los errores se ven y se leen (no solo color)?

# Accesibilidad — estándar Theos Place

Reglas mínimas para cualquier interfaz de la marca (admin, web, prototipos que
pasen a producción). La meta es WCAG 2.1 AA. Si una regla choca con la estética,
gana la regla: la marca se ve bien *y* se lee.

## Contraste de texto

Sobre fondo claro (blanco / `--surface`), usando navy con opacidad:

| Uso | Mínimo | Contraste medido |
|---|---|---|
| Texto normal (< 18px) | `text-navy-light/80` o color sólido | **6.41:1** ✓ |
| Texto grande (≥ 18px o ≥ 14px bold) | `text-navy-light/80` | **6.41:1** ✓ |
| Metadata secundaria pequeña | `text-navy-light/80` | **6.41:1** ✓ |
| Placeholders | `placeholder:text-navy-light/80` | **6.41:1** ✓ |
| Decorativo puro (íconos de empty state, adornos, separadores «·») y controles DESHABILITADOS | `/40` | exento de AA |

**Los números son medidos, no estimados** (`src/lib/contrast.ts`, fijados por
`contrast.test.ts`). Sobre `--surface-low` #F2F4F5 el `/80` da 6.01:1, también AA.

`/50`, `/60` y `/70` NO se usan para texto: dan 2.78, 3.62 y 4.78. El `/70` pasaría
raspando, pero se retiró para no tener dos niveles que hacen lo mismo. Los
placeholders estaban en `/50` (2.78, falla) hasta el 2026-08-21 — un placeholder es
texto y cuenta para AA; sigue distinguiéndose del valor real porque el valor va en
`text-navy` sólido.

Cuidado con el impulso de "arreglar" el `/40`: lo decorativo y lo deshabilitado
están exentos, y subirlos solo oscurece la jerarquía visual sin que nadie lea
mejor. Pasó al aplicar este cambio y hubo que revertir 14 casos.

**Nunca** `/20` o `/30` para texto que comunica algo — a ese nivel el contraste
ronda 2:1 y es ilegible para mucha gente. Estado deshabilitado: usá `/40` *y*
otra señal además del color (cursor, opacidad del contenedor). Nada de
`text-gray-400` ni hexes grises sueltos: siempre los tokens de la marca.

> 2026-08-17: se saldó la deuda heredada (`/60` → `/70`, `/30` → `/40`, `/50`
> informativos → `/70`). 2026-08-19, segunda vuelta por legibilidad para
> adultos mayores: TODO `/70` → `/80` (navy, navy-light y white sobre navy;
> 4.8:1 → 6.4:1) y los `text-gray-400`/hexes grises pasaron a tokens o grises
> ≥ gray-600. No reintroducir `/60` ni `/70` en texto nuevo.

## Texto sobre los colores de marca

Ningún color de marca aguanta texto blanco por sí solo: hay que usar el tono
correcto. Medido el 2026-08-21.

| Fondo | Texto | Ratio | |
|---|---|---|---|
| `coral` #D63E3D | blanco | **4.55:1** | ✓ AA |
| `coral-deep` #C43635 (hover) | blanco | **5.35:1** | ✓ AA |
| `teal` #70BDC2 | **navy**, no blanco | **8.07:1** | ✓ AA |
| `teal` #70BDC2 | blanco | 2.15:1 | ✗ nunca |
| `teal-deep` #3B7579 | blanco | **5.24:1** | ✓ AA |
| `navy` #161440 | blanco | **17.38:1** | ✓ AAA |
| tinte coral al 10% | `coral-deep` | **4.75:1** | ✓ AA |

Dos tonos DERIVADOS se oscurecieron el 2026-08-21 para que el botón primario
pasara AA: coral pasó de #EF5554 (3.44:1, fallaba en los ~192 botones del sistema)
a #D63E3D, y teal-deep de #519DA2 (3.14:1) a #3B7579. **La identidad no cambió**:
el navy #161440 y el teal #70BDC2 son los de siempre; lo que se movió son sus
variantes profundas, que existen justamente para llevar texto encima.

El teal claro es fondo de chips y estados seleccionados, y va con texto **navy**.
Con blanco daba 2.15:1, que es ilegible.

## Tamaño de texto

Piso de la marca (2026-08-19): **13px** para texto que comunica (metadata,
notas, celdas) — el barrido subió todo `text-[12px]` a 13px. Los micro-labels
uppercase con tracking (encabezados de tabla, chips) pueden usar `text-[11px]`.

**El piso duro es 11px** (actualizado 2026-08-21): los 34 usos de `text-[10px]`
que quedaban —incluidas las iniciales de avatar y los contadores— subieron a 11px.
`contrast.test.ts` falla si vuelve a aparecer un 10px o un 9px, así que el piso
está fijado por un test y no por acuerdo.

PENDIENTE de decidir: la ficha de UI-1 pide "nada por debajo de 12px", lo que
dejaría fuera los 429 micro-labels de 11px. Es una decisión de diseño abierta,
no un incumplimiento — AA no fija tamaños mínimos, solo contraste.

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

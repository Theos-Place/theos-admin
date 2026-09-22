# QA-1 · Auditoría automatizada — 2026-09-22

## Qué se auditó y qué no

**Sin volver a sembrar cuentas de prueba** (decisión del usuario). El set
`[prueba]` se borró entero ese mismo día, y recrearlo significa datos nuevos en
producción — incluidos grupos con matrícula abierta que los miembros ven en el
portal.

Eso parte la auditoría en dos:

| Parte | Estado |
|---|---|
| Consistencia de UI y básicos (estático, sobre el código) | **Completa** — no necesita navegador |
| Accesibilidad y móvil en páginas **públicas** | **Completa** — no necesitan sesión |
| Accesibilidad y móvil en pantallas **autenticadas** | **Pendiente** — necesita cuentas |
| Teclado y foco en los 5 flujos críticos | **Pendiente** — cuatro de los cinco exigen sesión |

Lo pendiente se retoma cuando exista staging (INF-1), que es donde este trabajo
deja de tener costo.

Reproducible: `npx tsx scripts/qa/auditar-publicas.ts` contra el dev server.
Datos crudos en `axe-publicas.json`, capturas de móvil en `capturas/`.

---

## CRÍTICO

### C1 · Todas las donaciones se reportan en el trimestre anterior

`src/app/(admin)/finanzas/reportes/page.tsx:66,74,77` · `finanzas/page.tsx:47` ·
`components/finance/FinanceChart.tsx:45`

El reporte agrupa con `new Date(d.donation_date).getMonth()` y `.getFullYear()`.
`donation_date` es una columna `date`, así que `new Date('2026-01-01')` es
medianoche **UTC** — y en Costa Rica (UTC−6) eso son las 6 p.m. del 31 de
diciembre.

Verificado con `TZ=America/Costa_Rica`:

```
new Date('2026-09-01').getMonth()+1  → 8    (debería ser 9)
new Date('2026-01-01').getFullYear() → 2025 (debería ser 2026)
```

**No es un caso de borde: le pega a las 15.147 donaciones.** Están registradas
por trimestre y *todas* caen el día 1 (1-ene, 1-abr, 1-jul, 1-oct). O sea que
cada una se cuenta un mes antes, y las **4.136 del 1.º de enero se cuentan en el
año anterior** — se caen del filtro de año de la pestaña de Transparencia.

**Fix:** `parseFlexibleDate(d.donation_date)` en vez de `new Date(...)`, o
partir el string: `donation_date.slice(0,4)` para el año y `.slice(5,7)` para el
mes. El helper ya existe y es el que usa el resto del sistema.

### C2 · `/calendario` se desborda 405 px en celular

Página **pública** — la que se comparte por WhatsApp, y ahí casi todo el mundo
abre desde el teléfono.

La rejilla de 7 columnas no se adapta: en un viewport de 360 px mide ~965. Hay
que arrastrar de lado para ver de miércoles en adelante, y **la barra de
encabezado no acompaña el desplazamiento**, así que queda cortada a media
pantalla (ver `capturas/mobile_calendario.png`).

Es la única página con desborde de las nueve públicas medidas.

**Fix:** en móvil, lista por día en vez de rejilla, o rejilla con desplazamiento
horizontal contenido y encabezado pegado.

---

## MEDIO

### M1 · Doce conversiones de fecha sin protección de zona horaria

El mismo mecanismo de C1, en otras pantallas. Son las que usan `new Date()`
sobre una columna `date` **sin** `parseFlexibleDate` ni el sufijo `T00:00:00`:

| Archivo | Línea | Campo |
|---|---|---|
| `(admin)/empleados/page.tsx` | 177, 314, 317 | `start_date`, `end_date` |
| `(admin)/estudios/plan/[id]/page.tsx` | 507 | `start_date` |
| `(admin)/finanzas/page.tsx` | 47 | `donation_date` |
| `(admin)/finanzas/reportes/page.tsx` | 37, 66, 74, 77 | `donation_date` |
| `components/finance/FinanceChart.tsx` | 45 | `donation_date` |
| `hooks/useSortableTable.ts` | 57 | `birth_date` |
| `lib/servers/columns.ts` | 38 | `start_date` |

De 24 usos sobre columnas `date`, **12 ya se protegen** pegando `T00:00:00`.
Esa mitad muestra que el problema se conoce; lo que falta es que sea una sola
forma de hacerlo y no dos.

El de `useSortableTable` es distinto y peor de detectar: calcula la edad restando
años, así que ordena mal a quien todavía no ha cumplido años ese año.

### M2 · Contraste bajo en `/terminos`

7 nodos. `text-teal-deep/90` sobre `bg-teal-soft/20`.

Medido con `lib/contrast.ts`, que es la herramienta del propio repo: **3,80**
contra el 4,5 que pide AA. El mismo teal sobre el fondo de papel da 5,16 — o sea
que **el problema son las opacidades**, no el color.

**Fix:** quitarle el `/90` al texto. Con el color pleno pasa.

### M3 · Enlace distinguible solo por color en `/registro`

`link-in-text-block`, 1 nodo: `<a class="text-teal-deep hover:underline">recuperá
tu acceso</a>` dentro de un párrafo. El subrayado aparece solo al pasar el mouse,
que en un teléfono no existe.

**Fix:** `underline` permanente, no solo en `hover`.

---

## MENOR (consistencia)

### N1 · Las fechas se formatean a mano en 91 archivos

208 llamadas a `toLocaleDateString` / `toLocaleString` / `toLocaleTimeString`
fuera de `lib/format`. `lib/format` existe justamente para esto y es donde vive
la protección de zona horaria — cada llamada suelta es una oportunidad de
repetir C1.

### N2 · `PageContainer` se usa en 9 de 117 páginas

El `AppShell` ya aplica el ancho de trabajo, así que una pantalla de gestión no
necesita envolver nada: esto no es un defecto por sí solo. Pero significa que el
ancho de una pantalla no se puede saber leyéndola — hay que deducirlo del
cascarón. Un solo `max-w` de página escrito a mano en todo el repo
(`miembros/listas/[id]`, `max-w-5xl`), que sí conviene mirar.

### N3 · No hay componente de botón

`bg-coral` aparece 205 veces, `bg-coral-deep` 192, `bg-navy` 240 y `bg-teal-deep`
24 — todas como clases sueltas. El único componente compartido es
`ExportButton`. Cambiar el estilo del botón primario hoy es buscar y reemplazar
en cientos de sitios, y cualquier variante nueva nace desalineada sin que nada
avise.

### N4 · Títulos de página: 15 de 132

Solo los layouts de módulo declaran `metadata`, así que todas las pantallas de un
módulo comparten título. En el historial del navegador y en una pestaña anclada
se ven todas iguales.

---

## Lo que PASA limpio

- **Imágenes sin `alt`: cero.** Las cuatro que marcó el primer barrido estaban
  dentro de comentarios.
- **Enlaces rotos en `/ayuda`: cero**, sobre 39 artículos — contando también que
  exista el archivo de cada infografía, GIF y video.
- **Ocho de las nueve páginas públicas** no desbordan en 360 px.
- **Violaciones de axe: 4 en total** (3 únicas) en nueve páginas públicas y dos
  anchos. Ninguna `critical`.

---

## Lo que este informe NO dice

- **Nada de las pantallas autenticadas**, que son la mayor parte del sistema.
- **Nada de teclado y foco**: de los cinco flujos, cuatro exigen sesión. El
  quinto (login) quedó cubierto de rebote por axe, sin violaciones.
- **Nada de blancos de toque menores a 44 px**: se midió el desborde, no el
  tamaño de cada control. Con las capturas de `capturas/` se puede revisar a
  ojo, pero no se automatizó.

El siguiente paso real no es ampliar este informe: es **INF-1**. Mientras el QA
tenga que elegir entre no cubrir las pantallas con sesión o ensuciar producción,
va a seguir cubriendo la mitad.

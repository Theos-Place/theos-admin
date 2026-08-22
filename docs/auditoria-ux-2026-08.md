# Auditoría de accesibilidad, legibilidad y UX — agosto 2026

**Fecha:** 2026-08-21 · **Alcance acordado:** análisis estático medido sobre el código.

## Lo primero: qué es este informe y qué NO es

Todo lo que sigue está **medido**, no estimado: cada número sale de recorrer el
código o de calcular el ratio de contraste real. Donde una medición es un proxy
imperfecto, lo digo.

**Lo que NO se hizo, y hay que decirlo:** no hay pasada real con lector de
pantalla (NVDA/VoiceOver), ni recorrido a mano en un navegador a 390px, ni
prueba de tabulación con teclado en los flujos completos. Eso detecta cosas que
el análisis estático no ve — orden de tabulación ilógico, un `aria-label` que
existe pero dice algo confuso, un modal que en móvil deja el botón de confirmar
fuera de pantalla. **Sigue pendiente** y es donde queda el valor no cubierto.

**Contraste y tamaños ya se arreglaron** (UI-1, commit `5af7e946`): están fuera
de este informe salvo la referencia. Resumen: se oscurecieron los dos tonos
derivados (coral y teal-deep) porque el botón primario daba 3.44:1; hoy los 11
pares del design system pasan AA y hay un test que lo fija.

## La sorpresa: el sistema está bastante mejor de lo que la ficha asume

La ficha de AUD-1 se escribió antes de la auditoría de junio y del design
system. Varias de sus sospechas ya no aplican. Lo que **está bien** y conviene
saber para no gastar esfuerzo ahí:

| Área | Estado medido |
|---|---|
| Modales propios sin accesibilidad | **0** — los 64 usan el `Modal.tsx` compartido |
| Trampa de foco en modales | ✓ cicla con Tab **y** Shift+Tab, no solo enfoca el primero |
| Escape cierra el modal | ✓ |
| `role="dialog"` + `aria-modal` | ✓ |
| Foco visible | 9 `focus:outline-none`, 8 con reemplazo explícito |
| Imágenes sin `alt` | **0** (las 4 que aparecían eran comentarios y strings) |
| Tablas desbordándose en móvil | **0** — las 43 tienen `overflow-x` en su contenedor |
| Jerga técnica en la interfaz | **0** — ni `enrollment`, ni `payload`, ni códigos HTTP, ni estados del esquema |
| Botones solo-ícono sin `aria-label` | 3 → **arreglados** en esta pasada (ver al final) |

Que la jerga esté limpia y que las tablas ya manejen el desborde son dos de las
cosas más caras de arreglar después, así que vale registrarlas.

---

# BLOQUEANTE

Nada. No se encontró ningún hallazgo que impida a alguien completar una tarea.

---

# IMPORTANTE

## 1. El modal no devuelve el foco al cerrar

**Dónde:** `src/components/shared/Modal.tsx` — afecta a los **64 archivos** que lo usan.

**Qué pasa:** al abrir, el modal enfoca su primer elemento (bien). Al cerrar, no
guarda ni restaura el elemento que tenía el foco antes, así que el foco vuelve al
`<body>`.

**Por qué importa:** quien navega con teclado pierde el lugar. Después de cerrar
un modal desde la fila 40 de una tabla, el siguiente Tab lo manda al principio de
la página y tiene que recorrer todo otra vez. Es el hallazgo de mayor alcance por
esfuerzo: **un solo archivo arregla 64 pantallas**.

**Corrección:** guardar `document.activeElement` al montar y devolverle el foco en
el cleanup.

```
const previo = document.activeElement as HTMLElement | null
// …al desmontar:
previo?.focus?.()
```

## 2. Los errores no se anuncian como errores

**Dónde:** `src/components/shared/Toast.tsx` (línea 44) — es el canal principal de
feedback del sistema.

**Qué pasa:** el toast usa `role="status"` para todos los casos, incluidos los de
error. `role="status"` implica `aria-live="polite"`: el lector de pantalla espera
a terminar lo que está diciendo. Un error necesita `role="alert"`
(`aria-live="assertive"`), que interrumpe.

**Por qué importa:** un toast de error que se muestra 3 segundos puede
desaparecer antes de que el lector llegue a anunciarlo. La persona no se entera
de que su acción falló.

**Corrección:** `role={kind === 'error' ? 'alert' : 'status'}`.

## 3. 168 inputs no tienen su label asociado — CORRECCIÓN a la primera versión de este informe

**Esto se me pasó en la primera pasada y es más grave que el hallazgo siguiente.** Lo
encontré al implementar las correcciones: al tocar `completar-perfil` vi que sus labels no
tenían `htmlFor` ni sus inputs `id`, medí si era general, y lo es.

**Medido:** 100 labels con `htmlFor` (bien) · 65 que envuelven su input (válido sin
`htmlFor`) · y **246 sin ninguna asociación**. De esos 246, verificado uno por uno por lo
que les sigue:

| Situación | Cantidad | Veredicto |
|---|---|---|
| Label pegado a un `<input>`/`<select>`/`<textarea>` nativo | **168** | **bug confirmado** |
| Label antes de un componente propio (Combobox, etc.) | 17 | a revisar: puede traer su `aria-label` |
| Label antes de un `<div>`/grupo de radios | 61 | a revisar: probablemente necesita `fieldset`/`legend` |

**Por qué importa más que el hallazgo 4:** un input sin label no tiene nombre accesible. Al
tabular, el lector de pantalla anuncia "cuadro de edición" y nada más — ni "Correo" ni
"Puerto" ni "Fecha". El placeholder NO cuenta como label (desaparece al escribir y no todos
los lectores lo leen). Es incumplimiento directo de WCAG 1.3.1 y 4.1.2, nivel A.

**Dónde:** 165 de los 168 están en pantallas de **staff**; solo 3 caían cerca de flujos del
miembro y **ya se arreglaron**. Los peores concentrados:
`comunicaciones/configuracion` (22), `eventos/[id]/editar` (18),
`estudios/grupos/[id]/editar` (13), `FieldInspector` (13), `estudios/grupos/nuevo` (12).

**Corrección:** mecánica pero son ~168 lugares, así que es una tanda propia. El patrón está
ya resuelto y probado en `src/lib/forms/field-a11y.ts`: `fieldA11y(nombre)` genera el id y
devuelve `labelFor` para el label y `input` para el campo, en dos líneas por campo.

## 4. Los errores de campo se ven pero no se vinculan al input

**Dónde:** transversal. Medido: 20 usos de `role="alert"`, pero solo **5**
`aria-invalid` y **2** `aria-describedby`.

**Qué pasa:** el mensaje de error se pinta debajo del campo (bien, y no depende
solo del color), pero el `<input>` no queda marcado como inválido ni apunta al
mensaje.

**Por qué importa:** quien usa lector de pantalla tabula al campo y escucha su
label, sin ninguna señal de que ese campo está en error ni cuál es el problema.
El mensaje existe en la pantalla pero no en el recorrido del campo.

**Corrección:** en cada campo con error, `aria-invalid={!!error}` y
`aria-describedby={error ? idDelMensaje : undefined}`, con el mensaje llevando ese
`id`. Conviene resolverlo en un componente de campo compartido en vez de en cada
formulario — hoy no existe uno.

## 5. 21 de 95 pantallas de administración no tienen `<h1>`

**Qué pasa:** el 22% de las páginas no declara su encabezado principal.

**Por qué importa:** el salto por encabezados es la forma en que un lector de
pantalla se orienta en una página. Sin `h1` no hay punto de entrada, y la persona
tiene que tabular desde el principio para saber dónde está.

**Corrección:** una por una, pero es mecánico: casi todas ya tienen un título
visual pintado con `<p>` o `<div>`. Es cambiar la etiqueta, no el diseño.

## 6. Cinco pantallas borran sin confirmar

**Dónde:** archivos con `method: 'DELETE'` y sin modal ni confirmación aparente:

- `app/(admin)/formularios/_components/FormAccessPanel.tsx`
- `app/(admin)/notificaciones/page.tsx`
- `app/(admin)/comunicaciones/page.tsx`
- `app/(admin)/eventos/[id]/_components/EventManagersPanel.tsx`
- `components/studies/PlanInvitations.tsx`

**Por qué importa:** el sistema no tiene borrado suave. Un clic de más quita un
acceso, una invitación o un encargado sin vuelta atrás.

**Cuidado con este hallazgo:** la detección es un proxy (busca `Modal` o
`confirm` en el archivo). Hay que verificar cada uno a mano antes de arreglarlo:
puede que la confirmación viva en el componente padre. **Ninguno está confirmado
como bug todavía.**

---

# MENOR

## 7. Área táctil: la ficha pide AAA, no AA

La ficha dice "mínimo 44×44 px". Eso es WCAG 2.2 **2.5.5, nivel AAA**. El mínimo
de **nivel AA** es **24×24** (2.5.8). Con ese criterio:

| Alto estimado | Botones | Estado |
|---|---|---|
| ~24px | 5 | al límite exacto de AA |
| ~28px | 4 | pasa AA |
| ~32-36px | 43 | pasa AA, no AAA |

Los 5 más chicos están en `MemberAdminTab.tsx` y `QueryBar.tsx` — pantallas de
**staff en escritorio**, no del miembro en celular. En los flujos del miembro solo
hay 7 por debajo de 44px y ninguno por debajo de 34px.

O sea: **no hay incumplimiento de AA**, y la prioridad real es más baja de lo que
la ficha sugiere. Si se quiere llegar a AAA, empezar por esos 5.

## 8. Dos formas distintas de decir "cargando"

Medido: **28** pantallas usan un booleano `loading`; **73** usan
`useState<T | null>(null)` y tratan `null` como cargando.

Las dos funcionan. El problema es de mantenimiento y de auditoría: al revisar si
una pantalla resuelve el estado de carga, el segundo patrón es invisible a
cualquier búsqueda — de hecho me dio 22 falsos positivos en esta misma auditoría
(incluido `mis-pagos`, que sí lo resuelve).

**Corrección:** elegir uno y documentarlo. No urge; sí conviene antes de que
alguien "arregle" una pantalla que no está rota.

## 9. Estados vacíos: 32 con el componente, 65 escritos a mano

`EmptyState` existe y se usa en 32 archivos, pero hay 65 textos del tipo "Sin
resultados" escritos directo. Los escritos a mano son los que suelen quedarse en
"sin resultados" sin decir qué hacer, que es lo que la ficha señala como
oportunidad perdida.

**Corrección:** pasar los de las pantallas del miembro a `EmptyState` con una
acción sugerida. No hace falta tocar los 65.

## 10. Doce anchos sueltos fuera de la convención

`PageContainer` existe con los tres anchos y se usa en 8 pantallas (el resto
hereda `work` del AppShell, que es lo correcto). Quedan **12** `max-w-*` a mano:
10 × `max-w-2xl`, 1 × `max-w-3xl`, 1 × `max-w-5xl`.

La inconsistencia que describe la ficha ya está en buena parte resuelta; esto es
la cola. Revisar si cada uno es un ancho de página (debería ser `PageContainer`) o
el ancho de un elemento interno (se queda como está, según `layout.md`).

## 11. Prosa un poco más ancha de lo ideal

`width="reading"` es `max-w-3xl` = 768px. A 16px eso da ~85-95 caracteres por
línea; la ficha pide 50-75. Afecta `/terminos` y las guías de `/ayuda`.

**Corrección:** bajar `reading` a `max-w-2xl` (672px, ~75 caracteres) en
`PageContainer.tsx`. Un valor, dos pantallas afectadas.

## 12. Tablas sin `scope` en los encabezados

43 tablas, 110 `<th>`, **1** con `scope=`. Para una tabla simple con una sola
fila de encabezados, `<th>` sin `scope` suele bastar: los lectores de pantalla lo
infieren. Vale revisarlo solo en las tablas con encabezados de fila y columna, si
hay alguna.

## 13. Un `focus:outline-none` sin reemplazo

En el editor de correo (`prose-email`, contenteditable). Los otros 8 tienen
`focus:ring` o `focus-visible`.

---

# Las 3 acciones de mayor impacto por esfuerzo

1. **Devolver el foco al cerrar el modal** — un archivo, 64 pantallas
   arregladas. Es el mejor cambio disponible por lejos.
2. **`role="alert"` para los toast de error** — una línea, y hace que los errores
   existan para quien usa lector de pantalla.
3. **Asociar los 168 labels con su input** — es la más grande de las tres en
   trabajo, pero es la única que es incumplimiento de nivel **A** (no AA): un
   input sin label no tiene nombre accesible. La herramienta ya está hecha
   (`fieldA11y`), así que es aplicar un patrón conocido, no diseñarlo.

Las tres son de accesibilidad, no de estética. Después de esas, el `<h1>` en las
21 pantallas: mecánico y mejora la orientación de inmediato.

**Estado al 2026-08-21:** las tres se implementaron parcialmente — ver el bloque
siguiente. La 1 y la 2 quedaron COMPLETAS; la 3 quedó con la herramienta lista y
aplicada a los flujos de entrada del miembro, con 165 casos de staff pendientes.

---

# Arreglado

## En la pasada de auditoría (solo lo trivial, como autoriza la ficha)

- `aria-label` en los 3 botones de solo ícono que no lo tenían:
  - `eventos/[id]/_components/EventHeader.tsx:173` → "Cerrar opciones de exportar"
  - `eventos/[id]/_components/EventHeader.tsx:242` → "Más acciones del evento" (+ `aria-haspopup="menu"`)
  - `eventos/page.tsx:385` → "Cerrar aviso de inscripción"

## En la tanda de las 3 acciones de mayor impacto

**Hallazgo 1 · COMPLETO.** `Modal.tsx` guarda el elemento con foco al abrir y lo
devuelve al cerrar. Con guarda de `isConnected`: si ese elemento se fue del DOM
junto con el modal (una fila borrada), no se intenta enfocarlo. **64 pantallas.**

**Hallazgo 2 · COMPLETO.** `Toast.tsx` usa `role="alert"` cuando el tipo es
`error` y `role="status"` para el resto.

**Hallazgo 4 · herramienta lista + aplicada a la entrada del miembro.** Se creó
`src/lib/forms/field-a11y.ts` (8 tests). Es una función y no un componente
`<Field>` a propósito: hay más de 20 formularios escritos y un componente
obligaría a reescribirlos para adoptarlo — lo que no se adopta no arregla nada.
Acepta un `id` explícito para no cambiar ids existentes, porque el navegador y el
gestor de contraseñas se acuerdan de un campo por su id.

Aplicado a las tres pantallas por donde pasa todo miembro:

| Pantalla | Qué se arregló |
|---|---|
| `login` | `aria-invalid` + `aria-describedby` en correo y contraseña; `role="alert"` en el banner de error |
| `recuperar` | ídem en el correo; `role="alert"` en el error de envío |
| `completar-perfil` | **los labels no estaban asociados** — ahora sí, más los aria y el ícono decorativo con `aria-hidden` |

**Hallazgo 3 · los 3 casos cercanos al miembro**, en `miembros/[id]/page.tsx`
(Estudio / Fecha / Estado del historial).

## Pendiente de esta tanda

Los **165** labels sin asociar de pantallas de staff (hallazgo 3). Es mecánico y
la herramienta está lista; es una tanda propia por volumen, no por dificultad.

---

# Cómo se midió

Todo reproducible desde la raíz del repo. Los ratios de contraste salen de
`src/lib/contrast.ts` (compone la opacidad sobre el fondo — medir el color puro
da un número optimista y falso) y quedan fijados por `src/lib/contrast.test.ts`.

Los conteos de código salen de recorrer `src/**/*.tsx` con expresiones regulares
sobre el JSX. **Limitación conocida:** el JSX no se puede leer del todo bien con
regex, y dos de mis mediciones dieron falsos positivos que hubo que corregir a
mano — los botones de solo ícono (41 aparentes → 3 reales, porque el texto vivía
dentro de una expresión) y los estados de carga (22 aparentes → varios resueltos
con el patrón `null`). Cualquier conteo de este informe que se vaya a usar para
priorizar conviene verificarlo en los archivos que lista.

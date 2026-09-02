# Plan de infografías de proceso

> Diagramas de flujo para explicar **cómo funcionan los procesos**, no dónde hacer clic.
> No dependen de staging: se dibujan, no se capturan. Por eso van primero.
>
> **Regla:** una infografía sirve cuando el problema es *entender el flujo*. Si el problema
> es *encontrar el botón*, eso es un tutorial con capturas, no una infografía.

## Formato y producción

- **SVG** con los colores de Theos (navy `#161440`, coral `#EF5554`, teal `#70BDC2`,
  papel `#F6F5F2`). Vectorial: se ve bien en pantalla, impreso y reenviado por WhatsApp.
- Guardadas en `public/ayuda/infografias/` — se versionan con el código y se insertan
  directo en las páginas de `/ayuda`.
- **Una página, orientación vertical** (se lee en celular sin hacer zoom).
- Cada una lleva: título, el flujo, y una nota al pie de "qué hacer si algo falla".
- Producción: las genero yo en SVG a partir de las reglas reales del código; vos revisás y
  pedís ajustes. Si alguna necesita más diseño, se pasa a Figma después.

---

## Tanda 1 · Antes del lunes 3 (para la capacitación del staff)

Son cuatro. No más: es lo que da tiempo de hacer bien y es lo que el staff necesita el día 1.

### 1. El camino del estudiante
Las cadenas N1 → N2 → N3 → N4 y DIS1 → DIS2 → DIS3, más las etapas (inicial, intermedia,
avanzada, campañas) con **los compromisos que pide cada una**: donante activo, servidor en
comité, asistencia activa (6 charlas/6 meses + 1 en 60 días) y reforzada (12). Marcar cuáles
son solo por invitación (CDEB, Hermenéutica, Cómo Dar Charlas).
*Por qué esta primero:* es el mapa mental de todo el módulo de estudios. Sin esto, nada de
matrícula ni elegibilidad se entiende.

### 2. Ciclo de vida de un grupo de estudio
`en matrícula → en curso → finalizado`, con lo que dispara cada transición: fechas de
matrícula automáticas, cupo, cierre con notas, herencia del grupo sucesor (mismo dirigente,
horario y zona) y generación de folletos del siguiente nivel.

### 3. La ruta de un pago
`pendiente → sube comprobante → en revisión → aprobado / rechazado`, con las dos cosas que
la gente siempre pregunta: qué pasa a las **72 horas** si el comprobante fue rechazado y no
se resube (se libera el cupo), y cómo una beca completa salta la revisión.

### 4. Quién ve qué — mapa de roles
Los 19 roles agrupados por familia (gestión, coordinación, operación, lectura) contra los
módulos. No es una tabla exhaustiva: es un diagrama de "si sos X, ves Y". Incluir la regla
de oro: sin rol asignado, sos miembro y solo ves lo tuyo.
*Por qué:* la pregunta #1 del staff en cualquier sistema nuevo es "¿por qué yo no veo eso?".

---

## Tanda 2 · Antes del lunes 17 (comités y servidores)

### 5. Los tres flujos de servicio que todos confunden
Solicitud de **puesto nuevo** (pedir que se cree un puesto que no existe) vs. solicitud de
**vacante** (pedir que se abra una plaza de un puesto existente, ventana el día 25 de cada
mes) vs. **aplicación** (servidores que aplican a una vacante abierta). Un diagrama de tres
carriles paralelos con quién hace qué en cada paso.
*Esta es la más valiosa de todas:* son tres cosas distintas con nombres parecidos.

### 6. Ciclo de un evento
Crear → inscripción → pago (o exención del comité organizador) → check-in → asistencia
registrada. Incluir que el check-in recalcula la sede del miembro.

---

## Tanda 3 · Antes del lunes 31 (miembros)

### 7. Tu primera vez en el sistema
Entrá → "Creá tu contraseña" → revisá tu correo → definí contraseña → listo.
Vertical, grande, cuatro pasos, pensada para reenviar por WhatsApp.
*Es la que va linkeada en los correos de invitación.*

### 8. Cómo me matriculo
Desde que la persona quiere un estudio hasta que queda matriculada: revisar si soy elegible
→ elegir grupo → pagar o pedir beca → subir comprobante → confirmación. Con el desvío de
"no aparece el estudio que quiero" (no cumplís un compromiso, o no hay grupo abierto).

---

## Tanda 4 · Después de agosto (flujos especializados)

No urgen para las tres entregas, pero valen para el equipo que los opera:

9. **Prematrimonial completo** — requisitos (N1 + inscrito en N2, ambos) → solicitud →
   revisión → grupo → cierre con evaluación de la pareja.
10. **Camino a ser dirigente (CDEB)** — recomendación al cerrar D3/Panorama → convocatoria →
    preinscripción → selección del comité → invitación → matrícula → pasantía.
11. **Becas y cupones** — solicitud → revisión → asignación → correo con el código → canje
    en el pago.
12. **Cuándo se generan los folletos** — cupo lleno / fin de matrícula con ≥5 estudiantes /
    manual, y luego `creada → en impresión → enviado → cerrada`.

---

## Orden de trabajo sugerido (esta semana)

| Día | Qué |
|---|---|
| **Miér 29** | Generar borradores de las 4 de la tanda 1 |
| **Jue 30** | Revisión tuya + ajustes · empezar staging en paralelo |
| **Vie 31** | Versión final de las 4 · publicarlas en `/ayuda` |
| **Sáb–dom** | Colchón: los 5 tutoriales base escritos (sin capturas todavía) |

Las capturas de pantalla de los tutoriales se toman **después** de staging, con datos
ficticios. Si algún tutorial se necesita antes, se publica sin capturas — el texto solo ya
sirve, y la imagen se agrega después.

---

## Mapa de contenido → roles

Cada infografía y tutorial declara en su frontmatter quién lo ve. En `/ayuda` cada persona
ve **solo lo que puede hacer**. `admin` ve todo siempre.

| # | Contenido | Visibilidad |
|---|---|---|
| 7 | Tu primera vez en el sistema | **pública** (sin sesión) |
| 8 | Cómo me matriculo | **pública** (sin sesión) |
| 1 | El camino del estudiante | **pública** (sin sesión) — también le sirve al miembro |
| 3 | La ruta de un pago | **pública** (versión miembro) + versión interna para la cola de revisión: `revision_pagos`, `folletos`, `finanzas`, `coordinador_estudios`, `coordinador_dirigentes`, `direccion` |
| 4 | Quién ve qué — mapa de roles | cualquier sesión con al menos un rol de gestión |
| 2 | Ciclo de vida de un grupo | `dirigente`, `editor_grupos_estudio`, `coordinador_estudios`, `coordinador_dirigentes`, `direccion` |
| 5 | Los tres flujos de servicio | **parte pública** (cómo aplico a una vacante) + interna: `lider_comite`, `coordinador_servidores`, `encargado_staff`, `direccion` |
| 6 | Ciclo de un evento | `encargado_eventos`, `comunicaciones`, `encargado_staff`, `direccion` |
| 9 | Prematrimonial completo | `coordinador_estudios`, `direccion` |
| 10 | Camino a ser dirigente (CDEB) | `dirigente` (la parte de recomendar), `coordinador_dirigentes`, `coordinador_estudios` |
| 11 | Becas y cupones | **parte pública** (cómo pido una beca) + interna: `becas`, `finanzas`, `direccion` |
| 12 | Cuándo se generan los folletos | `folletos`, `coordinador_estudios` |

Criterio: si un proceso tiene una cara para el miembro y otra para quien lo gestiona, se
parte en dos piezas (una pública, una interna) en vez de hacer una sola que muestre de más.

---

## Checklist de calidad por infografía

- [ ] ¿Se entiende sin que nadie la explique?
- [ ] ¿Cabe en una pantalla de celular sin zoom?
- [ ] ¿Los términos son los que la gente usa en Theos, no los del código?
- [ ] ¿Dice qué hacer cuando algo sale mal?
- [ ] ¿Refleja las reglas reales del sistema? (verificar contra `docs/sistema-overview.md`)
- [ ] ¿Cero datos reales de personas?

# Verificación de cierres · formulario "EB — Fin de Capacitación"

Corrida del 2026-08-28 sobre **todo el archivo (2018-2026)**. Este informe **no cambió nada en la base**:
sale de `scripts/verificacion-cierres-2026-08/informe.ts`, que solo lee.

## Resumen ejecutivo

| | |
|---|---|
| Respuestas del formulario | 522 |
| **Cierres que nos faltan** (cruce 1) | **0** |
| ↳ cerrables con este formulario | 0 |
| ↳ con gente que el formulario no menciona | 0 |
| Pendientes de graduación con evidencia fuerte (cruce 2) | 0 |
| ↳ con evidencia solo débil | 1 |
| Grupos cerrados sin formulario (cruce 3) | 1298 |
| Grupos en curso en total | 93 |

### Respuestas que dicen un nivel

Este formulario es de **capacitaciones**: un Nivel 1-4 acá es una anomalía. Se
reportan y **no** se usan para proponer cierres.

- `Nivel 2` — Andreina Mainieri, 2021-06-03
- `NIvel 4` — Sergio Colombari, 2024-08-27
- `Nivel 4` — Diana Madriz, 2024-08-29

### Lo que no se pudo resolver

**8 respuesta(s) con una capacitación que no mapea a ningún plan.** No se adivina el plan más parecido:

- `Sí` — Harold Espinal, 2018-08-30
- `si` — Sheyla Britton, 2018-08-30 · comentario: "Excelente grupo, todos con corazones de amor para el Señor, super entusiastas y comprometidos. Demasiado chiva…"
- `Dios y el dinero` — Andrea Zamora, 2018-08-31 · comentario: "Oona, Laura y Massiel estamos viendo si podemos reponerlos"
- `Si` — Stanley Benavides, 2018-09-02 · comentario: "Aprovecho para reiterar el agradecimiento por estas oportunidades que sin duda han cambiado mi vida y a la vez…" → ¿AED?
- `Servidores 2` — Keylor Navas, 2019-04-08 · comentario: "Este curso ya vio panorama y religiones del mundo pero no se había hecho la finalización" → ¿PAN?
- `Liderazgo` — Adriana Sanchez, 2019-11-27 · comentario: "personas demasiado comprometidas y con mucho que dar"
- `Conociendo a Jesús` — Georgina Umana, 2022-06-29
- `(vacío)` — Guiselle Trejos, 2026-05-10 · comentario: "El curso era Discípulos 2" → ¿DIS2?

## Cruce 1 · Grupos en curso que ya deberían estar cerrados

El dirigente reportó el fin de esa capacitación y el grupo sigue abierto en el
sistema. Criterio: mismo plan, el dirigente (o co-dirigente) del grupo es quien
firmó el formulario, y la fecha de finalización reportada es **posterior** a la
fecha de inicio del grupo.

Ninguno.

## Cruce 2 · Graduaciones pendientes con evidencia en el formulario

Personas cuya graduación de CCB no encontró matrícula destino. La evidencia
viene en dos calidades y **no se mezclan**.

> Esta sección **no depende del año** del informe: la cola de graduaciones
> pendientes es una sola, y el formulario que la resuelve puede ser de
> cualquier fecha. Sale igual en la corrida de 2025 y en la de 2026.

| | |
|---|---|
| Procesos `Done` de CCB | 736 |
| Pendientes con **evidencia fuerte** | 0 |
| Pendientes con **evidencia débil** | 1 |
| Pendientes sin ninguna evidencia (quedan manuales) | 37 |

### Evidencia fuerte

La cola de CCB nombra una capacitación concreta y un dirigente menciona a la
persona en el formulario **de esa misma capacitación**. Ese formulario dice en
qué grupo fue.

Ninguna.

### Evidencia débil

La cola es genérica (`Reprueba Capacitación` no dice **cuál**). Lo único
ofrecible son menciones en listas de reprobados dentro de ±180 días del
proceso. **No alcanza para resolver solo**: es una pista de por dónde buscar.

| Persona | Cola de CCB | Fecha del proceso | Formulario | ¿Es un grupo del cruce 1? | Lista | Nota | Línea original |
|---|---|---|---|---|---|---|---|
| Jose Pablo Ramírez Bolanos | Reprueba Capacitación | 2026-08-24 | Leticia Villalobos, 2026-08-31 (DIS3) | no | reprobados | — | `Jose Pablo Ramírez Bolaños - ausencias` |


## Cruce 3 · Cierres en el sistema sin formulario

Grupos finalizados en todo el archivo (2018-2026) cuyo dirigente **nunca** envió el formulario de esa
capacitación — en ningún año, porque los formularios llegan con atraso. **No es un
error del sistema** — es gente que no llenó el form.

**1298 grupos.**

| Año | Grupos cerrados | Sin formulario | % |
|---|---|---|---|
| 2010 | 1 | 0 | 0% |
| 2013 | 10 | 9 | 90% |
| 2014 | 65 | 48 | 74% |
| 2015 | 114 | 88 | 77% |
| 2016 | 80 | 51 | 64% |
| 2017 | 162 | 145 | 90% |
| 2018 | 94 | 41 | 44% |
| 2019 | 290 | 210 | 72% |
| 2020 | 176 | 79 | 45% |
| 2021 | 136 | 80 | 59% |
| 2022 | 161 | 98 | 61% |
| 2023 | 68 | 47 | 69% |
| 2024 | 165 | 90 | 55% |
| 2025 | 339 | 256 | 76% |
| 2026 | 109 | 56 | 51% |

El detalle grupo por grupo está en `scripts/output/grupos-cerrados-sin-formulario.csv` — 1298 filas no entran
en una tabla legible.

---

## Cómo leer esto

Las listas del formulario son **texto libre**. El parser (`src/lib/studies/ccb-form-parse.ts`,
con tests) resuelve las grafías que aparecen de verdad en el archivo y **descarta lo
que no parece una persona en vez de adivinar**. Dos reglas que importan:

- **Ambigüedad no se resuelve sola.** Un nombre con dos candidatos en la base sale
  marcado ⚠️ con los dos, no se elige el primero.
- **Las notas en escala 0-10 no se convierten.** Un "9.0" puede ser un 9 o un 90;
  esos casos salen como `⚠️ "9.0"` y la nota queda vacía. Las que sí salen están
  en escala 0-100, que es la de `study_enrollments.grade` (verificado: los 252
  valores que ya hay en la base van de 70 a 105,2).

### Cómo volver a correrlo

```bash
NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/informe.ts --anio todos
```

El script **solo lee**. Los arreglos van después, caso por caso.

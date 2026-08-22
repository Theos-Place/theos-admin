---
titulo: Cómo se calcula el análisis de estudios
seccion: Estudios
tipo: tutorial
visibilidad: roles
roles: [dirigente, coordinador_estudios, coordinador_dirigentes, direccion]
orden: 11
resumen: De dónde sale cada número de la pantalla de análisis, qué significa «demanda», cómo se cuenta a alguien que asiste a dos sedes, y qué NO mide.
---

# Cómo se calcula el análisis de estudios

La pantalla de **Análisis de estudios** estima cuánta gente podría llevar un
estudio en el bloque siguiente. Sirve para decidir cuántos grupos abrir y dónde.
Este artículo dice de dónde sale cada número, porque tomar una decisión con un
número que significa otra cosa sale caro.

## «Demanda» son dos grupos distintos, no uno

La pantalla suma dos categorías que no se calculan igual:

**Por graduarse.** Gente que HOY está inscrita en el estudio anterior (el
prerequisito) y ya va avanzada: lleva al menos la mitad de las semanas, o le
quedan 5 o menos. Todavía no terminó, pero va a terminar.

**Elegibles.** Gente que YA completó el prerequisito, no está inscrita en el
estudio objetivo y no lo completó antes.

Las dos categorías exigen además los **compromisos de la etapa** del estudio al
que se quiere llegar. La suma de ambas es la demanda estimada.

## Los compromisos por etapa

| Etapa del estudio | Donador | Servidor activo | Asistencia |
|---|---|---|---|
| Niveles (N1–N4) | — | — | — |
| Campañas | — | — | — |
| Inicial | no | no | general |
| Intermedia | **sí** | **sí** | reforzada |
| Avanzada | **sí** | **sí** | reforzada |

- **Asistencia general**: al menos 6 charlas en los últimos 6 meses, y una en los
  últimos 60 días.
- **Asistencia reforzada**: lo mismo pero con 12 charlas.

Niveles y campañas no piden nada: por eso su demanda siempre sale más alta, y no
es un error.

## La columna de zona: leela con cuidado

Es lo que más se malinterpreta, así que va derecho:

**La zona NO es dónde vive la persona.** Es una cadena de tres pasos:

1. Si el perfil tiene **provincia** en la dirección, se usa esa.
2. Si no, se usa la **sede donde hace check-in**.
3. Si no tiene ninguna de las dos, cae en **«Sin zona»**.

En la práctica, al 21 de agosto de 2026, sobre 23.723 miembros activos:

| De dónde salió la zona | Personas |
|---|---|
| Provincia de la dirección | **6** |
| Sede donde asiste | 11.215 |
| Sin zona | **12.502** |

Dos cosas que hay que saber por eso:

- **La columna es, casi toda, sede de asistencia**, no lugar de residencia. La
  provincia aplica a 6 personas: el perfil casi nunca la tiene llena.
- **«Sin zona» es más de la mitad del padrón.** No es un error de cálculo: son las
  personas que **nunca hicieron check-in** (11.475 activos no tienen ninguno). Sin
  check-in no hay sede, y sin dirección tampoco hay provincia.

Así que el desglose por zona sirve para comparar entre sedes con actividad, pero
**no sirve para saber dónde vive la gente** ni para estimar demanda en un lugar
donde todavía no hay charlas.

## Alguien que asiste a dos sedes cuenta en UNA

Cada persona tiene una sola sede, la calcula el sistema y gana **la sede donde
más veces hizo check-in en los últimos 6 meses**. Si hay empate, gana la más
reciente.

Un detalle: si alguien dejó de asistir hace más de 6 meses, la ventana no son los
últimos 6 meses calendario sino los 6 meses anteriores a su última visita. Así no
pierde su sede solo por haberse ausentado.

O sea que en el análisis **nadie se cuenta dos veces**, pero tampoco se ve que una
persona reparte su asistencia entre dos sedes.

## Qué NO mide este análisis

Esto es lo importante para no decidir mal:

- **No es una lista de inscritos.** Es quién PODRÍA llevar el estudio, no quién lo
  va a llevar. La conversión real siempre es menor.
- **No mide interés.** Nadie dijo que quiere llevarlo. Para eso está la cola de
  solicitudes de interés, que es otra pantalla.
- **No considera horarios ni cupos.** Que haya 40 elegibles en una sede no
  significa que entren en un grupo, ni que puedan a la misma hora.
- **No mira si hay dirigente disponible.** Eso se ve en el reporte de Dirigentes.
- **No incluye a quien no cumple los compromisos**, aunque haya terminado el
  prerequisito. Alguien que completó SCJ pero dejó de asistir no aparece.
- **No proyecta al futuro.** Es una foto de hoy: quién está avanzado y quién ya
  terminó. Si el bloque abre en tres meses, la foto va a ser distinta.

## Si un número te sorprende

Los dos casos más comunes:

**«Hay menos gente de la que esperaba»** — casi siempre son los compromisos. En
intermedia y avanzada se piden donador Y servidor activo Y 12 charlas; con que
falte uno, la persona no cuenta.

**«Casi todo cae en Sin zona»** — es lo esperable con los datos de hoy, por lo
explicado arriba. Mirá el total en vez del desglose por zona.

Si un número no cuadra con lo que ves en los grupos, avisale a TI antes de tomar
la decisión: puede ser un dato mal migrado y conviene revisarlo.

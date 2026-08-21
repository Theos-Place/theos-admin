---
titulo: Quién ve qué — mapa de roles
seccion: Primeros pasos
tipo: infografia
visibilidad: gestion
orden: 20
resumen: Por qué vos ves unas pantallas y otra persona ve otras, y cómo se pide un acceso.
---

# Quién ve qué

![Los roles agrupados por familia y los tres alcances posibles](/ayuda/infografias/mapa-de-roles.svg)

La pregunta número uno cuando se estrena un sistema es *"¿por qué yo no veo eso?"*. La
respuesta casi siempre es la misma: **el sistema muestra únicamente lo que podés hacer**.

## La regla de oro

Sin ningún rol asignado, sos **miembro**: ves tu perfil, tus estudios, tus pagos y los de tu
familia. Nada más. No es un castigo ni un error de configuración; es el estado normal de la
mayoría de las 23 mil personas del padrón.

Cada rol que se te asigna **abre** pantallas. Nadie tiene "todo menos algo": se suma, no se
resta.

## Cómo se agrupan los roles

**Dirección y administración** — ven casi todo. `admin` no tiene límite; `direccion` gestiona
los módulos pero no toca los accesos.

**Coordinación** — cada coordinación manda en su módulo: `coordinador_estudios`,
`coordinador_dirigentes`, `coordinador_servidores`, `encargado_staff`, `encargado_eventos`,
`comunicaciones`, `finanzas`.

**Roles acotados** — hacen una cosa sola, y por eso son los más útiles para delegar sin dar
poder de más: `folletos` (la cola de folletos), `revision_pagos` (revisar comprobantes),
`becas` (becas y cupones), `editor_perfiles` (editar fichas), `editor_grupos_estudio` (crear y
editar grupos, y nada más de estudios: sin plan, dirigentes, análisis ni solicitudes),
`forms` (todos los formularios y sus respuestas), `reportes`, `solo_lectura`.

**Permisos sobre UNA cosa** — no son roles: se dan sobre un recurso concreto y no alcanzan a
nada más. Son la forma de delegar una actividad sin abrir un módulo entero.

- **Encargada de un evento** — se agrega en la configuración del evento, sección *Encargados
  de este evento*. Ve y gestiona **ese** evento completo (inscripciones, check-in, servidores,
  reportes y edición) sin tener el módulo de Eventos, y ningún otro evento. Si el evento tiene
  formulario, lo hereda: no hay que dárselo por separado. Solo dirección, encargado de staff,
  comunicaciones y admin pueden nombrar encargados — quien recibe el permiso no lo reparte.
- **Acceso a un formulario suelto** — en la configuración del formulario. Ve y exporta las
  respuestas de **ese** formulario y de ningún otro. No habilita a editar las preguntas.

**Roles que salen de servir** — `dirigente` (dirige un grupo de estudio) y `lider_comite`
(lidera un comité). Estos dos no se piden: se asignan cuando entrás a ese puesto, y se quitan
cuando salís.

## El alcance importa tanto como el rol

Dos personas con el mismo módulo pueden ver cosas distintas, porque el rol define el
**alcance**:

- **Todo** — ve la organización completa.
- **Su comité** — el líder de comité ve a su gente, no al padrón entero.
- **Lo propio** — el dirigente ve sus grupos; el miembro, su ficha.

Por eso los resúmenes generales (la portada de Estudios, la de Servidores) piden alcance
completo: son la foto de toda la organización, no de tu pedazo.

## Casos que confunden seguido

**"Veo el módulo pero no el listado."** Pasa en Miembros: el listado completo del padrón pide
alcance total. Con alcance de comité ves a tu gente desde tu comité, y las fichas por link
directo.

**"Entré al perfil de alguien y no vi la pestaña administrativa."** Esa pestaña tiene datos
sensibles y su propio permiso.

**"Mi compañera ve una pantalla y yo no, y tenemos el mismo puesto."** Los roles se asignan a
personas, no a puestos. Puede faltarte uno.

## Cómo se pide un acceso

Escribí a **soporte@theosplace.org**. El coordinador de estudios puede delegar por su cuenta
tres roles acotados — editor de perfiles, editor de grupos de estudio y folletos — sin pasar
por administración.

> Si vas a pedir un acceso, pedí el más acotado que resuelva tu trabajo. Es más fácil de
> aprobar y más fácil de auditar después.

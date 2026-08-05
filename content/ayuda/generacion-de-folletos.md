---
titulo: Cuándo se generan los folletos
seccion: Estudios
tipo: infografia
roles: [folletos, coordinador_estudios]
orden: 30
resumen: Los cuatro motivos por los que nace un pedido de folletos, sus cuatro estados y por qué no se puede volver atrás.
---

# Cuándo se generan los folletos

![Los cuatro motivos por los que nace un pedido de folletos y sus cuatro estados](/ayuda/infografias/generacion-de-folletos.svg)

Los pedidos de folletos **casi nunca se crean a mano**: los dispara el sistema cuando pasa algo
en estudios.

## Por qué nace un pedido

Los dos automáticos salen de la **matrícula del propio grupo** — el folleto es del nivel que
esa gente va a cursar, no del siguiente:

- **El grupo llenó su cupo.** Al confirmarse la matrícula que completa el cupo, se pide el
  folleto de ese grupo. No hay que esperar a nada más: ya se sabe cuánta gente es.
- **Se cerró la matrícula.** Cuando vence la ventana de matrícula del grupo, si juntó al menos
  5 personas, se pide el folleto con lo que haya.

Y dos que dispara una persona:

- **Reubicación.** Cuando alguien se mueve a otro grupo y marcó que necesita el folleto ahí.
- **Manual.** Para lo que no encaja en los anteriores.

> **Cerrar un grupo ya NO genera folletos.** Antes sí: al cerrar se pedía el folleto del
> siguiente nivel. Se cambió porque el folleto llegaba tarde — la gente ya estaba matriculada
> en el nivel siguiente sin material. Los hitos de un bloque tampoco generan pedidos: mandan
> el **reporte** de folletos por sede, para planificar la impresión.

## Los cuatro estados

`creada → en impresión → enviado/entregado → cerrada`

Es **lineal**: no hay retroceso. Si te pasaste de estado por error, no se devuelve — se
documenta en el pedido y se corrige la cantidad, o se crea el pedido que falte.

La **fecha estimada** se calcula como el cierre más dos semanas. Es una estimación para
planificar la impresión, no una promesa a nadie.

## Qué revisar en la cola

**La sede.** Los pedidos se agrupan por sede: un pedido con la sede equivocada hace que los
folletos lleguen al lugar equivocado.

**La cantidad contra los matriculados reales.** Entre que se genera el pedido y se imprime, la
matrícula sigue moviéndose. Revisá el número antes de mandar a imprimir, no después.

## Quién trabaja esto

El rol `folletos` existe justamente para esto: da acceso a la cola de folletos sin dar el
módulo de estudios completo. Es el ejemplo típico de un permiso acotado — quien imprime no
necesita poder editar grupos ni ver el padrón.

Ese mismo rol ve también la cola de revisión de pagos, porque el folleto se cobra.

> Si un pedido ya está en impresión y el grupo cambia de cantidad, no toques el pedido: dejá el
> registro como está y creá un pedido manual por la diferencia. Así queda claro qué se imprimió
> y cuándo.

---
titulo: Cuándo se generan los folletos
seccion: Estudios
tipo: tutorial
roles: [folletos, coordinador_estudios]
orden: 30
resumen: Los cinco motivos por los que nace un pedido de folletos, sus cuatro estados y por qué no se puede volver atrás.
---

# Cuándo se generan los folletos

Los pedidos de folletos **casi nunca se crean a mano**: los dispara el sistema cuando pasa algo
en estudios. Saber qué los dispara evita pedidos duplicados.

## Por qué nace un pedido

- **Cierre de grupo.** Al cerrar un grupo de N1 a N3 o DIS1 a DIS2, se genera el pedido del
  **siguiente** nivel: la cohorte avanza junta y va a necesitar el folleto que viene.
- **Hitos de un bloque de capacitación.** Un bloque activo tiene fechas; al caer cada hito se
  generan los pedidos correspondientes — preliminar, confirmación y final — y se avisa por
  correo y notificación.
- **Reubicación.** Cuando alguien se mueve a otro grupo y necesita su folleto ahí.
- **Manual.** Para lo que no encaja en los anteriores.

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

**Los duplicados.** Si un grupo se cerró dos veces por un error, pueden existir dos pedidos del
mismo folleto. Se detectan mirando grupo y nivel.

## Quién trabaja esto

El rol `folletos` existe justamente para esto: da acceso a la cola de folletos sin dar el
módulo de estudios completo. Es el ejemplo típico de un permiso acotado — quien imprime no
necesita poder editar grupos ni ver el padrón.

Ese mismo rol ve también la cola de revisión de pagos, porque el folleto se cobra.

> Si un pedido ya está en impresión y el grupo cambia de cantidad, no toques el pedido: dejá el
> registro como está y creá un pedido manual por la diferencia. Así queda claro qué se imprimió
> y cuándo.

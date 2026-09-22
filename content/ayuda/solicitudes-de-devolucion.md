---
titulo: Solicitudes de devolución
seccion: Finanzas
tipo: tutorial
visibilidad: roles
roles: [finanzas, direccion]
orden: 40
resumen: Cómo se registra una devolución, los cuatro estados por los que pasa, la opción de convertirla en donación, y por qué la plata siempre la mueve una persona.
---

# Solicitudes de devolución

![Los cuatro estados de una devolución —pendiente, procesando, completada, rechazada— y la salida alterna de convertirla en donación](/ayuda/infografias/solicitudes-de-devolucion.svg) ![Registrar una devolución sobre un cobro ya cobrado, paso a paso](/ayuda/tutoriales/devoluciones/devoluciones.gif)

Una devolución es plata que ya entró y que hay que sacar: alguien pagó de más,
pagó dos veces, o se salió de un estudio que ya había pagado.

Vive en **Finanzas → Devoluciones**.

## Lo primero, y lo que más se olvida

**El sistema no mueve plata.** Registrar la devolución deja el rastro, avisa a
quien corresponde y cuadra los reportes — pero el SINPE o la transferencia de
vuelta **la hace una persona, a mano**.

Esto ya causó un problema: hasta setiembre el modal decía que las devoluciones
que no fueran SINPE "se procesan automáticamente a través de la pasarela de
pago". La pasarela ni siquiera está activa, y casi todos los pagos del sistema
son por comprobante. Alguien podía cerrar la pantalla creyendo que la plata iba
en camino sola. Hoy el aviso dice siempre quién tiene que mover la plata.

## Quién puede

**Finanzas y dirección.** Ellos crean la solicitud y ellos la procesan; el
miembro no la pide desde su pantalla.

## Cómo se registra

La devolución **cuelga de un pago**, no se crea en el aire. Se busca el pago y
se pide devolver.

Dos cosas que el sistema no deja pasar:

- **Solo se devuelven pagos cobrados.** Si el pago está pendiente o rechazado,
  no hay nada que devolver — lo que hay que hacer es cerrarlo sin cobrar.
- **No se puede devolver más de lo que entró.** Y cuenta lo ya devuelto antes:
  si de un pago de ₡20.000 ya se devolvieron ₡5.000, el máximo que acepta es
  ₡15.000. Esa validación corre dentro de la misma operación, no antes, para
  que dos personas trabajando a la vez no logren sobre-devolver.

Además se clasifica: **estudio, campaña, evento, prematrimonial, folletos u
otro**. La clasificación es la que después hace legibles los reportes.

## Los cuatro estados

| Estado | Qué significa |
|---|---|
| **Pendiente** | Registrada, todavía nadie movió plata |
| **Procesando** | Alguien la tomó y está haciendo la transferencia |
| **Completada** | La plata salió. Se guarda la fecha y el número de confirmación |
| **Rechazada** | No procede. Se guarda el motivo |

Al completar conviene pegar el **número de confirmación** del SINPE o la
transferencia: es lo único que permite rastrearla después si la persona dice que
nunca le llegó.

Una devolución **se procesa una sola vez**. Si dos personas la abren a la vez,
la segunda recibe un aviso de que ya fue resuelta en vez de pisar lo que hizo la
primera.

## Convertirla en donación

Hay un camino alterno: en vez de devolver la plata, **la persona la deja como
donación**. Es común cuando el monto es pequeño o cuando ella misma lo ofrece.

Se hace desde la devolución, con el botón de convertir. Queda registrada como
donación a nombre suyo, con todo lo que eso implica: le cuenta como donante y le
aparece en su historial.

Tres condiciones:

- La devolución **no puede estar ya resuelta**. Si se completó o se rechazó, ya
  no se convierte.
- **No se puede convertir dos veces** — el sistema lo corta.
- **Tiene que tener un miembro asociado.** Sin ficha no hay a quién acreditarle
  la donación.

> **Preguntale antes.** Convertir es a nombre de la persona y le cambia su
> historial de donaciones. No es una manera de cerrar una devolución incómoda.

## Si algo no cuadra

**"No me deja crear la devolución."** Mirá el estado del pago: solo los cobrados
admiten devolución.

**"Dice que el monto excede lo devolvible."** Ese pago ya tuvo devoluciones
antes. El mensaje te dice el máximo que queda.

**"Ya la procesé y sigue apareciendo."** Refrescá la pantalla; si sigue,
probablemente alguien más la tomó primero y quedó con el estado de esa persona.

![Ver el video del flujo completo](/ayuda/tutoriales/devoluciones/devoluciones.mp4)

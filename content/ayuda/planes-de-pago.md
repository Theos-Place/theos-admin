---
titulo: Cómo funcionan los planes de pago
seccion: Finanzas
tipo: tutorial
visibilidad: roles
roles: [finanzas, direccion]
orden: 30
resumen: Un arreglo parte un cobro pendiente en tractos. Quién lo crea, qué libera el primer tracto, qué bloquea uno vencido, y por qué cancelar no es lo mismo que condonar.
---

# Cómo funcionan los planes de pago

![Un arreglo de pago paso a paso: partir el cobro en tractos, qué libera el primero, qué bloquea uno vencido y la diferencia entre cancelar y condonar](/ayuda/infografias/planes-de-pago.svg) ![Partir un cobro pendiente en tractos, paso a paso](/ayuda/tutoriales/planes-de-pago/planes-de-pago.gif)

Un **arreglo de pago** parte un cobro que la persona no puede pagar de una en
varios **tractos** con su propia fecha de vencimiento.

Lo importante de entender antes de crear el primero: **los tractos no son un
invento aparte**. Cada uno es un cobro normal, igual que cualquier otro. Pasan
por la misma cola de revisión, se les sube el mismo comprobante y cuentan igual
en los reportes. Lo único que los une es que pertenecen al mismo arreglo.

## Quién lo crea

**Finanzas, dirección y admin.** Nadie más, y el miembro no puede pedirlo desde
su pantalla: lo conversa con finanzas y finanzas lo arma.

Se crea **sobre un cobro que esté pendiente**. Si el cobro ya se aprobó, ya se
rechazó o ya está dentro de otro arreglo, el sistema no deja — y hace bien,
porque partir en tractos algo ya cobrado dejaría el saldo torcido.

## Cómo se arma

Se elige **en cuántos tractos** (mínimo 2, máximo 24) y **la fecha del primer
vencimiento**. El resto lo calcula el sistema:

- **El monto se parte exacto.** Si no da redondo, los céntimos o colones que
  sobran van a los **primeros** tractos, no a los últimos. Es a propósito: si el
  arreglo se cae a mitad de camino, lo que ya se cobró es mayor.
- **Los vencimientos van mes a mes** desde el primero. Si el día no existe en el
  mes siguiente —un arreglo que arranca el 31 de enero— el tracto cae al último
  día de febrero, no se salta a marzo.

> **Por ahora todos los arreglos son mensuales.** La opción de quincenal está
> pedida (FIN-8) pero todavía no existe: no la busqués en la pantalla.

## Las tres reglas que hay que saber de memoria

**1. El primer tracto aprobado libera lo que se estaba pagando.** Apenas entra
el primer pago, la matrícula queda hecha o el tiquete del evento queda
confirmado. La persona no tiene que esperar a terminar de pagar para empezar el
estudio. El resto es deuda.

**2. Un tracto vencido e impago bloquea.** Mientras haya uno vencido sin pagar,
esa persona no se puede matricular en otro estudio ni inscribir en otro evento
de paga. Un tracto futuro al día **no** bloquea: solo cuenta el que ya se pasó
de fecha.

El mensaje del bloqueo le dice cuántos tractos debe, cuánto suman y desde
cuándo. Si debe en dos monedas, los montos van separados — sumar colones con
euros daría un número que no significa nada.

**3. Cancelar el arreglo NO perdona la deuda.** Esta es la que más se confunde.
Cancelar solo cierra el arreglo: **los tractos impagos siguen pendientes**,
siguen bloqueando y siguen entrando en los recordatorios semanales.

Para perdonar de verdad hay que usar **"Cerrar sin cobrar"** en cada cobro. Son
dos cosas distintas y la pantalla no las junta a propósito: condonar plata es
una decisión que se toma cobro por cobro, no de un solo clic.

## Si algo no cuadra

**"No me deja crear el arreglo."** Casi siempre es que el cobro no está
pendiente. Miralo primero: si ya se aprobó, no hay nada que partir.

**"Cancelé el arreglo y la persona sigue bloqueada."** Es lo esperado — ver la
regla 3. Lo que hay que hacer es cerrar sin cobrar los tractos que se van a
perdonar.

**"El último tracto quedó con un monto distinto."** También es lo esperado: el
sobrante va a los primeros. La suma de todos da exacto el total original.

![Ver el video del flujo completo](/ayuda/tutoriales/planes-de-pago/planes-de-pago.mp4)

---
titulo: Adelantos de comida por sede
seccion: Finanzas
tipo: tutorial
visibilidad: roles
roles: [colaborador_finanzas, finanzas, direccion]
orden: 41
resumen: Qué es el adelanto mensual de comida de una sede, quién lo administra, cómo se registran las facturas de cada semana y cómo se cierra el mes.
---

# Adelantos de comida por sede

Cada sede recibe un **adelanto mensual** para la comida de sus charlas. La
pantalla **Finanzas → Adelantos de comida** (`/finanzas/adelantos`) reemplaza
los Excel de cada mes: se registra cada factura en su semana y el sistema va
restando en vivo.

## Quién entra

- En cada sede, **el Encargado de Logística y el Coordinador de Comida** (por
  su puesto en el comité de la sede). Ven y administran solo SU sede; no hace
  falta pedir el permiso, llega con el puesto.
- **Finanzas, dirección y admin** ven todas las sedes, fijan el presupuesto y
  cierran los meses.

Si tenés uno de esos puestos y no ves la pantalla, revisá en Servidores que tu
puesto esté activo en el comité de la sede: el acceso sale de ahí.

## Cómo funciona el mes

1. **Presupuesto.** Finanzas fija el monto mensual de cada sede. Es un dato de
   la sede, no del mes: se copia al abrir cada mes, así subirlo en noviembre no
   reescribe el saldo de octubre.
2. **Abrir el mes.** La sede abre el mes en curso con ese presupuesto. Solo se
   puede abrir el mes actual.
3. **Registrar facturas.** Cada factura va en la **semana** de la charla a la
   que corresponde, con la fecha, el proveedor, el número de factura
   electrónica, el monto, el encargado de esa semana y la foto de la factura.
   Una factura nace *pendiente* y pasa a *liquidada* cuando finanzas la
   concilia.
4. **El saldo.** Lo pendiente también resta: la plata ya se gastó aunque
   finanzas no la haya liquidado. Si el mes se pasa del presupuesto, la
   pantalla lo marca como **sobregiro** pero no bloquea: el reglamento pide
   identificar por qué y decidir si hay reintegro, no impedir que se registre.
5. **Cerrar el mes.** Lo hace finanzas cuando no quedan facturas pendientes.
   Al cerrar se guarda el saldo final, que es lo que decide la reposición del
   mes siguiente.

## Reglas que la pantalla hace cumplir

- Una factura de otro mes no entra en este.
- No se cierra un mes con facturas pendientes.
- Una sede ajena da «esa sede no es tuya»: el alcance es por puesto, no por
  rol general.

## Exportar

Finanzas puede bajar el mes en Excel, con las facturas por semana y el saldo,
para la conciliación.

---
titulo: Formularios, de principio a fin
seccion: Formularios
roles: [forms, comunicaciones, encargado_staff, encargado_eventos, direccion]
orden: 1
resumen: Armar un formulario, ponerle portada, decidir quién ve las respuestas y engancharlo a un evento.
---

# Formularios, de principio a fin

Un formulario sirve para dos cosas distintas y conviene tenerlas separadas en la cabeza:
**recoger información** (una encuesta, una inscripción a una actividad) y **ser una pieza de
comunicación** que la gente abre desde el celular.

## Armarlo

En **Formularios → Nuevo**. Le ponés nombre, una descripción opcional y vas agregando campos
desde el panel de la izquierda.

Dos cosas que se olvidan:

- Un campo **sin etiqueta** no se puede guardar: un formulario con preguntas en blanco es
  inservible y el sistema lo frena.
- Mientras esté en **borrador** no lo ve nadie más que vos. Se publica cambiándolo a activo.

## El encabezado (la portada)

Arriba del constructor hay un bloque **"Encabezado (opcional)"**: una imagen —el flyer—, un
título y un párrafo de bienvenida. Con eso el formulario abre como una pieza de comunicación
en vez de un cuestionario pelado.

- La imagen se sube ahí mismo: JPG, PNG o WEBP, hasta 5 MB. Se guarda en el sistema, no se
  enlaza de otro lado.
- Si no ponés título, se usa el nombre del formulario.
- Se puede quitar en cualquier momento, y sin encabezado el formulario se ve como siempre.

Abajo del bloque hay una vista previa de cómo va a quedar. Vale la pena mirarla: la mayoría de
la gente lo abre desde el teléfono.

## Quién ve las respuestas

Tres caminos, de más amplio a más acotado:

1. **El módulo de formularios** (`forms`, comunicaciones, encargado de staff, dirección):
   todos los formularios y todas las respuestas.
2. **Encargada del evento**, si el formulario pertenece a un evento. Lo hereda: no hay que
   darle acceso al formulario por separado.
3. **Acceso puntual a ese formulario**, desde su propia configuración. Ve y exporta las
   respuestas de **ese** formulario y de ningún otro. No puede editar las preguntas.

El tercero es el que sirve para delegar: la encargada de una actividad ve lo que necesita sin
que le abramos el módulo entero.

## Engancharlo a un evento

En la configuración del evento se elige el **formulario de inscripción**. Se le pide a quien
se inscribe y la respuesta queda enlazada a su inscripción.

**Ojo con lo que NO hace:** la inscripción al evento no depende del formulario. El cupo, el
pago y el check-in viven en la inscripción. Alguien que se inscribe y no llena el formulario
**está inscrito igual** — el formulario es información adicional, no la puerta.

## Cosas que confunden

**"Llené el formulario dos veces y solo aparece una respuesta."** Depende de la configuración:
un formulario puede aceptar una respuesta por persona o varias.

**"Le di acceso a alguien y no ve el formulario en el menú."** El acceso puntual habilita ese
formulario, no el módulo. Le aparece la entrada de Formularios con ese formulario adentro.

> Borrar un formulario se lleva sus respuestas. Si ya no se usa, desactivalo en vez de
> borrarlo: deja de recibir respuestas y el histórico queda.

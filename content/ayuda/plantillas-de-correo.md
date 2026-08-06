---
titulo: Plantillas de correo y el editor
seccion: Comunicaciones
roles: [comunicaciones, forms, encargado_staff, direccion]
orden: 1
resumen: Por qué algunas plantillas se editan en modo código, cómo no perder el diseño y qué hace "usar plantilla".
---

# Plantillas de correo y el editor

El editor de correos tiene **dos modos**, y entender cuál te toca evita el problema más caro
de este módulo: perder el diseño de una plantilla sin darse cuenta.

## Visual y código

**Visual** es el editor con barra de herramientas: negrita, títulos, listas, enlaces,
imágenes. Produce HTML simple y limpio.

**Código** es el HTML crudo en un cuadro de texto.

## Por qué a veces el visual está bloqueado

El editor visual solo sabe representar lo básico: párrafos, negrita, títulos, listas, enlaces
e imágenes. **Todo lo demás lo borra en cuanto escribís la primera letra**: tablas,
contenedores, estilos en línea, clases.

Y nuestras plantillas de diseño son exactamente eso — tablas con estilos en línea — porque es
lo único que se ve parejo en Gmail, Outlook y el correo del celular.

Por eso, cuando una plantilla tiene diseño avanzado, el editor **abre en modo código** y te
dice por qué. No es un capricho: es lo que evita que una plantilla quede aplanada.

Si aun así cambiás a Visual, aparece una confirmación explícita. **Confirmala solo si querés
perder el diseño** — no se puede deshacer una vez que escribís.

Mientras no hayas guardado, hay un enlace **"Descartar cambios y volver al original"** que te
devuelve el cuerpo tal como estaba.

## Cuándo se considera "avanzada"

Cuando el cuerpo trae tablas, `<div>` o `<span>`, estilos en línea, clases CSS, un documento
HTML completo, comentarios de Outlook o atributos de tabla. Ante la duda, el sistema la trata
como avanzada: es mucho peor destruir una plantilla que obligar a alguien a editar en código.

Las plantillas **del sistema** (las de matrícula, becas, cupones, encuesta de evento) van
siempre en código: llevan variables `{{...}}` que el envío automático reemplaza.

## Guardar

Al guardar sale un aviso de confirmación, y si algo falla te dice **qué** falló. Si no ves ni
una cosa ni la otra, el guardado no llegó a ejecutarse.

## "Usar plantilla" en una comunicación

Desde el listado de plantillas (botón *Usar*) o desde la pantalla de nueva comunicación
(botón *Usar plantilla*). Los dos hacen lo mismo: cargan el asunto y el cuerpo, y ajustan el
canal.

Si la plantilla tiene diseño avanzado, la campaña también se edita en modo código — por la
misma razón de arriba.

Cambiar de plantilla **reemplaza** el contenido, no lo acumula.

## Imágenes

Toda imagen que uses tiene que subirse desde el editor, no enlazarse de otro sitio. Las
imágenes de terceros se caen, cambian o bloquean el enlace, y el correo llega roto meses
después.

> El pie de baja no se escribe en la plantilla: lo agrega el envío cuando el correo sale como
> marketing. El tipo de correo tampoco se elige — sale de la categoría de la plantilla.

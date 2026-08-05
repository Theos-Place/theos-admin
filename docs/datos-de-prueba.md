# Datos de prueba

La hoja de referencia vive en el **centro de ayuda**, no acá:

- En el sistema: **/ayuda/datos-de-prueba** (visible para los roles de gestión).
- En el repo: `content/ayuda/datos-de-prueba.md`.

Ese archivo **lo genera `scripts/seed-datos-de-prueba.ts`** cada vez que corre, así que no
se edita a mano: cualquier cambio se pisa en la próxima corrida. Si hay que cambiar el
contenido, se cambia el seed.

Se mantiene UNA sola copia a propósito: antes estaban este archivo y el del centro de
ayuda con lo mismo, y se iban a desincronizar al primer cambio.

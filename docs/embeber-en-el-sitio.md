# Embeber páginas del admin en theosplace.org

Las páginas públicas que se muestran dentro del sitio llevan `?embed=1`: así
esconden su propio encabezado (el sitio ya tiene el suyo), usan fondo blanco y
le avisan al sitio cuánto miden.

## Puestos de servicio, sin scroll propio (2026-10-15)

Un iframe no puede cambiar su propio alto: lo decide la página que lo contiene.
La página de puestos manda su alto con `postMessage` cada vez que cambia
(cuando carga, cuando se filtra, cuando se abre el detalle de un puesto), y el
sitio tiene que escucharlo. Hay que pegar esto en el sitio, en lugar del iframe
que está hoy:

```html
<iframe
  src="https://admin.theosplace.org/puestos?embed=1"
  title="Puestos de servicio"
  style="width:100%; border:0; display:block; height:900px"
  scrolling="no"
></iframe>
<script>
  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://admin.theosplace.org') return
    var d = e.data || {}
    document.querySelectorAll('iframe[src^="https://admin.theosplace.org"]').forEach(function (f) {
      if (f.contentWindow !== e.source) return
      if (d.tipo === 'theos:altura' && typeof d.alto === 'number') f.style.height = d.alto + 'px'
      if (d.tipo === 'theos:ver' && typeof d.y === 'number') {
        window.scrollTo({ top: f.getBoundingClientRect().top + window.scrollY + d.y, behavior: 'smooth' })
      }
    })
  })
</script>
```

- El `height:900px` es solo el alto mientras carga; después lo reemplaza el que
  manda la página.
- El `script` se pega una sola vez por página del sitio, aunque haya varios
  iframes del admin: cada mensaje se aplica al iframe que lo mandó.
- Revisa el origen (`admin.theosplace.org`): un mensaje de cualquier otro lado
  se ignora.

Sin el `script`, el iframe se ve igual que antes: con su alto fijo y scroll
propio. No se rompe nada.

## Calendario en la página de actividades (2026-10-15)

El mismo script del sitio sirve para el calendario: es uno solo por página y
reconoce los dos iframes. Antes no funcionaba porque el calendario no mandaba
su alto; ahora sí, y además, cuando alguien abre el detalle de un evento, le
pide al sitio que baje hasta él (`theos:ver`). Sin eso, con el iframe del
tamaño del calendario, el detalle quedaba a media página, fuera de la vista.

El código completo, iframe y script, sale del generador en `/eventos/embed`.
El script de esta guía y el del generador son el mismo texto
(`SCRIPT_DEL_SITIO` en `src/lib/vista-embebida.ts`): si en el sitio ya está
pegado el de puestos, hay que reemplazarlo por este, que agrega `theos:ver`.

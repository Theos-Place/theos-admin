'use client'

/**
 * Web Analytics y Speed Insights de Vercel.
 *
 * ESTÁN INCLUIDOS EN EL PLAN y estaban habilitados en el panel desde junio y
 * julio de 2026, pero `hasData: false`: sin el script en la app no reportan
 * nada. Esto es lo que faltaba.
 *
 * ── LAS URLS SE REDACTAN ANTES DE SALIR, y es la razón de que este archivo
 * exista en vez de poner los componentes sueltos en el layout.
 *
 * Este sistema tiene rutas como `/miembros/<uuid>`, `/estudios/grupos/<uuid>`
 * y `/servidores/aplicaciones/<uuid>`. La ruta AGRUPADA que Vercel muestra en
 * su panel ya viene con `[id]`, pero el evento lleva además la `url` real —y
 * esa url es un identificador de una persona concreta viajando a un tercero—.
 * En un padrón con 24.000 fichas, varias de menores, eso no se manda.
 *
 * `beforeSend` recibe el evento antes del envío: acá se reemplaza cualquier
 * UUID o secuencia larga de dígitos de la ruta por `:id`, y se tira la query
 * string entera. Se pierde poder distinguir A de B —que es justo lo que no
 * queremos saber— y se conserva lo único que sirve: qué PANTALLAS se usan.
 *
 * VA EN UN COMPONENTE CLIENTE porque `beforeSend` es una función, y las props
 * que cruzan del servidor al cliente tienen que ser serializables (ver la guía
 * `use-client` de Next 16). Desde `layout.tsx`, que es Server Component, no se
 * puede pasar.
 */

import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

/** UUID v4 con guiones, o un id numérico largo. */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const NUMERICO = /\/\d{4,}(?=\/|$)/g

/** La ruta sin identificadores y sin query. Exportada para poder probarla. */
export function rutaSinIdentificadores(url: string): string {
  let ruta: string
  try {
    ruta = new URL(url, 'https://x').pathname
  } catch {
    ruta = url.split('?')[0]
  }
  return ruta.replace(UUID, ':id').replace(NUMERICO, '/:id')
}

export function Telemetria() {
  return (
    <>
      <Analytics
        beforeSend={event => ({ ...event, url: rutaSinIdentificadores(event.url) })}
      />
      <SpeedInsights />
    </>
  )
}

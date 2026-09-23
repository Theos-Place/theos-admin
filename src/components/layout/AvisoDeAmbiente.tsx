import { entornoDeSupabase, avisoDeAmbiente } from '@/lib/entorno/base-de-datos'

/**
 * INF-1 · La franja que dice que esto NO es producción.
 *
 * Los deploys Preview de Vercel apuntan al Supabase de staging y se ven
 * exactamente igual que producción. Con dos pestañas abiertas, «¿esto era el
 * padrón real o el de prueba?» no se contesta mirando la pantalla — y esa duda
 * es la que termina en un borrado en el lugar equivocado.
 *
 * Es un Server Component a propósito: lee `SUPABASE_STAGING_REF`, que NO es
 * `NEXT_PUBLIC_` y por lo tanto no existe en el navegador. Resolverlo en el
 * servidor evita tener que publicar esa variable solo para pintar un cartel.
 *
 * La decisión de qué decir vive en `lib/entorno/base-de-datos`, que es puro y
 * tiene los tests; acá solo está el marcado.
 */
export function AvisoDeAmbiente() {
  const entorno = entornoDeSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_STAGING_REF,
  )
  const aviso = avisoDeAmbiente(entorno)
  if (!aviso) return null

  const alerta = aviso.tono === 'alerta'
  return (
    // `sticky top-0` y no `fixed`: empuja el contenido en vez de taparlo. Un
    // cartel que se monta encima del encabezado se cierra de reflejo, y el que
    // se cierra de reflejo no avisa nada.
    <div
      role="status"
      className={[
        'sticky top-0 z-50 w-full px-4 py-1.5 text-center',
        'text-[13px] font-semibold tracking-wide font-body',
        // AGENTS.md/UI-1: sobre coral el texto va BLANCO; sobre el teal claro,
        // navy — nunca blanco, que daría 2.15:1.
        alerta ? 'bg-coral text-white' : 'bg-teal text-navy',
      ].join(' ')}
    >
      {aviso.texto}
    </div>
  )
}

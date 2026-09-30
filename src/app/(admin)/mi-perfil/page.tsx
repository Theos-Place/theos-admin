import { redirect } from 'next/navigation'
import { getAuthContext } from '@/lib/auth/guard'
import { loginUrlWithDest } from '@/lib/auth/redirect-target'
import { SIN_FICHA_ASOCIADA } from '@/lib/auth/estado-de-la-sesion'

/**
 * `/mi-perfil` · Un enlace estable al perfil propio.
 *
 * PARA QUÉ. El perfil de una persona vive en `/miembros/<uuid>`, así que no se
 * puede enlazar «tu perfil» desde ningún lado sin saber de antemano quién va a
 * hacer clic. Con esta ruta, un correo, un botón del sidebar o una ayuda
 * pueden decir `/mi-perfil?tab=participacion` y le sirve a cualquiera.
 *
 * SE RESUELVE EN EL SERVIDOR y no con `router.replace` como hace hoy el
 * dashboard: el cliente tiene que cargar, hidratar y recién ahí saltar, y en
 * el medio se ve un destello de la página equivocada. Acá la respuesta ya es
 * la redirección.
 *
 * SOBRE EL CÓDIGO HTTP: el pedido decía 302 y Next responde **307**. No es un
 * descuido: 307 preserva el método y el cuerpo, y para una navegación normal
 * el navegador se comporta igual. Forzar un 302 exigiría saltarse `redirect()`
 * y armar la respuesta a mano, y no compra nada.
 *
 * LOS QUERY PARAMS VIAJAN TAL CUAL. `?tab=participacion` es real —lo lee el
 * perfil y lo usa la notificación de cobro— y hay más de uno (`?open=` abre un
 * acordeón). Por eso se reenvía la cadena entera en vez de ir campo por campo:
 * con una lista blanca, el día que alguien agregue un parámetro nuevo este
 * redirect se lo come en silencio.
 */
export default async function MiPerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const ctx = await getAuthContext()
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(await searchParams)) {
    if (Array.isArray(v)) for (const x of v) qs.append(k, x)
    else if (v !== undefined) qs.append(k, v)
  }
  const cola = qs.toString() ? `?${qs}` : ''

  /**
   * Sin sesión el proxy ya mandó al login con `?redirect=/mi-perfil…`, así que
   * acá no deberíamos llegar. El caso se cubre igual porque «no deberíamos
   * llegar» no es una garantía: si alguien saca la ruta de la lista protegida,
   * sin esto la página reventaría con un `ctx` nulo en vez de mandar al login.
   */
  if (!ctx) redirect(loginUrlWithDest('/mi-perfil', cola))

  /**
   * SESIÓN SIN FICHA: el mensaje se muestra ACÁ, no se rebota a la raíz.
   *
   * El primer intento redirigía a `/?aviso=sin-ficha`, y eso estaba mal: nadie
   * lee ese parámetro, así que la persona habría aterrizado en la portada sin
   * ninguna explicación de por qué su perfil no abrió. Un redirect que promete
   * un mensaje que nadie muestra es peor que no redirigir.
   *
   * Es el MISMO texto que ya usan matrícula y mis-pagos (`SIN_FICHA_ASOCIADA`),
   * no uno nuevo: quien escriba a TI va a citar una frase que el equipo
   * reconoce.
   */
  if (!ctx.memberId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <p className="max-w-md text-center text-sm text-navy-light/80 font-body">
          {SIN_FICHA_ASOCIADA}
        </p>
      </div>
    )
  }

  redirect(`/miembros/${ctx.memberId}${cola}`)
}

/** Nunca hay nada que cachear: la respuesta depende de quién pregunta. */
export const dynamic = 'force-dynamic'

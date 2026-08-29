// Cómo navega el calendario cuando está EMBEBIDO en otro sitio (módulo puro).
//
// EL PROBLEMA. El calendario se embebe en theosplace.org/actividades dentro de
// un iframe de altura fija. Al tocar "Inscribirme", la navegación ocurría
// ADENTRO de esa cajita: primero el login, después el formulario y al final el
// perfil de la persona — todo apretado en el recuadro del calendario, en una
// página que habla de actividades. Nada de eso tiene sentido ahí.
//
// Embebido, cualquier salida del calendario abre una pestaña nueva: el
// calendario se queda como estaba y el trámite pasa en una ventana con espacio.
// Sin iframe, la navegación normal es la correcta.

/** ¿La página corre dentro de un iframe?
 *
 *  El try/catch no es por prolijidad: si el contenedor es de otro origen,
 *  leer window.top tira una excepción de seguridad — y que la tire ya
 *  significa que hay un contenedor ajeno, o sea que la respuesta es sí. */
export function estaEmbebido(win: { self: unknown; top: unknown } = globalThis.window): boolean {
  try {
    return win.self !== win.top
  } catch {
    return true
  }
}

export type Navegacion =
  | { modo: 'pestaña-nueva'; url: string }
  | { modo: 'misma-pestaña'; url: string }

/** A dónde y cómo mandar a alguien que toca un link del calendario. */
export function comoNavegar(destino: string, embebido: boolean): Navegacion {
  return embebido
    ? { modo: 'pestaña-nueva', url: destino }
    : { modo: 'misma-pestaña', url: destino }
}

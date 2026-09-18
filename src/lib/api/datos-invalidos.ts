import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * El 400 de un body que no valida, en la forma que fija AGENTS.md:
 * `{ error: 'Datos inválidos', detalles: z.treeifyError(...) }`.
 *
 * Existe porque esa línea está copiada en decenas de handlers y en algunos
 * salía distinta —un objeto armado a mano, un mensaje suelto—, así que el
 * cliente no podía confiar en la forma de `detalles`.
 */
export function datosInvalidos(error: z.ZodError): NextResponse {
  return NextResponse.json(
    { error: 'Datos inválidos', detalles: z.treeifyError(error) },
    { status: 400 },
  )
}

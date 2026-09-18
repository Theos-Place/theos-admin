import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { padronParaEmparejar, huellasDeDonacionesExistentes } from '@/lib/supabase/queries/finance'
import { emparejarDonante, seImportaSolo } from '@/lib/finance/emparejar-donante'
import { fechaDeReporte, montoDeReporte } from '@/lib/finance/columnas-de-donaciones'
import { todayCR } from '@/lib/format'
import { datosInvalidos } from '@/lib/api/datos-invalidos'
import { reportarError } from '@/lib/observabilidad'

/**
 * DON-1 · Vista previa de una importación de donaciones. NO ESCRIBE NADA.
 *
 * Existe como paso obligatorio y no como comodidad: el cruce es por nombre y
 * una fila mal emparejada le acredita la donación a otra persona. Acá se ve
 * fila por fila a quién iría, con qué confianza, y cuáles ya existen.
 *
 * El emparejamiento corre en el SERVIDOR y no en el navegador porque necesita
 * el padrón entero (24 mil fichas): mandarlo al cliente sería mandar el padrón
 * completo a quien abra la pantalla.
 */
const filaSchema = z.object({
  cedula: z.string().nullish(),
  nombre: z.string().nullish(),
  fecha: z.unknown().nullish(),
  monto: z.unknown().nullish(),
  moneda: z.string().nullish(),
  nota: z.string().nullish(),
})

const bodySchema = z.object({
  filas: z.array(filaSchema).min(1, 'El archivo no tiene filas.').max(5000, 'Máximo 5.000 filas por archivo.'),
})

export async function POST(req: NextRequest) {
  const auth = await requireRoles('finanzas', 'direccion')
  if (auth.res) return auth.res
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return datosInvalidos(parsed.error)

    const padron = await padronParaEmparejar()
    const hoy = todayCR()
    const previas = parsed.data.filas.map((f, i) => {
      const fecha = fechaDeReporte(f.fecha)
      const monto = montoDeReporte(f.monto)
      const m = emparejarDonante({ cedula: f.cedula, nombre: f.nombre }, padron)
      return {
        indice: i,
        nombre_archivo: String(f.nombre ?? '').trim(),
        cedula_archivo: String(f.cedula ?? '').trim() || null,
        fecha, monto,
        moneda: (f.moneda ?? 'CRC').trim().toUpperCase() || 'CRC',
        nota: String(f.nota ?? '').trim() || null,
        /**
         * Sin fecha —o con una futura— no se puede guardar. Se marca ACÁ y no
         * al importar: el endpoint de importación rechaza el lote entero por
         * una fila mala, así que descubrirlo al final sería llegar hasta el
         * botón para que no pase nada. Una fecha futura en un reporte de banco
         * es siempre un error de lectura del archivo.
         */
        fecha_invalida: !fecha || fecha > hoy,
        motivo_fecha: !fecha ? 'no se entiende' : fecha > hoy ? 'está en el futuro' : null,
        emparejamiento: m,
        member_id: seImportaSolo(m) ? (m as { persona: { id: string } }).persona.id : null,
      }
    })

    // Duplicados: solo tiene sentido preguntarlo por las que ya tienen persona.
    const huellas = await huellasDeDonacionesExistentes(
      previas.map(p => p.member_id).filter((x): x is string => !!x))
    const conDup = previas.map(p => ({
      ...p,
      duplicada: !!p.member_id && !!p.fecha
        && huellas.has(`${p.member_id}|${p.fecha}|${p.monto ?? ''}`),
    }))

    return NextResponse.json({
      filas: conDup,
      resumen: {
        total: conDup.length,
        listas: conDup.filter(p => p.member_id && p.fecha && !p.duplicada).length,
        ambiguas: conDup.filter(p => p.emparejamiento.estado === 'ambiguo').length,
        sin_persona: conDup.filter(p => p.emparejamiento.estado === 'sin_candidato').length,
        duplicadas: conDup.filter(p => p.duplicada).length,
        sin_fecha: conDup.filter(p => p.fecha_invalida).length,
      },
    })
  } catch (error) {
    reportarError('POST /api/finance/donations/preview:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

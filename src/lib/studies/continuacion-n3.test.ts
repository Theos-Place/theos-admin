import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  deltaDeFolletos, notaDeCierreDeMatricula, notaDeMatriculaAbierta, nuevosDesde, textoParaElDirigente,
  tieneMatriculaAbierta, tocaCerrarMatricula, yaSeCerroLaMatricula, MARCA_CIERRE_DE_MATRICULA,
} from './continuacion-n3'

describe('EST-31 · nota de matrícula abierta en el tiquete', () => {
  it('dice hasta cuándo, que puede entrar más gente y la cantidad inicial', () => {
    const n = notaDeMatriculaAbierta({ finDeMatricula: '2026-11-12', aprobados: 9, nivelOrigen: 'Nivel 2' })
    expect(n).toContain('EN MATRÍCULA hasta el 12/11/2026')
    expect(n).toContain('habrá una actualización al cierre')
    expect(n).toContain('Cantidad inicial = 9 aprobados de Nivel 2')
  })
  it('solo lleva nota el sucesor que nació en matrícula con ventana', () => {
    expect(tieneMatriculaAbierta({ status: 'en_matricula', enrollment_end_date: '2026-11-12' })).toBe(true)
    expect(tieneMatriculaAbierta({ status: 'en_curso', enrollment_end_date: '2026-11-12' })).toBe(false)
    expect(tieneMatriculaAbierta({ status: 'en_matricula', enrollment_end_date: null })).toBe(false)
  })
})

describe('EST-31 · cuándo cierra la matrícula', () => {
  const g = { status: 'en_matricula', enrollment_end_date: '2026-11-12' }
  it('el día después del fin de la ventana, aunque el grupo no haya arrancado', () => {
    expect(tocaCerrarMatricula(g, '2026-11-12')).toBe(false)
    expect(tocaCerrarMatricula(g, '2026-11-13')).toBe(true)
  })
  it('un grupo sin ventana o ya en curso no entra', () => {
    expect(tocaCerrarMatricula({ status: 'en_matricula', enrollment_end_date: null }, '2026-11-13')).toBe(false)
    expect(tocaCerrarMatricula({ status: 'en_curso', enrollment_end_date: '2026-11-12' }, '2026-11-13')).toBe(false)
  })
  it('la marca en la nota evita cerrar dos veces', () => {
    expect(yaSeCerroLaMatricula(`algo\n\n${MARCA_CIERRE_DE_MATRICULA} (13/11/2026): …`)).toBe(true)
    expect(yaSeCerroLaMatricula('⚠️ Este grupo queda EN MATRÍCULA…')).toBe(false)
  })
})

describe('EST-31 · el delta de folletos', () => {
  it('entraron más: +N adicionales, lo impreso no se repite', () => {
    const d = deltaDeFolletos(9, 12)
    expect(d).toMatchObject({ adicionales: 3, cambio: true })
    expect(d.texto).toBe('CONTINUACIÓN: este grupo necesita +3 folletos adicionales (ya se mandaron a imprimir 9; total final 12).')
  })
  it('uno solo, en singular', () => {
    expect(deltaDeFolletos(9, 10).texto).toContain('+1 folleto adicional (')
  })
  it('nadie más: sin cambios, cantidad confirmada', () => {
    expect(deltaDeFolletos(9, 9)).toEqual({ adicionales: 0, cambio: false, texto: 'Sin cambios: cantidad final confirmada (9).' })
  })
  it('salió gente: no hay delta negativo', () => {
    const d = deltaDeFolletos(9, 7)
    expect(d.adicionales).toBe(0)
    expect(d.texto).toContain('bajó de 9 a 7')
  })
  it('la nota de cierre lleva la marca, el conteo y el delta', () => {
    const n = notaDeCierreDeMatricula({ hoy: '2026-11-13', inicial: 9, final: 12, conteo: { confirmados: 10, pendientes: 2 } })
    expect(n.startsWith(`${MARCA_CIERRE_DE_MATRICULA} (13/11/2026): 10 matriculados confirmados · 2 con pago pendiente.`)).toBe(true)
    expect(n).toContain('+3 folletos adicionales')
  })
})

describe('EST-31 · el aviso al dirigente', () => {
  const t0 = '2026-10-29T20:00:00.000Z'
  const filas = [
    { member_id: 'a', status: 'enrolled', created_at: '2026-10-29T19:59:00.000Z', nombre: 'Ana (del cierre)' },
    { member_id: 'b', status: 'enrolled', created_at: '2026-11-02T10:00:00.000Z', nombre: 'Bruno Nuevo' },
    { member_id: 'c', status: 'pendiente_de_pago', created_at: '2026-11-05T10:00:00.000Z', nombre: 'Cintia Nueva' },
    { member_id: 'd', status: 'withdrawn', created_at: '2026-11-06T10:00:00.000Z', nombre: 'Se fue' },
  ]
  it('solo los que entraron después del tiquete y siguen matriculados', () => {
    expect(nuevosDesde(filas, t0).map(f => f.nombre)).toEqual(['Bruno Nuevo', 'Cintia Nueva'])
  })
  it('con nombres: pide sumarlos al chat; sin nadie: null (cero ruido)', () => {
    expect(textoParaElDirigente(['Bruno Nuevo', 'Cintia Nueva']))
      .toBe('Se matricularon 2 personas más: Bruno Nuevo, Cintia Nueva. Por favor asegurate de agregarlas al chat de WhatsApp del grupo.')
    expect(textoParaElDirigente(['Bruno Nuevo'])).toContain('Se matriculó 1 persona más')
    expect(textoParaElDirigente([])).toBeNull()
  })
})

describe('EST-31 · cableado', () => {
  it('el cron de ventanas barre los cierres de matrícula de continuación antes de cerrar ventanas', () => {
    const cron = readFileSync('src/app/api/cron/group-enrollment-windows/route.ts', 'utf8')
    expect(cron).toContain('barrerCierresDeMatriculaDeContinuacion')
  })
  it('el tiquete de cierre nace con la nota cuando el sucesor está en matrícula', () => {
    const q = readFileSync('src/lib/supabase/queries/folletos.ts', 'utf8')
    expect(q).toContain('notaDeMatriculaAbierta(')
    expect(q).toContain('export async function cerrarMatriculaDeContinuacion')
  })
})

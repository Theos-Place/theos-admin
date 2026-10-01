import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { puedePedirFolletosAnticipados, folletosQueVaAPedir } from './folletos-anticipados'
import { shouldCreateAutoFolleto } from './folleto-auto-rules'

/**
 * EST-21 · Pedir los folletos antes de que el grupo arranque.
 *
 * POR QUÉ EXISTE: la imprenta tarda y los folletos del par tienen que estar
 * el primer día, así que se piden ~15 días antes, con el grupo todavía en
 * matrícula. Ningún disparador automático sirve para eso: `cupo_lleno` y
 * `fin_matricula` quedaron muertos el 2026-09-02 —78 de 93 grupos no tenían
 * ni cupo ni ventana— y el de `cierre` depende de que el grupo ANTERIOR se
 * cierre, que es justo lo que no pasa con el primero de una cadena.
 */
const enMatricula = (planCode: string) => ({ planCode, status: 'en_matricula' })

describe('quién puede pedirlos', () => {
  it('N1 y N3 en matrícula, que son los que abren un bloque', () => {
    expect(puedePedirFolletosAnticipados(enMatricula('N1')).puede).toBe(true)
    expect(puedePedirFolletosAnticipados(enMatricula('N3')).puede).toBe(true)
  })

  it('N2 y N4 no: su gente ya los tiene desde que entró al bloque', () => {
    const v = puedePedirFolletosAnticipados(enMatricula('N2'))
    expect(v.puede).toBe(false)
    expect(v.puede === false && v.code).toBe('ya_los_tiene_del_bloque')
  })

  it('y el motivo lo decide `folletosQuePide`, no una lista nueva', () => {
    /**
     * La regla del par ya vive en tres lugares que la COMPARTEN: el cobro, la
     * orden y el conteo de impresión. Una cuarta copia escrita acá se
     * separaría de las otras tres el día que cambien los bloques.
     */
    const src = readFileSync('src/lib/studies/folletos-anticipados.ts', 'utf8')
    expect(src).toContain("import { folletosQuePide } from './corte-de-bloque'")
    expect(src).toContain('folletosQuePide(g.planCode).length === 0')
  })

  it('un grupo que ya arrancó, no: llegó tarde', () => {
    const v = puedePedirFolletosAnticipados({ planCode: 'N1', status: 'en_curso' })
    expect(v.puede).toBe(false)
    expect(v.puede === false && v.motivo).toContain('ya arrancó')
  })

  it('tampoco uno finalizado ni uno sin plan', () => {
    expect(puedePedirFolletosAnticipados({ planCode: 'N1', status: 'finalizado' }).puede).toBe(false)
    expect(puedePedirFolletosAnticipados({ planCode: null, status: 'en_matricula' }).puede).toBe(false)
  })

  it('una capacitación tampoco: esto es de la cadena de niveles', () => {
    const v = puedePedirFolletosAnticipados(enMatricula('DIS1'))
    expect(v.puede).toBe(false)
    expect(v.puede === false && v.code).toBe('nivel_no_aplica')
  })
})

describe('qué trae la orden', () => {
  it('el par completo, para mostrarlo antes de confirmar', () => {
    expect(folletosQueVaAPedir('N1')).toEqual(['N1', 'N2'])
    expect(folletosQueVaAPedir('N3')).toEqual(['N3', 'N4'])
  })
})

describe('el tipo nuevo', () => {
  it('no lleva umbral de 5, pero sí exige gente', () => {
    // El mínimo existe para no imprimirle a un grupo que quizá no arranca —
    // un juicio que acá ya lo hizo la persona que apretó el botón.
    expect(shouldCreateAutoFolleto('anticipado', { enrolled: 2, max_students: 20 })).toBe(true)
    expect(shouldCreateAutoFolleto('anticipado', { enrolled: 0, max_students: 20 })).toBe(false)
  })

  it('no cambia los umbrales de los otros', () => {
    expect(shouldCreateAutoFolleto('fin_matricula', { enrolled: 4, max_students: 20 })).toBe(false)
    expect(shouldCreateAutoFolleto('fin_matricula', { enrolled: 5, max_students: 20 })).toBe(true)
    expect(shouldCreateAutoFolleto('cupo_lleno', { enrolled: 19, max_students: 20 })).toBe(false)
  })
})

describe('la idempotencia la da la BASE, no el código', () => {
  const mig = readFileSync('supabase/migrations/20261001150000_est21_folletos_anticipados.sql', 'utf8')

  it('el índice único incluye `anticipado`', () => {
    /**
     * Sin esto el doble clic crea dos órdenes, y el disparador de `cierre`
     * crearía una tercera encima de la pedida a mano. Era el punto 3 del
     * ítem: «que el automático no duplique al manual».
     */
    expect(mig).toMatch(/create unique index folleto_requests_auto_por_grupo[\s\S]*?\(source_group_id\)[\s\S]*?'anticipado'/)
  })

  it('el CHECK se amplía LEYENDO el que hay, no reescribiendo la lista', () => {
    // Una lista escrita a mano en la migración se desactualiza en silencio
    // contra la de producción: así se rompió el CHECK de `member_roles`.
    expect(mig).toContain('pg_get_constraintdef(oid) into v_def')
    expect(mig).toContain("replace(v_def, 'ARRAY[', 'ARRAY[''anticipado''::text, ')")
  })

  it('y se puede correr dos veces sin romper', () => {
    expect(mig).toContain("if position('''anticipado''' in v_def) > 0 then")
  })
})

describe('el endpoint', () => {
  const src = readFileSync('src/app/api/studies/groups/[id]/folletos/route.ts', 'utf8')

  it('exige rol de gestión y NO alcanza con ser dirigente', () => {
    expect(src).toContain("requireRoles('coordinador_estudios', 'folletos', 'direccion', 'admin')")
    expect(src).not.toContain('viewer_scope')
  })

  it('reusa el generador en vez de copiarlo', () => {
    // Ahí viven la sede, el conteo de dirigentes, el par y el correo.
    expect(src).toContain("createAutoFolletoIfNeeded(id, 'anticipado', hoy)")
    expect(src).not.toContain("from('folleto_requests').insert")
  })

  it('deja rastro de quién lo pidió', () => {
    // Sin esto, una orden pedida a mano es indistinguible de una automática.
    expect(src).toContain('logAudit(')
    expect(src).toContain("entityType: 'folleto_requests'")
  })

  it('valida la regla antes de crear nada', () => {
    // Se mide dentro del CUERPO: contando desde el inicio del archivo gana
    // el `import`, que está arriba de todo y no dice nada del orden real.
    const cuerpo = src.slice(src.indexOf('export async function POST'))
    expect(cuerpo.indexOf('puedePedirFolletosAnticipados'))
      .toBeLessThan(cuerpo.indexOf('createAutoFolletoIfNeeded(id'))
  })
})

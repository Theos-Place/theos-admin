import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  inicioDeLaVentana, mesDeLaVentana, subtituloDeDonantes, explicacionDeDonantes,
  criterioDeDonantes, MESES_DE_VENTANA,
} from './ventana-de-donante'

// La ventana ya cambió tres veces: 6 meses, 3 (PAR-1) y 4 (FIN-10, 2026-09-25:
// mes actual + los 3 anteriores). Las fechas de abajo son del cálculo vigente y
// se recalculan a mano cuando cambia — que es justo la fricción que uno quiere:
// obliga a mirar los bordes en vez de que el test se acomode solo.
const RETROCESO = MESES_DE_VENTANA - 1

describe('ventana de donante activo', () => {
  it('cuenta el mes actual como uno de los cuatro', () => {
    // 16-set-2026 con ventana de 4: set, ago, jul, jun → arranca el 1 de junio.
    expect(MESES_DE_VENTANA).toBe(4)
    expect(inicioDeLaVentana(new Date('2026-09-16T23:27:00Z'))).toBe('2026-06-01')
    expect(mesDeLaVentana(new Date('2026-09-16T23:27:00Z'))).toBe('junio de 2026')
  })

  it('el borde que pide FIN-10: el 1 de junio cuenta y el 31 de mayo no', () => {
    // El ejemplo textual del pedido, visto el 25 de setiembre.
    const hoy = new Date('2026-09-25T12:00:00Z')
    expect(inicioDeLaVentana(hoy)).toBe('2026-06-01')
    expect('2026-06-01' >= inicioDeLaVentana(hoy)).toBe(true)
    expect('2026-05-31' >= inicioDeLaVentana(hoy)).toBe(false)
  })

  it('cruza bien el cambio de año', () => {
    expect(inicioDeLaVentana(new Date('2027-02-10T12:00:00Z'))).toBe('2026-11-01')
    expect(mesDeLaVentana(new Date('2027-01-05T12:00:00Z'))).toBe('octubre de 2026')
  })

  it('el primer día del mes ya cuenta el mes nuevo', () => {
    expect(inicioDeLaVentana(new Date('2026-10-01T00:00:00Z'))).toBe('2026-07-01')
  })

  it('el último instante del mes todavía es el mes viejo', () => {
    expect(inicioDeLaVentana(new Date('2026-09-30T23:59:59Z'))).toBe('2026-06-01')
  })

  it('SE CALCULA EN UTC, igual que la base', () => {
    // 30-set 20:00 en Costa Rica son las 02:00 del 1-oct en UTC. La base ya
    // movió su ventana; si acá usáramos la fecha de Costa Rica el texto
    // contradiría al número durante seis horas cada mes.
    expect(inicioDeLaVentana(new Date('2026-10-01T02:00:00Z'))).toBe('2026-07-01')
  })

  it('el subtítulo entra en la tarjeta, como los otros', () => {
    const s = subtituloDeDonantes(new Date('2026-09-16T12:00:00Z'))
    expect(s).toBe('Donaron desde junio de 2026')
    expect(s.length).toBeLessThan(40)
  })

  it('la explicación larga dice la regla completa', () => {
    expect(explicacionDeDonantes(new Date('2026-09-16T12:00:00Z')))
      .toBe('Donaron al menos una vez desde junio de 2026: los últimos 4 meses, contando el actual.')
  })

  it('el criterio corto también sale de la constante', () => {
    // Existía escrito a mano en la pantalla de finanzas; ahí estaba el cuarto
    // lugar donde había que acordarse de cambiar el número.
    expect(criterioDeDonantes()).toBe('Donaron en los últimos 4 meses, contando el actual')
  })

  it('setiembre se escribe como en Costa Rica', () => {
    // 'septiembre' con p es lo que devuelve toLocaleDateString; acá va sin ella.
    // Diciembre menos tres meses da setiembre. Con la ventana de 3 esto era
    // noviembre; al cambiarla hubo que mover la fecha, no el aserto.
    expect(mesDeLaVentana(new Date('2026-12-10T12:00:00Z'))).toContain('setiembre')
  })
})

/**
 * PAR-1 · El SQL y el TypeScript no se pueden separar sin que esto falle.
 *
 * Quien marca `is_donor` es `refresh_donor_flags()` en Postgres; el texto de las
 * pantallas sale de este módulo. Un `.sql` no puede importar TypeScript, así que
 * el número está en los dos lados por necesidad. Lo que NO tiene por qué pasar
 * es que se desincronicen en silencio: hasta hoy vivía en cuatro lugares y
 * cambiarlo era acordarse de los cuatro.
 *
 * Se lee la migración MÁS NUEVA que toque estas funciones, no una fija: la
 * próxima vez que la regla cambie habrá otra migración y este test tiene que
 * mirar esa.
 */
describe('la ventana del SQL coincide con la del código', () => {
  const DIR = 'supabase/migrations'

  const ultimaQueDefine = (fn: string): string | null => {
    const archivos = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort().reverse()
    for (const f of archivos) {
      const sql = readFileSync(join(DIR, f), 'utf8')
      if (new RegExp(`(create or replace function|CREATE OR REPLACE FUNCTION)\\s+public\\.${fn}\\b`).test(sql)) return sql
    }
    return null
  }

  for (const fn of ['refresh_donor_flags', 'set_donor_on_donation']) {
    it(`${fn} usa INTERVAL '${MESES_DE_VENTANA - 1} months'`, () => {
      const sql = ultimaQueDefine(fn)
      expect(sql, `ninguna migración define public.${fn}`).not.toBeNull()
      const intervalos = [...sql!.matchAll(/INTERVAL\s+'(\d+)\s+months?'/gi)].map(m => Number(m[1]))
      expect(intervalos.length, 'la función debería usar un INTERVAL de meses').toBeGreaterThan(0)
      for (const meses of intervalos) {
        expect(meses, `el SQL retrocede ${meses} meses y el código ${RETROCESO}`).toBe(RETROCESO)
      }
    })
  }
})

/**
 * FIN-10 · La donación cuenta también para el cónyuge.
 *
 * La regla vive en SQL —es `refresh_donor_flags()` quien mantiene la bandera—,
 * así que acá no se puede ejecutar. Lo que sí se puede es fijar las decisiones
 * que la hacen correcta, que son las que alguien rompería sin darse cuenta:
 * QUIÉNES cuentan como pareja, quiénes no, y que no se toque la plata.
 */
describe('FIN-10 · el estado se extiende al cónyuge, la plata no', () => {
  const sql = (() => {
    const dir = 'supabase/migrations'
    const f = readdirSync(dir).filter(x => x.includes('fin10')).sort().at(-1)
    expect(f, 'no existe la migración de FIN-10').toBeTruthy()
    return readFileSync(join(dir, f!), 'utf8')
  })()

  /** Las dos funciones que arma la migración, por separado: un conteo sobre el
   *  archivo entero no distingue si a UNA le falta la condición. Se descubrió
   *  con un cebo — quité un `b.relation` y el test pasó igual. */
  const funciones = {
    refresh_donor_flags: sql.slice(sql.indexOf('function public.refresh_donor_flags'), sql.indexOf('function public.set_donor_on_donation')),
    set_donor_on_donation: sql.slice(sql.indexOf('function public.set_donor_on_donation')),
  }

  it('la pareja es Titular ↔ Cónyuge, y se exige en AMBOS lados del join', () => {
    // Con la condición en un solo lado, un «Hijo/a» de la misma unidad entraría
    // en cuanto el Titular donara.
    for (const [nombre, cuerpo] of Object.entries(funciones)) {
      const n = [...cuerpo.matchAll(/relation in \('Titular', 'Cónyuge'\)/gi)].length
      expect(n, `${nombre} debería exigirlo en los dos lados`).toBe(2)
    }
  })

  it('hijos, «Otro» y «Madre» NO heredan el estado', () => {
    for (const r of ['Hijo/a', 'Otro', 'Madre']) {
      expect(sql, `«${r}» no debería aparecer como relación que hereda`).not.toContain(`'${r}'`)
    }
  })

  it('la pareja tiene que ser OTRA persona', () => {
    // Sin esto, cada quien sería su propio cónyuge y el join se duplicaría.
    expect(sql).toContain('b.member_id <> a.member_id')
  })

  it('NO se insertan donaciones espejo: los montos quedan intactos', () => {
    // La forma de duplicar plata sin querer sería crear una donación para el
    // cónyuge. Lo único que esta migración escribe es `members.is_donor`.
    expect(sql).not.toMatch(/insert\s+into\s+donations/i)
    expect(sql).toContain('set is_donor')
  })

  it('el trigger también marca a la pareja, pero solo pone TRUE', () => {
    // Quitar la bandera cuando la ventana se corre es trabajo del recálculo; si
    // el trigger pusiera FALSE, una donación vieja apagaría a alguien vigente.
    const trigger = sql.slice(sql.indexOf('set_donor_on_donation'))
    expect(trigger).toContain('is_donor = TRUE')
    expect(trigger).not.toMatch(/is_donor\s*=\s*FALSE/i)
  })

  it('recalcula al aplicarse, para no dejar la bandera vieja', () => {
    expect(sql).toContain('select public.refresh_donor_flags();')
  })
})

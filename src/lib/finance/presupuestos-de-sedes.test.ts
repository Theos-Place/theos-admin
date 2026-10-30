import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  tiposVisibles, puestosDesdeTexto, codigoDeTipo, arrastreDelMesAnterior, mesesDelSelector,
  montoDeCelda, filasDelExcel, emparejarSedes, type TipoDePresupuesto,
} from './presupuestos-de-sedes'

const tipo = (code: string, puestos: string[] = [], activo = true, orden = 1): TipoDePresupuesto =>
  ({ code, nombre: code, puestos, activo, orden })

describe('FIN-16 · tipos múltiples por sede y quién ve cuál', () => {
  const catalogo = [tipo('comida', ['coordinador comida'], true, 1), tipo('bienvenida', [], true, 2), tipo('viejo', [], false, 3)]
  it('finanzas ve todos, también los inactivos', () => {
    expect(tiposVisibles(catalogo, null).map(t => t.code)).toEqual(['comida', 'bienvenida', 'viejo'])
  })
  it('el colaborador ve los de su puesto y los abiertos a todo el equipo, nunca los inactivos', () => {
    expect(tiposVisibles(catalogo, ['Coordinador de Comida']).map(t => t.code)).toEqual(['comida', 'bienvenida'])
    expect(tiposVisibles(catalogo, ['Encargado Logística']).map(t => t.code)).toEqual(['bienvenida'])
  })
  it('los puestos se escriben como se quiera y se comparan normalizados', () => {
    expect(puestosDesdeTexto('Coordinador de Comida, Encargado Logística,  ')).toEqual(['coordinador comida', 'encargado logistica'])
  })
  it('el código sale del nombre', () => {
    expect(codigoDeTipo('Ideas especiales')).toBe('ideas_especiales')
    expect(codigoDeTipo('Bienvenida ñ')).toBe('bienvenida_n')
  })
})

describe('FIN-16 · saldo arrastrado del mes anterior', () => {
  it('lo que sobró de un mes cerrado pasa al siguiente', () => {
    expect(arrastreDelMesAnterior({ estado: 'cerrado', saldo_final: 3500 })).toEqual({ monto: 3500, confirmado: true })
  })
  it('un sobregiro no se arrastra: va por reintegro', () => {
    expect(arrastreDelMesAnterior({ estado: 'cerrado', saldo_final: -2000 }).monto).toBe(0)
  })
  it('con el mes anterior abierto no hay arrastre todavía, y se dice', () => {
    expect(arrastreDelMesAnterior({ estado: 'abierto', saldo_final: null })).toEqual({ monto: 0, confirmado: false })
  })
  it('sin mes anterior, cero y confirmado', () => {
    expect(arrastreDelMesAnterior(null)).toEqual({ monto: 0, confirmado: true })
  })
})

describe('FIN-16 · selector de mes', () => {
  it('del mes siguiente hacia atrás, cruzando años', () => {
    const m = mesesDelSelector('2027-01', '2026-11')
    expect(m).toEqual(['2027-02', '2027-01', '2026-12', '2026-11'])
  })
})

describe('FIN-16 · importar depósitos desde el Excel (dry-run)', () => {
  it('lee montos con símbolo y separadores ticos o gringos', () => {
    expect(montoDeCelda('₡ 125.000')).toBe(125000)
    expect(montoDeCelda('125.000,50')).toBe(125000.5)
    expect(montoDeCelda('125,000.50')).toBe(125000.5)
    expect(montoDeCelda(90000)).toBe(90000)
    expect(montoDeCelda('n/a')).toBeNull()
  })
  it('encuentra el encabezado y salta totales y filas vacías', () => {
    const filas = filasDelExcel([
      ['Control de adelantos octubre'],
      ['Sede', 'Responsable', 'Monto depositado'],
      ['Sede Antares', 'Ana', '₡60.000'],
      ['', '', ''],
      ['Guápiles', 'Luis', 45000],
      ['TOTAL', '', 105000],
    ])
    expect(filas).toEqual([
      { nombre: 'Sede Antares', monto: 60000, fila: 3 },
      { nombre: 'Guápiles', monto: 45000, fila: 5 },
    ])
  })
  it('sin encabezado usa las dos primeras columnas', () => {
    expect(filasDelExcel([['Antares', 1000]])).toEqual([{ nombre: 'Antares', monto: 1000, fila: 1 }])
  })
  const sedes = [
    { code: 'antares', name: 'Sede Antares' }, { code: 'guapiles', name: 'Sede Guápiles' },
    { code: 'united', name: 'Sede Pedregal Domingos' }, { code: 'home', name: 'Sede Pedregal Jueves' },
  ]
  it('empareja por nombre exacto (sin tildes ni «Sede») o por código; nunca por parecido', () => {
    const e = emparejarSedes([
      { nombre: 'guapiles', monto: 1, fila: 1 },
      { nombre: 'Sede Antares', monto: 2, fila: 2 },
      { nombre: 'Pedregal', monto: 3, fila: 3 },
      { nombre: 'united', monto: 4, fila: 4 },
    ], sedes)
    expect(e.coincidencias.map(c => c.sede_code)).toEqual(['antares', 'guapiles', 'united'])
    expect(e.sinSede.map(f => f.nombre)).toEqual(['Pedregal'])
  })
  it('la misma sede dos veces no se elige: se reporta', () => {
    const e = emparejarSedes([{ nombre: 'Antares', monto: 1, fila: 1 }, { nombre: 'Sede Antares', monto: 2, fila: 2 }], sedes)
    expect(e.coincidencias).toEqual([])
    expect(e.repetidas).toEqual(['Sede Antares'])
  })
})

describe('FIN-16 · cableado', () => {
  const ruta = readFileSync('src/app/api/adelantos/route.ts', 'utf8')
  const queries = readFileSync('src/lib/supabase/queries/adelantos.ts', 'utf8')
  const importar = readFileSync('src/app/api/adelantos/deposit-imports/route.ts', 'utf8')
  const exportar = readFileSync('src/lib/finance/export-de-adelantos.ts', 'utf8')

  it('el acceso es por sede Y por tipo', () => {
    expect(ruta).toMatch(/alcance\.sedes\.includes\(sede\) && \(alcance\.tipos \?\? \[\]\)\.includes\(tipo\)/)
    for (const f of ['src/app/api/adelantos/[id]/route.ts', 'src/app/api/adelantos/[id]/receipts/route.ts']) {
      expect(readFileSync(f, 'utf8'), f).toContain('dentroDelAlcance(')
    }
  })
  it('importar es dry-run salvo que se pida aplicar, y solo finanzas', () => {
    expect(importar).toContain("String(form.get('aplicar') ?? '') === '1'")
    expect(importar).toMatch(/if \(!aplicar\) \{\s*return NextResponse\.json/)
    expect(importar).toContain("requireModuleView('finanzas', { action: 'edit' })")
  })
  it('al cerrar un mes, el siguiente abierto recibe el sobrante', () => {
    expect(queries).toMatch(/mesSiguiente\(a\.mes\)[\s\S]*saldo_anterior: arrastre/)
  })
  it('el Excel incluye el tipo, el saldo anterior y el depósito', () => {
    expect(exportar).toContain("'Tipo'")
    expect(exportar).toContain("'Saldo mes anterior', 'Depósito del mes'")
  })
})

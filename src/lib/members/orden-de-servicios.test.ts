import { describe, it, expect } from 'vitest'
import { ordenarServicios } from './orden-de-servicios'

const s = (position: string, status: string, from: string | null, committee = 'Comité Ayuda Social') =>
  ({ position, committee, from, status })

const puestos = (xs: Array<ReturnType<typeof s>>) => ordenarServicios(xs).map(x => x.position)

describe('ordenarServicios', () => {
  it('el caso que lo motivó: el activo va arriba del cerrado', () => {
    // María José Murillo: la fila cerrada salía primera y su ficha se leía
    // como inactiva teniendo el servicio al día.
    expect(puestos([
      s('Colaborador Abuelitos GAM', 'inactive', '2026-05-08'),
      s('Colaborador Abuelitos', 'active', '2026-09-11'),
    ])).toEqual(['Colaborador Abuelitos', 'Colaborador Abuelitos GAM'])
  })

  it('activos primero, aunque el inactivo sea más reciente', () => {
    expect(puestos([
      s('Cerrado ayer', 'inactive', '2026-09-14'),
      s('Activo viejo', 'active', '2019-01-01'),
    ])).toEqual(['Activo viejo', 'Cerrado ayer'])
  })

  it('dentro de cada grupo, lo más reciente arriba', () => {
    expect(puestos([
      s('A', 'active', '2024-01-01'),
      s('B', 'active', '2026-06-01'),
      s('C', 'inactive', '2020-01-01'),
      s('D', 'inactive', '2023-01-01'),
    ])).toEqual(['B', 'A', 'D', 'C'])
  })

  it('sin fecha cae al final de SU grupo, no al final de todo', () => {
    // Medio histórico de CCB vino sin start_date. Hundirlo entero escondería
    // servicios vigentes debajo de servicios cerrados.
    expect(puestos([
      s('Inactivo con fecha', 'inactive', '2025-01-01'),
      s('Activo sin fecha', 'active', null),
      s('Activo con fecha', 'active', '2020-01-01'),
    ])).toEqual(['Activo con fecha', 'Activo sin fecha', 'Inactivo con fecha'])
  })

  it('mismo día: desempata por comité y puesto, siempre igual', () => {
    const xs = [
      s('Zeta', 'active', '2026-09-11', 'Comité B'),
      s('Alfa', 'active', '2026-09-11', 'Comité A'),
    ]
    expect(puestos(xs)).toEqual(['Alfa', 'Zeta'])
    expect(puestos([...xs].reverse())).toEqual(['Alfa', 'Zeta'])
  })

  it('no muta el arreglo que recibe', () => {
    const xs = [s('B', 'inactive', '2020-01-01'), s('A', 'active', '2026-01-01')]
    ordenarServicios(xs)
    expect(xs.map(x => x.position)).toEqual(['B', 'A'])
  })

  it('una lista vacía no revienta', () => {
    expect(ordenarServicios([])).toEqual([])
  })
})

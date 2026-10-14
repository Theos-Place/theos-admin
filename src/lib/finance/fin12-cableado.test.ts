/**
 * FIN-12 · Lo que no se puede probar sin leer el código: que el alcance por
 * sede sea UNO, que lo que es de finanzas sea de finanzas, y que las tres
 * puertas (API, guard, sidebar) digan lo mismo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const sin = (ruta: string) => readFileSync(ruta, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
const API = 'src/app/api/adelantos/route.ts'
const API_ID = 'src/app/api/adelantos/[id]/route.ts'
const RECIBOS = 'src/app/api/adelantos/[id]/receipts/route.ts'
const Q = 'src/lib/supabase/queries/adelantos.ts'

describe('FIN-12 · el alcance por sede es uno solo', () => {
  it('las tres rutas preguntan a alcanceDeSedes', () => {
    expect(sin(API)).toContain('alcanceDeSedes(auth.ctx)')
    expect(sin(API_ID)).toContain('alcanceDeSedes(ctx)')
    expect(sin(RECIBOS)).toContain('alcanceDeSedes(auth.ctx)')
  })

  it('y el alcance sale del PUESTO, por el mismo camino que da el rol', () => {
    // volunteers → service_positions → areas → sede por nombre. Si el rol y
    // el alcance salieran de lugares distintos, se desalinearían.
    const q = sin(Q)
    expect(q).toContain("from('volunteers')")
    expect(q).toContain('sedesDeLasAreas(areas, await sedesOperativas())')
    // La lista de puestos es UNA (position-roles): el rol y el alcance no
    // pueden desalinearse.
    expect(q).toContain("if (!esPuestoDeAdelantos(p?.title ?? '')) continue")
    expect(sin('src/lib/servers/position-roles.ts')).toContain("new Set(['encargado logistica', 'coordinador comida'])")
  })

  it('una sede ajena es 403, no una lista vacía', () => {
    expect(sin(API_ID)).toContain("Esa sede no es tuya.")
    expect(sin(RECIBOS)).toContain("Esa sede no es tuya.")
  })
})

describe('FIN-12 · lo que es de finanzas, es de finanzas', () => {
  it('el presupuesto lo fija finanzas', () => {
    expect(sin(API)).toContain("El presupuesto lo fija finanzas.")
  })

  it('el mes lo cierra finanzas', () => {
    expect(sin(API_ID)).toContain("El mes lo cierra finanzas.")
  })

  it('el Excel exige el permiso de export del módulo', () => {
    expect(sin('src/app/api/adelantos/export/route.ts')).toContain("requireModuleView('finanzas', { action: 'export' })")
  })

  it('el presupuesto se COPIA al abrir el mes, no se lee en vivo', () => {
    // Subirlo en noviembre no puede reescribir el saldo de octubre.
    const q = sin(Q)
    expect(q).toContain('presupuesto: p.monto')
    expect(q).toContain("Esta sede no tiene presupuesto fijado.")
  })

  it('cerrar ESCRIBE el saldo final y exige que siga abierto', () => {
    const q = sin(Q)
    expect(q).toContain('saldo_final: a.saldo.restante')
    expect(q).toMatch(/\.eq\('id', id\)\.eq\('estado', 'abierto'\)/)
  })
})

describe('FIN-12 · las tres puertas de la pantalla', () => {
  it('guard del layout, sidebar y rol usan el permiso `adelantos`', () => {
    expect(sin('src/app/(admin)/layout.tsx')).toContain("pathname.startsWith('/finanzas/adelantos') && can('adelantos', 'view')")
    expect(sin('src/components/layout/Sidebar.tsx')).toContain("can('adelantos', 'view')")
    expect(sin('src/lib/auth/roles.ts')).toContain("{ module: 'adelantos', actions: ['view', 'create', 'edit'], scope: 'committee' }")
  })

  it('el rol lo da el puesto, solo en comités de sede', () => {
    expect(sin('src/lib/servers/position-roles.ts')).toContain('esComiteDeSede(ctx) && esPuestoDeAdelantos(ctx.title)')
  })

  it('la migración prende RLS en las tres tablas y abre el CHECK de roles', () => {
    const sql = readFileSync('supabase/migrations/20261014120000_fin12_adelantos_de_comida.sql', 'utf8')
    for (const t of ['sede_advance_budgets', 'sede_advances', 'sede_advance_expenses']) expect(sql).toContain(`alter table public.${t} enable row level security`)
    expect(sql).toContain("colaborador_finanzas")
  })
})

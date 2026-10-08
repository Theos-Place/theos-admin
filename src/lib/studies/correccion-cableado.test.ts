import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * EL CAMINO de corregir una sesión, de punta a punta.
 *
 * Lo mismo que con la vista por participante: las dos puntas pueden estar
 * bien y el medio romperse sin que nadie se entere (EST-26, 2026-10-07).
 */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const ENDPOINT = 'src/app/api/studies/groups/[id]/sessions/[sessionId]/route.ts'
const PASAR_LISTA = 'src/app/(admin)/estudios/grupos/[id]/asistencia/page.tsx'
const GRUPO = 'src/app/(admin)/estudios/grupos/[id]/page.tsx'
const QUERIES = 'src/lib/supabase/queries/studies.ts'

describe('corregir asistencia · permiso', () => {
  const src = sinComentarios(ENDPOINT)

  it('es la MISMA puerta que pasar lista, no una lista de roles nueva', () => {
    // Con una segunda lista, el día que se agregue un rol a una se queda
    // alguien que puede marcar y no corregir, o al revés.
    expect(src).toContain('groupViewerScope')
    expect(src).toMatch(/scope !== 'admin' && scope !== 'leader'/)
    expect(src).toContain('status: 403')
  })

  it('estar inscrito NO alcanza: un estudiante no se borra su propia falta', () => {
    expect(src).toContain('isEnrolled: false')
  })

  it('PATCH y DELETE pasan los dos por la misma puerta', () => {
    expect(src).toContain('export async function PATCH')
    expect(src).toContain('export async function DELETE')
    expect((src.match(/await puertaDeEntrada\(/g) ?? []).length).toBe(2)
  })

  it('una sesión de OTRO grupo no se toca pasando su id a mano', () => {
    /**
     * El `group_id` va dentro de la consulta, no en un `if` posterior: si la
     * sesión no es de ese grupo, no se encuentra y la respuesta es 404.
     */
    const q = sinComentarios(QUERIES)
    for (const fn of ['getSessionForEdit', 'deleteGroupSession', 'updateGroupSession']) {
      const cuerpo = q.slice(q.indexOf(`export async function ${fn}`), q.indexOf(`export async function ${fn}`) + 1400)
      expect(cuerpo, fn).toContain("'group_id', groupId")
    }
  })
})

describe('corregir asistencia · que no se pierda nada', () => {
  it('las reglas se revalidan en el SERVIDOR, no solo en la pantalla', () => {
    const src = sinComentarios(ENDPOINT)
    expect(src).toContain('motivoQueImpide(cambio)')
    expect(src).toContain('safeParse')
    expect(src).toContain('Datos inválidos')
  })

  it('el cambio y el borrado quedan en la bitácora, con el antes', () => {
    // «¿Quién le quitó la falta?» no se contesta sin esto.
    const src = sinComentarios(ENDPOINT)
    expect(src).toContain("action: 'UPDATE'")
    expect(src).toContain("action: 'DELETE'")
    expect((src.match(/oldData:/g) ?? []).length).toBe(2)
  })

  it('al borrar, la sesión se guarda en la bitácora ANTES de borrarla', () => {
    // Después no hay de dónde sacarla.
    const src = sinComentarios(ENDPOINT)
    const d = src.slice(src.indexOf('export async function DELETE'))
    expect(d.indexOf('logAudit')).toBeLessThan(d.indexOf('deleteGroupSession'))
  })

  it('las marcas se reemplazan enteras: no queda media lista vieja', () => {
    const q = sinComentarios(QUERIES)
    const fn = q.slice(q.indexOf('export async function updateGroupSession'))
    expect(fn.indexOf('.delete()')).toBeLessThan(fn.indexOf('.insert('))
  })
})

describe('corregir asistencia · la pantalla', () => {
  const src = sinComentarios(PASAR_LISTA)

  it('es la MISMA pantalla de pasar lista, con ?sesion=', () => {
    // Dos pantallas de marcar gente se desalinean en cuanto cambie quién
    // aparece en la lista.
    expect(src).toContain("useSearchParams().get('sesion')")
    expect(src).toContain('const corrigiendo = !!sesionId')
  })

  it('PRECARGA lo guardado — sin esto, abrir y guardar borraría todo', () => {
    /**
     * El efecto de carga normal deja a todo el mundo en ausente, que es lo
     * correcto para una lista nueva. En corrección hay que pisarlo con lo
     * que ya estaba, o entrar a corregir la fecha y apretar Guardar marcaría
     * ausente al grupo entero.
     */
    expect(src).toContain('setMarcasPrevias(')
    expect(src).toMatch(/next\[m\.member_id\] = m\.present/)
  })

  it('corrige con PATCH y crea con POST, cada uno a su endpoint', () => {
    expect(src).toContain("method: 'PATCH'")
    expect(src).toContain("method: 'POST'")
    expect(src).toContain('sessions/${sesionId}')
  })

  it('borrar pide confirmación y dice cuántas marcas se lleva', () => {
    expect(src).toContain('textoDeBorrado(')
    expect(src).toContain('setConfirmandoBorrado(true)')
    // Modal compartido, como manda el estándar de accesibilidad.
    expect(src).toContain("from '@/components/shared/Modal'")
  })

  it('y la lista de sesiones ofrece Corregir', () => {
    const g = sinComentarios(GRUPO)
    expect(g).toContain('asistencia?sesion=${s.id}')
  })
})

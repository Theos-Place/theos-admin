import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * «Continuar editando» un borrador tiene que abrir el borrador.
 *
 * EL BUG (reportado el 2026-10-01): el botón llevaba a
 * `/comunicaciones/nueva` — un template literal SIN nada que interpolar—, así
 * que el id nunca viajaba y siempre se abría un mensaje nuevo en blanco. El
 * borrador quedaba guardado y a la vez inalcanzable.
 *
 * Y debajo había un segundo bug de la misma familia: el precargado de
 * `?reenviar=` salía del valor inicial de un `useState` leyendo una lista que
 * un hook trae DESPUÉS. En el primer render está vacía, el valor inicial sale
 * '' y `useState` no se vuelve a aplicar. Funcionaba solo si los datos ya
 * estaban en caché.
 */
const LISTA = readFileSync('src/app/(admin)/comunicaciones/page.tsx', 'utf8')
const NUEVA = readFileSync('src/app/(admin)/comunicaciones/nueva/page.tsx', 'utf8')
const ENDPOINT = readFileSync('src/app/api/communications/messages/[id]/route.ts', 'utf8')
const QUERY = readFileSync('src/lib/supabase/queries/communications.ts', 'utf8')

describe('el enlace del borrador', () => {
  it('lleva el id', () => {
    expect(NUEVA).toContain("searchParams.get('borrador')")
    expect(LISTA).toContain('/comunicaciones/nueva?borrador=${msg.id}')
  })

  it('y ya no existe el enlace pelado que no llevaba nada', () => {
    // El cebo exacto del bug: un href a /comunicaciones/nueva sin parámetros
    // desde la tarjeta del borrador.
    expect(LISTA).not.toMatch(/href=\{`\/comunicaciones\/nueva`\}/)
  })
})

describe('la precarga', () => {
  it('espera a que lleguen los mensajes en vez de leerlos en el valor inicial', () => {
    // El bug original: `useState(reenviarMsg?.subject ?? '')` con una lista
    // que llega después. Ahora se busca en cada render y se sincroniza cuando
    // aparece.
    expect(NUEVA).toContain('const paraPrecargar = precargarDe ? messages.find(m => m.id === precargarDe) : null')
    expect(NUEVA).toContain('if (paraPrecargar && cargadoDe !== paraPrecargar.id)')
  })

  it('sincroniza durante el render, NO dentro de un efecto', () => {
    /**
     * Un efecto pintaría primero el formulario vacío y lo corregiría después
     * —parpadeo y render en cascada—. Además el CI tiene una verja de
     * `react-hooks/set-state-in-effect` que no deja agregar casos nuevos, y
     * la primera versión de este arreglo la rompió: 56 warnings contra un
     * tope de 55.
     */
    const bloque = NUEVA.slice(NUEVA.indexOf('const precargarDe ='), NUEVA.indexOf('async function saveDraft'))
    expect(bloque).not.toContain('useEffect')
  })

  it('se aplica UNA vez por id, para no pisar lo que la persona escribió', () => {
    expect(NUEVA).toContain('setCargadoDe(paraPrecargar.id)')
  })

  it('cubre también el camino de reenviar, que fallaba igual', () => {
    expect(NUEVA).toContain('const precargarDe = borradorId || reenviarId')
  })
})

describe('guardar', () => {
  it('actualiza el mismo borrador en vez de crear otro', () => {
    expect(NUEVA).toContain("method: borradorId ? 'PATCH' : 'POST'")
    expect(NUEVA).toContain('`/api/communications/messages/${borradorId}`')
  })

  it('el endpoint existe y pide rol, no solo sesión', () => {
    expect(ENDPOINT).toContain('export async function PATCH')
    expect(ENDPOINT).toMatch(/PATCH[\s\S]{0,200}requireRoles\('comunicaciones', 'direccion'\)/)
  })

  it('el endpoint valida con zod y responde la convención', () => {
    expect(ENDPOINT).toContain('draftPatchSchema')
    expect(ENDPOINT).toContain("error: 'Datos inválidos'")
    expect(ENDPOINT).toContain('z.treeifyError')
  })

  it('SOLO toca borradores: lo enviado no se reescribe', () => {
    /**
     * La guarda que importa. Sin el filtro por estado, "continuar editando"
     * podría reescribir el cuerpo de algo que ya salió, y el historial
     * dejaría de decir qué fue lo que la gente recibió.
     */
    expect(QUERY).toMatch(/updateDraftBroadcast[\s\S]{0,700}\.eq\('status', 'draft'\)/)
  })

  it('y avisa cuando ya no es borrador en vez de decir que guardó', () => {
    expect(QUERY).toMatch(/updateDraftBroadcast[\s\S]{0,900}return \(data \?\? \[\]\)\.length > 0/)
    expect(ENDPOINT).toContain("code: 'no_es_borrador'")
    expect(ENDPOINT).toContain('status: 409')
  })
})

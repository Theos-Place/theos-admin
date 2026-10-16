import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  audienciaDeRecurso, estaPublicado, gestionaRecursos, puedeAbrir, rutaDelArchivo, TIPOS_DE_ARCHIVO,
} from './reglas'
import { normalizeRestriction } from '@/lib/audiencia/restriccion'
import { tipoPorContenido } from '@/lib/archivos/tipo-por-contenido'

const sinComentarios = (r: string) =>
  readFileSync(r, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(?<!\w)\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const porRol = { conditions: [{ id: 1, group: 'role', type: 'role', role: 'dirigente' }], groups: [], ops: {} }
const porPuesto = { conditions: [{ id: 1, group: 'service', type: 'service', area: 'a1', committee: 'Logística', position: 'Encargado', status: 'active', from: '', to: '' }], groups: [], ops: {} }
const combinada = {
  conditions: [porRol.conditions[0], { ...porPuesto.conditions[0], id: 2 }],
  groups: [], ops: { c2: 'OR' },
}

describe('REC-1 · la audiencia', () => {
  it('por ROL: los recursos la aceptan', () => {
    expect(audienciaDeRecurso(porRol)?.conditions).toHaveLength(1)
  })

  it('pero la lista GENERAL (grupos, formularios) no: el rol es solo de recursos', () => {
    expect(normalizeRestriction(porRol)).toBeNull()
  })

  it('por PUESTO de servicio', () => {
    expect(audienciaDeRecurso(porPuesto)?.conditions[0].type).toBe('service')
  })

  it('COMBINADA: rol y puesto en la misma audiencia, con su operador', () => {
    const a = audienciaDeRecurso(combinada)
    expect(a?.conditions.map(c => c.type)).toEqual(['role', 'service'])
    // El «o» entre los dos se conserva: sin él serían «dirigentes QUE ADEMÁS sirven ahí».
    expect(a?.ops).toEqual({ c2: 'OR' })
  })

  it('basura o una condición desconocida no publica nada', () => {
    expect(audienciaDeRecurso({ conditions: [{ id: 1, type: 'hack' }] })).toBeNull()
    expect(audienciaDeRecurso('x')).toBeNull()
  })
})

describe('REC-1 · publicado y borrador', () => {
  it('sin audiencia NO es «para todos»: es un borrador de gestión', () => {
    expect(estaPublicado({ audience: null })).toBe(false)
    expect(estaPublicado({ audience: porRol })).toBe(true)
  })
})

describe('REC-1 · quién abre', () => {
  it('quien no es audiencia NO abre, aunque adivine el id', () => {
    expect(puedeAbrir({ gestiona: false, publicado: true, pasaLaAudiencia: false })).toBe(false)
  })

  it('un borrador no lo abre nadie más que gestión', () => {
    expect(puedeAbrir({ gestiona: false, publicado: false, pasaLaAudiencia: true })).toBe(false)
    expect(puedeAbrir({ gestiona: true, publicado: false, pasaLaAudiencia: false })).toBe(true)
  })

  it('la audiencia, publicado → sí', () => {
    expect(puedeAbrir({ gestiona: false, publicado: true, pasaLaAudiencia: true })).toBe(true)
  })

  it('el endpoint del archivo evalúa la audiencia ANTES de firmar, y contesta 403', () => {
    const r = sinComentarios('src/app/api/resources/[id]/file/route.ts')
    expect(r.indexOf('pasaLaAudiencia(')).toBeGreaterThan(-1)
    expect(r.indexOf('pasaLaAudiencia(')).toBeLessThan(r.indexOf('firmarArchivo('))
    expect(r).toContain('{ status: 403 }')
  })

  it('pierde el puesto → deja de ver: la audiencia se evalúa en vivo, no se guarda quién la cumple', () => {
    const q = sinComentarios('src/lib/supabase/queries/resources.ts')
    expect(q).toContain('memberPassesRestriction(memberId')
    // El motor de puestos mira los voluntariados VIGENTES en cada consulta.
    const motor = sinComentarios('src/lib/supabase/queries/members.ts')
    expect(motor).toMatch(/case 'role': \{[\s\S]*?\.eq\('role', c\.role\)\.eq\('is_active', true\)/)
  })
})

describe('REC-1 · quién gestiona', () => {
  it('el rol `recursos` y admin; nadie más', () => {
    expect(gestionaRecursos(['recursos'])).toBe(true)
    expect(gestionaRecursos(['admin'])).toBe(true)
    expect(gestionaRecursos(['miembro'])).toBe(false)
    expect(gestionaRecursos(['dirigente'])).toBe(false)
    // solo_lectura VE todo el sistema, pero no sube ni borra.
    expect(gestionaRecursos(['solo_lectura'])).toBe(false)
    expect(gestionaRecursos(null)).toBe(false)
  })

  it('subir, editar y borrar exigen el permiso en el SERVIDOR', () => {
    expect(sinComentarios('src/app/api/resources/route.ts')).toContain("requireModuleView('recursos', { action: 'create' })")
    const id = sinComentarios('src/app/api/resources/[id]/route.ts')
    expect(id).toContain("requireModuleView('recursos', { action: 'edit' })")
    expect(id).toContain("requireModuleView('recursos', { action: 'delete' })")
  })

  it('el contador de audiencia acepta el rol SOLO de quien gestiona recursos', () => {
    const c = sinComentarios('src/app/api/audience/count/route.ts')
    expect(c).toContain("hasModulePermission(auth.ctx.roles, 'recursos', 'create')")
  })
})

describe('REC-1 · el archivo', () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
  const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00])

  it('se reconoce por el CONTENIDO, no por el nombre', () => {
    expect(tipoPorContenido(pdf, TIPOS_DE_ARCHIVO)).toBe('application/pdf')
    expect(tipoPorContenido(webp, TIPOS_DE_ARCHIVO)).toBe('image/webp')
    expect(tipoPorContenido(exe, TIPOS_DE_ARCHIVO)).toBeNull()
  })

  it('documentos de empleados sigue sin aceptar WebP', () => {
    expect(tipoPorContenido(webp)).toBeNull()
  })

  it('la ruta en el bucket no lleva nada que venga del usuario', () => {
    expect(rutaDelArchivo('abc', 'application/pdf')).toBe('abc.pdf')
  })
})

describe('REC-1 · la subida no pasa por la función de Vercel', () => {
  /**
   * 2026-10-16: la primera versión mandaba el archivo por la función, y
   * Vercel corta todo lo que pasa de 4,5 MB con un 413 antes de llegar a la
   * app. El primer PDF real no se pudo subir.
   */
  const p = sinComentarios('src/app/(admin)/recursos/page.tsx')
  const post = sinComentarios('src/app/api/resources/route.ts')
  const permiso = sinComentarios('src/app/api/resources/upload-urls/route.ts')

  it('el navegador sube directo a Storage con un permiso firmado', () => {
    expect(p).toContain("fetch('/api/resources/upload-urls'")
    expect(p).toContain('.uploadToSignedUrl(p.path, p.token, file!')
    expect(p).not.toMatch(/new FormData\(\)/)
  })

  it('el permiso lo da solo quien gestiona, y la ruta la decide el servidor', () => {
    expect(permiso).toContain("requireModuleView('recursos', { action: 'create' })")
    expect(permiso).toContain('rutaDelArchivo(id,')
    expect(permiso).toContain('.max(TAMANO_MAXIMO')
  })

  it('al registrar, el servidor mira el CONTENIDO real del archivo subido', () => {
    expect(post).toContain('inspeccionarArchivo(d.path)')
    expect(post).toContain('tipoPorContenido(archivo.inicio, TIPOS_DE_ARCHIVO)')
    expect(post).not.toContain('formData(')
  })
})

describe('REC-1 · la pantalla', () => {
  const p = sinComentarios('src/app/(admin)/recursos/page.tsx')

  it('borra con confirmación, y avisa antes si está publicado', () => {
    expect(p).toContain('<DeleteConfirmModal')
    expect(p).toContain('<ActiveWarningModal')
    expect(p).toContain('if (r.publicado) setAviso(r)')
  })

  it('abre y descarga SOLO por el endpoint que valida', () => {
    expect(p).toContain('`/api/resources/${r.id}/file`')
    expect(p).not.toMatch(/storage\/v1|createSignedUrl/)
  })

  it('el editor ofrece el rol y pide el contador con permiso', () => {
    expect(p).toContain('tipos={TIPOS_DE_AUDIENCIA_DE_RECURSOS}')
    expect(p).toContain('contexto="recursos"')
  })
})

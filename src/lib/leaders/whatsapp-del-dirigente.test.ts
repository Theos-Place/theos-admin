import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * DIR-8 · «Está en el grupo de WhatsApp»: marca manual, no confidencial.
 *
 * Nadie puede saberlo desde el sistema —WhatsApp no nos habla—, así que lo
 * marca quien administra el grupo. Y NO es una nota confidencial: es
 * logística, así que lo edita cualquiera que pueda editar el estado, sin
 * pasar por el permiso de notas.
 */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const API = sinComentarios('src/app/api/studies/dirigentes/[id]/estado/route.ts')
const FORM = sinComentarios('src/components/studies/EstadoDelDirigente.tsx')

describe('el check de WhatsApp', () => {
  it('el endpoint lo acepta', () => {
    expect(API).toContain('en_grupo_whatsapp: z.boolean().optional()')
  })

  it('si NO viene, no se toca', () => {
    /**
     * Es la diferencia entre «no lo mandé» y «lo desmarqué». Sin esto,
     * cualquier pantalla que guarde el estado sin incluir el campo sacaría
     * del grupo a la persona sin que nadie lo pidiera.
     */
    expect(API).toContain('if (d.en_grupo_whatsapp !== undefined)')
  })

  it('NO está entre los campos reservados a quien escribe notas', () => {
    // Es logística, no información sensible.
    const i = API.indexOf('CAMPOS_RESERVADOS')
    const bloque = API.slice(i, API.indexOf(']', i))
    expect(bloque).not.toContain('en_grupo_whatsapp')
  })

  it('la ficha lo muestra y dice que es manual', () => {
    expect(FORM).toContain('enGrupoWhatsapp')
    expect(FORM).toContain('Se marca a mano')
  })

  it('y viaja al guardar', () => {
    expect(FORM).toContain('en_grupo_whatsapp: e.enGrupoWhatsapp')
  })
})

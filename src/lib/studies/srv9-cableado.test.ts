import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { CAMPOS_DEL_DIRIGENTE } from './disponibilidad-de-dirigente'

/**
 * SRV-9 · El cable, y sobre todo LA PUERTA.
 *
 * Lo que este archivo cuida no lo atrapa ningún módulo puro: que el endpoint
 * que ahora abre el propio dirigente no le deje tocar su formación ni su
 * estado. La regla es una lista de PERMITIDOS y el test existe para que siga
 * siéndolo — con una lista de prohibidos, la columna que se agregue mañana
 * nace abierta.
 *
 * Se lee el código SIN comentarios: un guard que se satisface con la palabra
 * que aparece en su propia explicación no guarda nada.
 */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const RUTA = 'src/app/api/studies/dirigentes/[id]/route.ts'
const REPORTE = 'src/app/api/studies/dirigentes/formacion-reporte/route.ts'
const BLOQUE = 'src/components/studies/ConfiguracionDelDirigente.tsx'
const PERFIL = 'src/app/(admin)/miembros/[id]/page.tsx'

describe('SRV-9 · la puerta del endpoint', () => {
  const src = sinComentarios(RUTA)

  it('el dirigente entra a SU ficha, y el chequeo es por campo', () => {
    expect(src).toContain('esSuPropiaFicha')
    expect(src).toContain('motivoQueImpideEditar')
  })

  it('y solo si YA tiene ficha: llenar disponibilidad no te vuelve dirigente', () => {
    // Sin esto, updateDirigenteConfig le CREARÍA la ficha a cualquiera con
    // sesión y el comité vería crecer su lista con gente que nunca nombró.
    expect(src).toMatch(/sin_ficha/)
    const gate = src.slice(src.indexOf('if (!esComite) {'), src.indexOf('bodySchema.safeParse'))
    expect(gate).toContain("from('study_leaders')")
  })

  it('el parche que se escribe sale de la lista de PERMITIDOS, no del body crudo', () => {
    // `for (const campo of CAMPOS_DEL_DIRIGENTE)` y no `{...body}`: si el body
    // se copiara entero, un campo nuevo del schema llegaría a la base sin que
    // nadie lo hubiera decidido.
    expect(src).toMatch(/for \(const campo of CAMPOS_DEL_DIRIGENTE\)/)
    expect(src).not.toMatch(/updateDirigenteConfig\(id,\s*body\)/)
  })

  it('la formación NO está entre lo que el dirigente puede mandar', () => {
    expect(CAMPOS_DEL_DIRIGENTE).not.toContain('formation_study_codes')
    expect(CAMPOS_DEL_DIRIGENTE).not.toContain('availability_status')
  })

  it('confirmar sella la fecha aunque no venga ningún otro cambio', () => {
    expect(src).toContain("action === 'confirmar_datos'")
    expect(src).toContain('availability_confirmed_at')
  })

  it('el rango del año se valida con la regla pura antes de guardar', () => {
    const validacion = src.indexOf('motivoQueImpideElRango')
    const escritura = src.indexOf('await updateDirigenteConfig')
    expect(validacion).toBeGreaterThan(-1)
    expect(validacion).toBeLessThan(escritura)
  })
})

describe('SRV-9 · el reporte de formación', () => {
  const src = sinComentarios(REPORTE)

  it('solo se reporta la PROPIA formación', () => {
    expect(src).toMatch(/auth\.ctx\.memberId !== member_id/)
  })

  it('NO toca la formación: solo avisa', () => {
    // Borrar automático lo que parece sobra borraría formación real que se
    // registró raro. La cambia una persona, a mano.
    expect(src).not.toContain('formation_study_codes')
    expect(src).toContain('internal_notifications')
  })

  it('si no hay a quién avisarle, lo dice en vez de tragárselo', () => {
    expect(src).toContain('sin_destinatario')
  })
})

describe('SRV-9 · el tab del perfil', () => {
  it('aparece solo con ficha de dirigente, y lo edita solo su dueño', () => {
    const src = sinComentarios(PERFIL)
    expect(src).toMatch(/tieneFichaDeDirigente && \(isOwnProfile \|\| isStudyAdmin\)/)
    // El comité la VE pero no la edita desde acá: para eso está la pantalla de
    // dirigentes, que además maneja la formación y el estado.
    expect(src).toMatch(/<ConfiguracionDelDirigente[\s\S]*?editable=\{isOwnProfile\}/)
  })

  it('la formación se muestra sin controles de edición', () => {
    const src = sinComentarios(BLOQUE)
    const bloque = src.slice(src.indexOf('Tu formación'), src.indexOf('¿Qué querés dar?'))
    expect(bloque).not.toContain('alternarLista')
    expect(bloque).not.toContain('guardar(')
  })

  it('guarda campo por campo y no con un botón «Guardar» general', () => {
    // Con un botón general, tocar tres casillas y cerrar la pestaña pierde las
    // tres — y esto se llena desde el teléfono.
    const src = sinComentarios(BLOQUE)
    expect(src).toContain('onBlur')
    expect(src).not.toMatch(/>\s*Guardar cambios\s*</)
  })
})

describe('SRV-9 · el formulario espejo', () => {
  it('usa EL MISMO bloque del perfil, no una copia', () => {
    // Si fueran dos, la campaña de marzo y el perfil empezarían a preguntar
    // cosas distintas y nadie se enteraría hasta que los datos no cuadren.
    const filler = sinComentarios('src/components/forms/FormFiller.tsx')
    expect(filler).toContain("from '@/components/studies/ConfiguracionDelDirigente'")
    expect(filler).toContain('<ConfiguracionDelDirigente')
    const perfil = sinComentarios('src/app/(admin)/miembros/[id]/page.tsx')
    expect(perfil).toContain("from '@/components/studies/ConfiguracionDelDirigente'")
  })

  it('no se muestra en preview ni respondiendo por otra persona', () => {
    // Un bloque que promete guardar y no guarda es peor que no mostrarlo, y el
    // endpoint solo deja escribir la ficha PROPIA.
    const filler = sinComentarios('src/components/forms/FormFiller.tsx')
    const bloque = filler.slice(filler.indexOf("field.type === 'leader_availability'"))
    expect(bloque.slice(0, 400)).toMatch(/isPreview \|\| onBehalf \|\| !user\?\.member_id/)
  })

  it('no cuenta como pregunta: ni obligatoria ni columna en el export', () => {
    // No guarda respuesta — escribe en la ficha. Exigirlo bloquearía el envío
    // para siempre, y su columna en el Excel saldría vacía.
    expect(sinComentarios('src/components/forms/FormFiller.tsx'))
      .toContain("f.type !== 'leader_availability'")
    expect(sinComentarios('src/lib/forms/xlsx-export.ts'))
      .toContain("'leader_availability'")
  })
})

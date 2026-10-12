import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * MAT-3 · El aviso de salida tiene que estar ENCHUFADO al modal, no solo
 * existir en su módulo.
 *
 * Se ancla en el USO y no en el import: un import se queda en pie cuando
 * alguien borra el JSX que lo usaba, y el test pasaría con la pantalla rota.
 * Es el mismo trampazo documentado en FRM-6.
 */
const fuente = readFileSync(
  join(process.cwd(), 'src/components/finance/StudyReceiptModal.tsx'), 'utf8')

describe('StudyReceiptModal · el aviso de MAT-3', () => {
  it('pinta el aviso al intentar salir, con el nombre del estudio', () => {
    expect(fuente).toMatch(/avisoDeSalidaSinComprobante\(studyName\)/)
  })

  it('muestra las tres partes: título, cuerpo y plazo', () => {
    for (const parte of ['titulo', 'cuerpo', 'plazo']) {
      expect(fuente, parte).toMatch(
        new RegExp(`avisoDeSalidaSinComprobante\\(studyName\\)\\.${parte}`))
    }
  })

  it('el plazo NO se escribe a mano en la UI', () => {
    // Si alguien vuelve a poner "48 horas" o "72 horas" como literal, queda
    // mintiendo el día que cambie la constante — ya pasó una vez.
    expect(fuente).not.toMatch(/\b(48|72) horas\b/)
  })

  it('avisa también a quien cierra la pestaña', () => {
    expect(fuente).toMatch(/addEventListener\('beforeunload'/)
    expect(fuente).toMatch(/AVISO_AL_CERRAR_PESTANA/)
  })

  it('cancelar la matrícula sigue siendo posible', () => {
    // El aviso informa; no puede volverse una trampa sin salida.
    expect(fuente).toMatch(/onClick=\{cancelarMatricula\}/)
  })
})

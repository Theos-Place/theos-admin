import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * AUD-1 · Contrato del trigger de auditoría.
 *
 * Sin BD en los tests, se verifica el TEXTO de la migración — mismo patrón que
 * merge-members-coverage. Lo que protege es una propiedad que ya faltó una vez
 * en producción: el 15 de setiembre se vaciaron 26 fechas de nacimiento y el
 * audit_log no tenía cómo devolverlas.
 */
const SQL = readFileSync('supabase/migrations/20260915090000_audit_log_guarda_el_valor_viejo.sql', 'utf8')

describe('log_changes', () => {
  it('en UPDATE guarda el valor VIEJO', () => {
    // La versión anterior ponía `old_data` en NULL para UPDATE, literalmente:
    //   CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END
    const update = SQL.slice(SQL.indexOf("if TG_OP = 'UPDATE'"), SQL.indexOf("elsif TG_OP = 'DELETE'"))
    expect(update).toMatch(/jsonb_object_agg\(o\.key, o\.value\)/)
    expect(update).toMatch(/into v_old, v_new/)
  })

  it('compara con IS DISTINCT FROM, no con <>', () => {
    // Pasar de una fecha a NULL es justo el caso que motivó esto, y con `<>`
    // un NULL no cuenta como cambio: el valor viejo se perdería igual.
    expect(SQL).toMatch(/o\.value is distinct from n\.value/)
    expect(SQL).not.toMatch(/o\.value <> n\.value/)
  })

  it('deja updated_at fuera del diff', () => {
    // El trigger set_updated_at lo mueve en cada escritura. Si contara, todo
    // cambio traería ese ruido y un UPDATE que no tocó nada parecería tocar algo.
    expect(SQL).toMatch(/o\.key <> 'updated_at'/)
  })

  it('DELETE conserva la fila entera', () => {
    // Al borrar, la fila entera ES lo que hay que poder recuperar.
    const del = SQL.slice(SQL.indexOf("elsif TG_OP = 'DELETE'"), SQL.indexOf('else', SQL.indexOf("elsif TG_OP = 'DELETE'")))
    expect(del).toMatch(/v_old := to_jsonb\(OLD\)/)
  })

  it('INSERT conserva la fila entera en new_data', () => {
    expect(SQL.slice(SQL.lastIndexOf('else'))).toMatch(/v_new := to_jsonb\(NEW\)/)
  })
})

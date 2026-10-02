import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'

/**
 * Una ficha fusionada nunca puede volver a servir para entrar.
 *
 * EL CASO (Dylana Vincenti, 2026-10-02): su duplicada se fusionó el 14-set y
 * la cuenta con la que ella entra —la del duplicado— siguió viva. Entró el
 * 1-oct, el sistema la resolvió contra una ficha inactiva y la trató como
 * cuenta desactivada: no pudo abrir el formulario de la campa, sin forma de
 * entender por qué.
 *
 * ANTES ESTO DEPENDÍA DE LA APP: `merge_members_resuelto` deshabilita la
 * cuenta FUERA de la transacción, y su propio comentario admite que si falla
 * «queda una cuenta viva de más». Quien llama al RPC directo se salta ese
 * paso entero. Ahora lo garantiza un trigger de la BASE.
 *
 * El comportamiento se prueba contra una base de verdad en
 * `scripts/fusion/prueba-login-del-duplicado.sql`, con los cuatro casos. Este
 * test fija lo que sí se puede afirmar leyendo el repo.
 */
const DIR = 'supabase/migrations'

function ultimaDefinicion(): string {
  const archivos = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort()
  let ultima = ''
  for (const f of archivos) {
    const sql = readFileSync(`${DIR}/${f}`, 'utf8')
    // Se busca la DEFINICIÓN, no el nombre: el `revoke` y el `grant` lo
    // mencionan y vienen DESPUÉS, así que `lastIndexOf` del nombre a secas
    // devuelve la línea de permisos y el test pasa a leer tres líneas que no
    // son la función. Es la cuarta vez hoy que caigo en esto mismo.
    const i = sql.toLowerCase().lastIndexOf('create or replace function public.cerrar_login_de_ficha_fusionada')
    if (i < 0) continue
    // Se corta en el cierre del cuerpo: leer hasta el final del archivo se
    // traga el `create trigger` y el `grant`, y entonces el test pasa por
    // texto que no es la función. Ya me pasó tres veces.
    const cuerpo = sql.slice(i)
    const fin = cuerpo.indexOf('end $$;')
    ultima = fin > 0 ? cuerpo.slice(0, fin) : cuerpo
  }
  expect(ultima, 'ninguna migración define cerrar_login_de_ficha_fusionada').not.toBe('')
  return ultima
}

describe('el trigger que cierra el login del duplicado', () => {
  const def = ultimaDefinicion()

  it('bloquea la cuenta LIGADA a la ficha fusionada', () => {
    expect(def).toMatch(/update auth\.users[\s\S]*?banned_until = 'infinity'/)
    expect(def).toContain('u.id = new.auth_user_id')
  })

  it('y también la HUÉRFANA, que es peor: entra y se queda sin perfil', () => {
    expect(def).toContain('lower(u.email) = lower(new.email)')
  })

  it('NO toca la cuenta de una persona viva', () => {
    /**
     * La guarda que evita el daño. La fusión a veces muda el login del
     * duplicado a quien queda —32 de las 151 fusiones hechas terminaron así,
     * y están bien—. Sin esto, el trigger dejaría afuera a gente sana.
     */
    expect(def).toMatch(/not exists \([\s\S]*?v\.auth_user_id = u\.id and v\.is_active and v\.id <> new\.id/)
  })

  it('solo actúa en fusiones, no en una baja cualquiera', () => {
    expect(def).toContain("new.deactivation_reason is distinct from 'merged'")
  })

  it('bloquea en vez de borrar', () => {
    // Bloquear es reversible: si se decide que la persona siga entrando con
    // ese correo —lo que se hizo con Dylana— se mueve la cuenta y se
    // desbloquea. Borrar no tiene vuelta.
    expect(def).not.toMatch(/delete from auth\.users/i)
  })

  it('suelta el vínculo: una ficha muerta no es dueña de un login', () => {
    expect(def).toContain('new.auth_user_id := null')
  })

  it('la función es SECURITY DEFINER con search_path fijo y sin EXECUTE público', () => {
    // Regla de AGENTS.md: toda función nueva en `public` nace con EXECUTE
    // para PUBLIC y PostgREST la publica en /rest/v1/rpc/.
    const sql = readFileSync(`${DIR}/20261002100000_fusion_cierra_el_login_del_duplicado.sql`, 'utf8')
    expect(sql).toContain('security definer')
    expect(sql).toContain("set search_path to 'public'")
    expect(sql).toMatch(/revoke execute on function public\.cerrar_login_de_ficha_fusionada\(\) from public, anon, authenticated/)
    expect(sql).toMatch(/grant\s+execute on function public\.cerrar_login_de_ficha_fusionada\(\) to service_role/)
  })
})

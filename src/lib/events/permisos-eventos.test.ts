// 'encargado_eventos' gestiona eventos COMPLETO: ve todos los tabs y puede
// crear y editar (decisión del usuario, 2026-08-26). Antes tenía view/edit/
// export y los tabs de gestión cuelgan de 'create', así que la persona a cargo
// de los eventos veía solo Información, Check-in y Reportes.
//
// EL RIESGO QUE ESTE TEST CUIDA: las rutas de escritura NO usaban el sistema de
// permisos, sino listas de roles escritas a mano en cinco archivos. Darle el
// permiso sin tocarlas habría dejado a la pantalla mostrando botones que la API
// rechaza con 403 — el mismo callejón sin salida que hubo en /matricula y en
// "Agregar estudio". Permiso y guard tienen que moverse juntos.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { hasModulePermission, EVENT_WRITE_ROLES, EVENT_DELETE_ROLES } from '@/lib/auth/roles'
import { visibleEventTabs, EVENT_TABS } from './detail-access'

describe('encargado_eventos gestiona eventos completo', () => {
  const roles = ['encargado_eventos'] as const

  it('tiene view, create, edit y export sobre eventos', () => {
    for (const accion of ['view', 'create', 'edit', 'export']) {
      expect(hasModulePermission([...roles], 'eventos', accion), accion).toBe(true)
    }
  })

  // Esta aserción se reescribió: la primera versión comprobaba que el string
  // requireRoles('direccion') APARECIERA en el archivo, y pasaba en verde
  // mientras el DELETE quedaba abierto — ese string estaba en el PATCH. Un test
  // que busca texto en cualquier parte del archivo no prueba nada sobre el
  // verbo que importa.
  it('NO puede borrar eventos', () => {
    expect(hasModulePermission([...roles], 'eventos', 'delete')).toBe(false)
    expect(EVENT_DELETE_ROLES).not.toContain('encargado_eventos')
  })

  it('borrar es más restringido que crear/editar', () => {
    // Cancelar conserva el historial; borrar no. Si las listas se igualaran,
    // quien puede editar podría borrar — y eso ya pasó una vez.
    for (const r of EVENT_DELETE_ROLES) expect(EVENT_WRITE_ROLES).toContain(r)
    expect(EVENT_DELETE_ROLES.length).toBeLessThan(EVENT_WRITE_ROLES.length)
  })

  it('el DELETE de la ruta usa la lista de borrado, no la de escritura', () => {
    const ruta = readFileSync('src/app/api/events/[id]/route.ts', 'utf8')
    // Se mira SOLO el cuerpo del DELETE, no todo el archivo.
    const cuerpo = ruta.slice(ruta.indexOf('export async function DELETE'))
    expect(cuerpo).toContain('requireRoles(...EVENT_DELETE_ROLES)')
    expect(cuerpo).not.toContain('EVENT_WRITE_ROLES')
  })

  it('cancelar (PATCH) sigue siendo solo de direccion', () => {
    const ruta = readFileSync('src/app/api/events/[id]/route.ts', 'utf8')
    const cuerpo = ruta.slice(ruta.indexOf('export async function PATCH'), ruta.indexOf('export async function DELETE'))
    expect(cuerpo).toContain("requireRoles('direccion')")
  })

  it('ve los seis tabs del evento', () => {
    const tabs = visibleEventTabs({
      canManage: hasModulePermission([...roles], 'eventos', 'create'),
      canCheckin: hasModulePermission([...roles], 'eventos', 'edit'),
      canReport: hasModulePermission([...roles], 'eventos', 'export'),
    })
    expect(tabs).toEqual([...EVENT_TABS])
  })
})

describe('la pantalla y la API no pueden discrepar', () => {
  it('está en la lista de escritura, no solo en el permiso', () => {
    expect(EVENT_WRITE_ROLES).toContain('encargado_eventos')
  })

  it('ninguna ruta de eventos vuelve a escribir la lista a mano', () => {
    // El cron event-surveys queda fuera a propósito: dispararlo manda encuestas,
    // no crea eventos, y su lista es distinta.
    const salida = execSync(
      `grep -rn "requireRoles('direccion', 'encargado_staff', 'comunicaciones')" src/app/api --include='*.ts' || true`,
      { encoding: 'utf8' },
    ).trim()
    const lineas = salida ? salida.split('\n').filter(l => !l.includes('cron/')) : []
    expect(lineas).toEqual([])
  })

  it('las cinco rutas de escritura usan la constante', () => {
    for (const f of [
      'src/app/api/events/route.ts',
      'src/app/api/events/types/route.ts',
      'src/app/api/events/types/[typeId]/route.ts',
      'src/app/api/events/upload-flyer/route.ts',
    ]) {
      expect(readFileSync(f, 'utf8'), f).toContain('requireRoles(...EVENT_WRITE_ROLES)')
    }
  })
})

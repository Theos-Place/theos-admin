import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { destinatariosDelEnvio, resumenDeInvitaciones, esGrupoSCJ, ESTADOS_QUE_RECIBEN, type Destinatario } from './invitacion-perfil-sirve'

const d = (memberId: string, yaInvitado = false, yaLleno = false, contactable = true): Destinatario => ({ memberId, yaInvitado, yaLleno, contactable })

describe('SRV-20 · invitación al perfil S.I.R.V.E. desde el grupo', () => {
  it('solo los grupos de Sirviendo como Jesús muestran el botón', () => {
    expect(esGrupoSCJ('SCJ')).toBe(true)
    expect(esGrupoSCJ('scj')).toBe(true)
    expect(esGrupoSCJ('N1')).toBe(false)
    expect(esGrupoSCJ(null)).toBe(false)
  })

  it('recibe todo matriculado vigente, no solo quien completó (decisión 2026-10-21)', () => {
    expect(ESTADOS_QUE_RECIBEN).toContain('enrolled')
    expect(ESTADOS_QUE_RECIBEN).not.toContain('completed')
    expect(ESTADOS_QUE_RECIBEN).not.toContain('dropped')
  })

  it('primer envío: a los que no han recibido; reenvío: solo a los que recibieron y no llenaron', () => {
    const lista = [d('a'), d('b', true), d('c', true, true), d('d', false, true)]
    expect(destinatariosDelEnvio(lista, false).map(x => x.memberId)).toEqual(['a'])
    expect(destinatariosDelEnvio(lista, true).map(x => x.memberId)).toEqual(['b'])
  })

  it('nunca a quien ya llenó el perfil', () => {
    const lista = [d('c', true, true), d('d', false, true)]
    expect(destinatariosDelEnvio(lista, false)).toEqual([])
    expect(destinatariosDelEnvio(lista, true)).toEqual([])
  })

  it('quien no tiene correo (o apagó los avisos) no cuenta: no traba el botón en «enviar»', () => {
    // 'x' sin correo, 'a' invitada y sin llenar → el botón ofrece REENVIAR, no enviar.
    const lista = [d('a', true), d('x', false, false, false)]
    expect(destinatariosDelEnvio(lista, false)).toEqual([])
    expect(destinatariosDelEnvio(lista, true).map(x => x.memberId)).toEqual(['a'])
    expect(resumenDeInvitaciones(lista)).toMatchObject({ matriculados: 2, pendientes: 1, sinContacto: 1, accion: 'reenviar' })
    // Si llenó el perfil por su cuenta, deja de ser «sin contacto»: ya no hay nada que pedirle.
    expect(resumenDeInvitaciones([d('x', false, true, false)])).toMatchObject({ sinContacto: 0, accion: 'nada' })
  })

  it('el resumen dice qué ofrece el botón', () => {
    expect(resumenDeInvitaciones([d('a'), d('b')]).accion).toBe('enviar')
    expect(resumenDeInvitaciones([d('a', true), d('b', true, true)])).toMatchObject({ invitados: 2, llenaron: 1, pendientes: 1, accion: 'reenviar' })
    expect(resumenDeInvitaciones([d('a', true, true)]).accion).toBe('nada')
    expect(resumenDeInvitaciones([]).accion).toBe('nada')
  })

  it('el endpoint usa la MISMA regla de acceso que cerrar el grupo, y el correo respeta la preferencia', () => {
    const r = readFileSync('src/app/api/studies/groups/[id]/sirve-invite/route.ts', 'utf8')
    expect(r).toContain('puedeCerrarEsteGrupo(')
    expect(r).toContain('esGrupoSCJ(')
    const e = readFileSync('src/lib/email/sirve-invite-notify.ts', 'utf8')
    expect(e).toContain("filterByNotifPref(")
    expect(e).toContain('systemKey: SYSTEM_KEY')
    // BEC-3: se registra solo lo que SALIÓ (`enviado`), no lo que «no falló» (`ok`).
    expect(e).toContain('const { enviado } = await sendSystemEmail(')
    expect(e).not.toContain('const { ok } = await sendSystemEmail(')
    expect(e).toContain('sirve_form_invites')
  })

  it('el formulario queda abierto también a quien está cursando SCJ', () => {
    const m = readFileSync('supabase/migrations/20261021140000_srv20_invitacion_sirve.sql', 'utf8')
    expect(m).toContain('create table if not exists public.sirve_form_invites')
    expect(m).toContain("grant select, insert, update, delete on public.sirve_form_invites to service_role")
    expect(m).toContain("'sirve_invitacion'")
    const f = readFileSync('src/lib/servers/formulario-perfil-sirve.ts', 'utf8')
    expect(f).toContain('restriccionDelFormulario(): null')
  })
})

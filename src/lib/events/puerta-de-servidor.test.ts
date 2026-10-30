import { describe, it, expect } from 'vitest'
import {
  puertaDeServidor, ofreceServidor, VERIFICANDO, NO_ES_SERVIDOR, SIN_COMITE,
} from './puerta-de-servidor'

describe('puertaDeServidor', () => {
  it('EL HUECO: mientras carga se DICE, no se calla', () => {
    // Antes "todavía no sé" se trataba igual que "no puede": ni botón ni aviso.
    // Si la consulta fallaba, la tarjeta se quedaba muda para siempre.
    expect(puertaDeServidor(null)).toEqual({ estado: 'cargando', aviso: VERIFICANDO })
    expect(puertaDeServidor(undefined).estado).toBe('cargando')
  })

  it('servidor activo del comité organizador: sí, y sin aviso que estorbe', () => {
    expect(puertaDeServidor({ hasCommittees: true, isServer: true }))
      .toEqual({ estado: 'permitido', aviso: null })
  })

  it('no es servidor del comité: no, y se explica por qué', () => {
    expect(puertaDeServidor({ hasCommittees: true, isServer: false }))
      .toEqual({ estado: 'bloqueado', aviso: NO_ES_SERVIDOR })
  })

  it('evento sin comité organizador: no (igual que el servidor), y se dice qué arreglar', () => {
    // Históricos. Negar por falta de un dato sería impedir algo legítimo.
    expect(puertaDeServidor({ hasCommittees: false, isServer: false }))
      .toEqual({ estado: 'bloqueado', aviso: SIN_COMITE })
  })

  it('el botón solo se dibuja cuando está permitido', () => {
    expect(ofreceServidor(puertaDeServidor(null))).toBe(false)
    expect(ofreceServidor(puertaDeServidor({ hasCommittees: true, isServer: false }))).toBe(false)
    expect(ofreceServidor(puertaDeServidor({ hasCommittees: true, isServer: true }))).toBe(true)
    // Igual que el servidor (calificaComoServidor, SRV-1): sin comité, no.
    expect(ofreceServidor(puertaDeServidor({ hasCommittees: false, isServer: false }))).toBe(false)
  })
})

describe('CHK-10 · el modal de familia dice que verifica y por qué no (2026-10-30)', () => {
  it('muestra el aviso de la puerta por persona y resuelve cada consulta apenas llega', async () => {
    const { readFileSync } = await import('node:fs')
    const page = readFileSync('src/app/(admin)/eventos/[id]/checkin/page.tsx', 'utf8')
    expect(page).toContain('puertaDeServidor(puertas[p.member_id]).aviso')
    expect(page).not.toContain('void Promise.all(everyone.map(async p => {')
  })
})

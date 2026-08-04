import { describe, it, expect } from 'vitest'
import {
  emptySkipReasons, totalSkipped, noRecipientsMessage,
  skipReasonLabel, skipReasonAction, isSkipReason,
} from './skip-reasons'

const r = (over: Partial<ReturnType<typeof emptySkipReasons>> = {}) => ({ ...emptySkipReasons(), ...over })

describe('totalSkipped', () => {
  it('suma todas las causas', () => {
    expect(totalSkipped(r({ baja: 2, rebotado: 1, sin_correo: 3 }))).toBe(6)
    expect(totalSkipped(emptySkipReasons())).toBe(0)
  })
})

describe('noRecipientsMessage', () => {
  it('la baja en marketing sugiere cambiar a transaccional', () => {
    const msg = noRecipientsMessage(r({ baja: 1 }), true)
    expect(msg).toContain('1 se dio de baja del newsletter')
    expect(msg).toContain('quedó como borrador')
    expect(msg).toContain('transaccional')
  })

  it('en transaccional no sugiere cambiar el tipo', () => {
    expect(noRecipientsMessage(r({ baja: 1 }), false)).not.toContain('transaccional')
  })

  it('pluraliza y une varias causas', () => {
    const msg = noRecipientsMessage(r({ baja: 2, rebotado: 1, sin_correo: 4 }), false)
    expect(msg).toContain('2 se dieron de baja del newsletter')
    expect(msg).toContain('1 tiene el correo rebotado')
    expect(msg).toContain('4 no tienen correo en su ficha')
    expect(msg).toMatch(/, .* y /)
  })

  it('sin causas: nadie fue seleccionado', () => {
    expect(noRecipientsMessage(emptySkipReasons(), true)).toContain('no se seleccionó a nadie')
  })

  it('la queja y el silenciado también se explican', () => {
    expect(noRecipientsMessage(r({ queja: 1 }), false)).toContain('marcó un correo como spam')
    expect(noRecipientsMessage(r({ silenciado: 3 }), false)).toContain('silenciaron los mensajes del sistema')
  })
})

describe('skipReasonLabel', () => {
  it('traduce cada código a algo legible', () => {
    expect(skipReasonLabel('sin_correo')).toBe('Sin correo en la ficha')
    expect(skipReasonLabel('rebotado')).toBe('Correo rebotado')
    expect(skipReasonLabel('baja')).toBe('Se dio de baja del newsletter')
    expect(skipReasonLabel('queja')).toBe('Marcó un correo como spam')
    expect(skipReasonLabel('silenciado')).toBe('Silenció los mensajes del sistema')
  })

  it('un código desconocido se muestra tal cual, no se pierde', () => {
    expect(skipReasonLabel('motivo_nuevo_del_futuro')).toBe('motivo_nuevo_del_futuro')
  })

  it('sin motivo lo dice, no deja la celda vacía', () => {
    expect(skipReasonLabel(null)).toBe('Sin motivo registrado')
    expect(skipReasonLabel('')).toBe('Sin motivo registrado')
    expect(skipReasonLabel('   ')).toBe('Sin motivo registrado')
  })
})

describe('skipReasonAction', () => {
  it('cada motivo conocido dice qué hacer: la lista tiene que ser accionable', () => {
    for (const r of ['sin_correo', 'rebotado', 'queja', 'baja', 'silenciado']) {
      expect(skipReasonAction(r)).toBeTruthy()
    }
  })

  it('null cuando no hay nada que sugerir', () => {
    expect(skipReasonAction('otra_cosa')).toBeNull()
    expect(skipReasonAction(null)).toBeNull()
  })
})

describe('isSkipReason', () => {
  it('distingue los códigos válidos', () => {
    expect(isSkipReason('baja')).toBe(true)
    expect(isSkipReason('inventado')).toBe(false)
    expect(isSkipReason(null)).toBe(false)
  })
})

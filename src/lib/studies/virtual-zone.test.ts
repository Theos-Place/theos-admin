import { describe, it, expect } from 'vitest'
import { zoneOnVirtualToggle, virtualZoneValue, isVirtualZone } from './virtual-zone'
import type { ComboValue } from '@/components/shared/Combobox'

const ALL: ComboValue = { kind: 'existing', value: 'all', label: 'Todas las zonas' }
const HER: ComboValue = { kind: 'existing', value: 'HER', label: 'Heredia' }

describe('zoneOnVirtualToggle (EST-4)', () => {
  it('marcar virtual fija la zona Virtual', () => {
    expect(zoneOnVirtualToggle(true, HER, ALL)).toEqual(virtualZoneValue())
    expect(zoneOnVirtualToggle(true, ALL, ALL)).toEqual(virtualZoneValue())
  })

  it('desmarcar limpia solo si la zona era Virtual', () => {
    expect(zoneOnVirtualToggle(false, virtualZoneValue(), ALL)).toEqual(ALL)
    expect(zoneOnVirtualToggle(false, HER, ALL)).toEqual(HER)
  })

  it('isVirtualZone distingue la zona fija', () => {
    expect(isVirtualZone(virtualZoneValue())).toBe(true)
    expect(isVirtualZone(HER)).toBe(false)
    expect(isVirtualZone({ kind: 'empty' })).toBe(false)
  })
})

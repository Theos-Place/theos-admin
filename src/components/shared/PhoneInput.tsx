'use client'

import { useState, useEffect } from 'react'

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
}

const COUNTRY_CODES = [
  { code: '+506', flag: '🇨🇷', name: 'Costa Rica' },
  { code: '+1',   flag: '🇺🇸', name: 'Estados Unidos' },
  { code: '+52',  flag: '🇲🇽', name: 'México' },
  { code: '+502', flag: '🇬🇹', name: 'Guatemala' },
  { code: '+503', flag: '🇸🇻', name: 'El Salvador' },
  { code: '+504', flag: '🇭🇳', name: 'Honduras' },
  { code: '+505', flag: '🇳🇮', name: 'Nicaragua' },
  { code: '+507', flag: '🇵🇦', name: 'Panamá' },
  { code: '+34',  flag: '🇪🇸', name: 'España' },
]

function getCountryCode(val: string): string {
  const match = COUNTRY_CODES.find(c => val.startsWith(c.code))
  return match?.code ?? '+506'
}

function getNumber(val: string): string {
  const match = COUNTRY_CODES.find(c => val.startsWith(c.code))
  return match ? val.slice(match.code.length).trim() : val
}

export function PhoneInput({ value, onChange, placeholder = '8888-0000', label }: Props) {
  const [countryCode, setCountryCode] = useState(() => getCountryCode(value))
  const [number, setNumber]           = useState(() => getNumber(value))

  // Re-sincroniza cuando la prop `value` cambia (ej. data que llega async).
  useEffect(() => {
    setCountryCode(getCountryCode(value))
    setNumber(getNumber(value))
  }, [value])

  function handleCodeChange(code: string) {
    setCountryCode(code)
    onChange(`${code} ${number}`.trim())
  }

  function handleNumberChange(num: string) {
    setNumber(num)
    onChange(`${countryCode} ${num}`.trim())
  }

  return (
    <div>
      {label && (
        <label className="form-label">{label}</label>
      )}
      <div className="flex">
        <select
          value={countryCode}
          onChange={e => handleCodeChange(e.target.value)}
          className="py-[9px] px-[10px] border border-[rgba(22,20,64,0.15)] border-r-0 rounded-l-xl rounded-r-none bg-[rgba(22,20,64,0.03)] text-[13px] text-[var(--fg,#161440)] cursor-pointer outline-none shrink-0 font-body"
        >
          {COUNTRY_CODES.map(c => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.code}
            </option>
          ))}
        </select>

        <input
          type="tel"
          value={number}
          onChange={e => handleNumberChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 py-[9px] px-[14px] border border-[rgba(22,20,64,0.15)] focus:border-[rgba(22,20,64,0.30)] rounded-r-xl rounded-l-none text-sm text-navy bg-white outline-none min-w-0 font-body transition-colors"
        />
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useId } from 'react'

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  /** AUD-1 · id del input del número, si hace falta apuntarle desde afuera. Si
   *  no se pasa, se genera con useId (dos PhoneInput no comparten id). */
  inputId?: string
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

export function PhoneInput({ value, onChange, placeholder = '8888-0000', label, inputId: idProp }: Props) {
  // useId para que dos PhoneInput en la misma pantalla no compartan id.
  const auto = useId()
  const inputId = idProp ?? `tel-${auto}`
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

  function handleNumberChange(raw: string) {
    const num = raw.replace(/\D+/g, '') // solo dígitos (limpia al vuelo lo pegado)
    setNumber(num)
    onChange(`${countryCode} ${num}`.trim())
  }

  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="form-label">{label}</label>
      )}
      <div className="flex">
        {/* AUD-1 · El select del código y el input del número son dos controles.
            El label visible apunta al NÚMERO (es lo que se escribe) y el select
            lleva su propio nombre: antes ninguno de los dos tenía nombre. */}
        <select
          aria-label="Código de país"
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
          id={inputId}
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

'use client'

import { useState } from 'react'

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
        <label
          className="block text-[12px] font-medium text-navy-light/60 mb-1.5"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {label}
        </label>
      )}
      <div style={{ display: 'flex' }}>
        <select
          value={countryCode}
          onChange={e => handleCodeChange(e.target.value)}
          style={{
            padding: '9px 10px',
            border: '1px solid rgba(22,20,64,0.15)',
            borderRight: 'none',
            borderRadius: '0.75rem 0 0 0.75rem',
            background: 'rgba(22,20,64,0.03)',
            fontSize: 13,
            color: 'var(--fg, #161440)',
            cursor: 'pointer',
            outline: 'none',
            flexShrink: 0,
            fontFamily: 'var(--font-body)',
          }}
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
          style={{
            flex: 1,
            padding: '9px 14px',
            border: '1px solid rgba(22,20,64,0.15)',
            borderRadius: '0 0.75rem 0.75rem 0',
            fontSize: 14,
            color: '#161440',
            background: 'white',
            outline: 'none',
            minWidth: 0,
            fontFamily: 'var(--font-body)',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.target.style.borderColor = 'rgba(22,20,64,0.30)')}
          onBlur={e  => (e.target.style.borderColor = 'rgba(22,20,64,0.15)')}
        />
      </div>
    </div>
  )
}

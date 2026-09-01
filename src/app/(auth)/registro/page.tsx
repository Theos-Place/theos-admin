'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { fieldA11y } from '@/lib/forms/field-a11y'
import { DOCUMENT_TYPE_LABEL, DOCUMENT_TYPES } from '@/lib/cedula'
import { erroresDeRegistro } from '@/lib/auth/registro-publico'

const INPUT = 'w-full rounded-xl border border-outline bg-surface-card px-3.5 py-2.5 text-sm text-navy font-body outline-none focus:ring-1 focus:ring-coral/30'
const LABEL = 'block text-[13px] font-medium text-navy-light/80 font-body mb-1.5'

/**
 * Registro público. Crea la ficha y su cuenta de acceso.
 *
 * El documento es obligatorio: es la llave contra duplicados, y la base tiene
 * un índice único por documento. Toda la lógica sensible —qué pasa si el
 * documento ya existe— vive en el servidor; acá solo se valida la forma, con la
 * MISMA función que usa el API para que la pantalla nunca deje mandar algo que
 * el servidor va a rechazar.
 */
export default function RegistroPage() {
  const [d, setD] = useState({
    first_name: '', last_name: '', document_type: 'cedula', cedula: '', email: '', phone: '',
  })
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState<{ texto: string; yaExistia: boolean } | null>(null)
  const [error, setError] = useState('')

  // AUD-1: los aria salen de fieldA11y. `.input` va al campo y `.error` al
  // mensaje; esparcir el objeto entero sobre el input mete `labelFor` en el DOM
  // y React lo rechaza.
  const a11y = {
    first_name: fieldA11y('reg-nombre', errores.first_name, { required: true, id: 'reg-nombre' }),
    last_name: fieldA11y('reg-apellidos', errores.last_name, { required: true, id: 'reg-apellidos' }),
    cedula: fieldA11y('reg-cedula', errores.cedula, { required: true, id: 'reg-cedula' }),
    email: fieldA11y('reg-correo', errores.email, { required: true, id: 'reg-correo' }),
    phone: fieldA11y('reg-tel', errores.phone, { id: 'reg-tel' }),
  }

  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setD(v => ({ ...v, [k]: e.target.value }))
    setErrores(v => { const n = { ...v }; delete n[k]; return n })
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    const errs = erroresDeRegistro(d)
    if (Object.keys(errs).length) { setErrores(errs); return }
    setEnviando(true); setError('')
    try {
      const res = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...d, phone: d.phone.trim() || null }),
      })
      const body = await res.json().catch(() => null)
      if (res.status === 429) { setError(body?.error ?? 'Demasiados intentos. Esperá unos minutos.'); return }
      if (!res.ok) { setErrores(body?.campos ?? {}); setError(body?.error ?? 'No se pudo completar el registro.'); return }
      setListo({ texto: body.message, yaExistia: !!body.ya_existia })
    } catch {
      setError('No pudimos completar el registro. Revisá tu conexión e intentá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  if (listo) {
    return (
      <div className="w-full max-w-[400px] text-center">
        <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${listo.yaExistia ? 'bg-amber-100' : 'bg-teal-soft/30'}`}>
          {listo.yaExistia
            ? <AlertCircle size={22} className="text-amber-700" />
            : <Check size={22} className="text-teal-deep" />}
        </div>
        {/* Se distingue "creada" de "ya existía": son dos desenlaces distintos
            y el segundo necesita que la persona entienda que NO hay perfil
            nuevo, o vuelve a intentarlo. */}
        <h1 className="text-xl font-bold text-navy font-display mb-2">
          {listo.yaExistia ? 'Ya tenías cuenta' : 'Revisá tu correo'}
        </h1>
        <p className="text-[13px] text-navy-light/80 font-body">{listo.texto}</p>
        <Link href="/login" className="mt-6 inline-block text-[13px] text-teal-deep hover:underline font-medium font-body">
          Volver a la pantalla de ingreso
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[400px]">
      <h1 className="text-xl font-bold text-navy font-display mb-1">Crear mi cuenta</h1>
      <p className="text-[13px] text-navy-light/80 font-body mb-6">
        Si ya sos parte de Theos y solo no podés entrar,{' '}
        <Link href="/recuperar" className="text-teal-deep hover:underline">recuperá tu acceso</Link> en vez de registrarte.
      </p>

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl px-4 py-3 mb-5 text-[13px] text-coral-deep bg-[rgba(239,85,84,0.07)] border border-[rgba(239,85,84,0.2)] font-body">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <form onSubmit={enviar} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="reg-nombre" className={LABEL}>Nombre</label>
            <input value={d.first_name} onChange={set('first_name')} autoComplete="given-name"
              className={INPUT} {...a11y.first_name.input} />
            {errores.first_name && <p {...a11y.first_name.error} className="mt-1.5 text-[13px] text-coral font-body">{errores.first_name}</p>}
          </div>
          <div>
            <label htmlFor="reg-apellidos" className={LABEL}>Apellidos</label>
            <input value={d.last_name} onChange={set('last_name')} autoComplete="family-name"
              className={INPUT} {...a11y.last_name.input} />
            {errores.last_name && <p {...a11y.last_name.error} className="mt-1.5 text-[13px] text-coral font-body">{errores.last_name}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3">
          <div>
            <label htmlFor="reg-tipo" className={LABEL}>Documento</label>
            <select id="reg-tipo" value={d.document_type} onChange={set('document_type')} className={INPUT}>
              {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{DOCUMENT_TYPE_LABEL[t]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="reg-cedula" className={LABEL}>Número</label>
            <input value={d.cedula} onChange={set('cedula')} inputMode="numeric"
              className={INPUT} {...a11y.cedula.input} />
            {errores.cedula && <p {...a11y.cedula.error} className="mt-1.5 text-[13px] text-coral font-body">{errores.cedula}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="reg-correo" className={LABEL}>Correo electrónico</label>
          <input type="email" value={d.email} onChange={set('email')} autoComplete="email"
            className={INPUT} {...a11y.email.input} />
          {errores.email && <p {...a11y.email.error} className="mt-1.5 text-[13px] text-coral font-body">{errores.email}</p>}
          <p className="mt-1.5 text-[13px] text-navy-light/80 font-body">Ahí te llega el enlace para crear tu contraseña.</p>
        </div>

        <div>
          <label htmlFor="reg-tel" className={LABEL}>Teléfono <span className="text-navy-light/80">(opcional)</span></label>
          <input value={d.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel"
            className={INPUT} {...a11y.phone.input} />
          {errores.phone && <p {...a11y.phone.error} className="mt-1.5 text-[13px] text-coral font-body">{errores.phone}</p>}
        </div>

        <button type="submit" disabled={enviando}
          className="w-full rounded-xl bg-coral py-3 text-sm font-semibold text-white hover:bg-coral-deep transition-colors disabled:opacity-60 font-body inline-flex items-center justify-center gap-2">
          {enviando ? <><Loader2 size={16} className="animate-spin" /> Creando…</> : 'Crear mi cuenta'}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-navy-light/80 font-body">
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" className="text-teal-deep hover:underline font-medium">Ingresá acá</Link>
      </p>
    </div>
  )
}

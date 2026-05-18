'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Lock, Check, Loader2 } from 'lucide-react'
import { mockMembers } from '@/data/mock-members'
import { ACTIVE_SEDES } from '@/data/mock-sedes'
import { cn } from '@/lib/utils'

const INPUT = [
  'w-full rounded-xl border px-4 py-3 text-sm text-navy bg-white',
  'outline-none transition-all placeholder:text-navy-light/25',
  'focus:border-navy/30 focus:ring-2 focus:ring-navy/10',
  'border-[rgba(22,20,64,0.15)]',
].join(' ')

const INPUT_READONLY = [
  'w-full rounded-xl border px-4 py-3 text-sm text-navy-light/50 bg-[rgba(22,20,64,0.03)]',
  'outline-none cursor-not-allowed border-[rgba(22,20,64,0.08)]',
].join(' ')

const LABEL = 'block text-[12px] font-medium text-navy-light/60 mb-1.5'

export default function EditarMiembroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const member = mockMembers.find(m => m.id === id)

  const [email,         setEmail]         = useState(member?.email ?? '')
  const [phone,         setPhone]         = useState(member?.phone ?? '')
  const [sede,          setSede]          = useState(member?.sede ?? '')
  const [status,        setStatus]        = useState<'active' | 'inactive'>(member?.status ?? 'active')
  const [birthDate,     setBirthDate]     = useState(member?.birth_date ?? '')
  const [gender,        setGender]        = useState(member?.gender ?? 'no_indica')
  const [maritalStatus, setMaritalStatus] = useState(member?.marital_status ?? '')
  const [profession,    setProfession]    = useState(member?.profession ?? '')
  const [workplace,     setWorkplace]     = useState(member?.workplace ?? '')
  const [address,       setAddress]       = useState(member?.address ?? '')
  const [alergias,      setAlergias]      = useState(member?.alergias ?? '')
  const [medicamentos,  setMedicamentos]  = useState(member?.medicamentos ?? '')
  const [saving,        setSaving]        = useState(false)
  const [toast,         setToast]         = useState(false)

  if (!member) {
    return (
      <div className="px-6 py-8 text-center text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
        Miembro no encontrado.{' '}
        <Link href="/miembros" className="text-coral underline">Volver a miembros</Link>
      </div>
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await new Promise(r => setTimeout(r, 900))
    setSaving(false)
    setToast(true)
    setTimeout(() => {
      setToast(false)
      router.push(`/miembros/${id}`)
    }, 1800)
  }

  return (
    <div className="px-6 py-8 max-w-2xl space-y-6">

      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/miembros/${id}`}
          className="flex items-center gap-1.5 text-[13px] text-navy-light/60 hover:text-navy transition-colors"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <ChevronLeft size={15} />
          Volver al perfil
        </Link>
      </div>

      <div>
        <h1 className="text-2xl text-navy mb-0.5" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Editar perfil
        </h1>
        <p className="text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
          {member.first_name} {member.last_name}
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">

        {/* Campos bloqueados */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
          <p className="text-[10px] uppercase tracking-widest text-navy-light/40 flex items-center gap-1.5"
            style={{ fontFamily: 'var(--font-display)' }}>
            <Lock size={11} /> Campos no editables
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL} style={{ fontFamily: 'var(--font-body)' }}>Cédula</label>
              <div className="relative">
                <input
                  type="text"
                  value={member.cedula ?? 'Sin cédula'}
                  readOnly
                  className={INPUT_READONLY}
                  style={{ fontFamily: 'var(--font-body)' }}
                />
                <Lock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-light/25" />
              </div>
            </div>
            <div>
              <label className={LABEL} style={{ fontFamily: 'var(--font-body)' }}>Nombre completo</label>
              <div className="relative">
                <input
                  type="text"
                  value={`${member.first_name} ${member.last_name}`}
                  readOnly
                  className={INPUT_READONLY}
                  style={{ fontFamily: 'var(--font-body)' }}
                />
                <Lock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-light/25" />
              </div>
            </div>
          </div>
        </div>

        {/* Datos de contacto */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
          <p className="text-[10px] uppercase tracking-widest text-navy-light/40"
            style={{ fontFamily: 'var(--font-display)' }}>Contacto</p>

          <div>
            <label className={LABEL} style={{ fontFamily: 'var(--font-body)' }}>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={INPUT}
              style={{ fontFamily: 'var(--font-body)' }}
              autoComplete="email"
            />
          </div>

          <div>
            <label className={LABEL} style={{ fontFamily: 'var(--font-body)' }}>Teléfono</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+506 8888 8888"
              className={INPUT}
              style={{ fontFamily: 'var(--font-body)' }}
            />
          </div>

          <div>
            <label className={LABEL} style={{ fontFamily: 'var(--font-body)' }}>Dirección</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Barrio, Ciudad"
              className={INPUT}
              style={{ fontFamily: 'var(--font-body)' }}
            />
          </div>
        </div>

        {/* Datos personales */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
          <p className="text-[10px] uppercase tracking-widest text-navy-light/40"
            style={{ fontFamily: 'var(--font-display)' }}>Datos personales</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL} style={{ fontFamily: 'var(--font-body)' }}>Fecha de nacimiento</label>
              <input
                type="date"
                value={birthDate}
                onChange={e => setBirthDate(e.target.value)}
                className={INPUT}
                style={{ fontFamily: 'var(--font-body)' }}
              />
            </div>
            <div>
              <label className={LABEL} style={{ fontFamily: 'var(--font-body)' }}>Género</label>
              <select
                value={gender}
                onChange={e => setGender(e.target.value as typeof gender)}
                className={INPUT}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
                <option value="no_indica">Prefiero no indicar</option>
              </select>
            </div>
            <div>
              <label className={LABEL} style={{ fontFamily: 'var(--font-body)' }}>Estado civil</label>
              <input
                type="text"
                value={maritalStatus}
                onChange={e => setMaritalStatus(e.target.value)}
                placeholder="Soltero/a, Casado/a..."
                className={INPUT}
                style={{ fontFamily: 'var(--font-body)' }}
              />
            </div>
            <div>
              <label className={LABEL} style={{ fontFamily: 'var(--font-body)' }}>Sede</label>
              <select
                value={sede}
                onChange={e => setSede(e.target.value)}
                className={INPUT}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <option value="">Seleccioná una sede</option>
                {ACTIVE_SEDES.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL} style={{ fontFamily: 'var(--font-body)' }}>Profesión</label>
              <input
                type="text"
                value={profession}
                onChange={e => setProfession(e.target.value)}
                className={INPUT}
                style={{ fontFamily: 'var(--font-body)' }}
              />
            </div>
            <div>
              <label className={LABEL} style={{ fontFamily: 'var(--font-body)' }}>Lugar de trabajo</label>
              <input
                type="text"
                value={workplace}
                onChange={e => setWorkplace(e.target.value)}
                className={INPUT}
                style={{ fontFamily: 'var(--font-body)' }}
              />
            </div>
          </div>
        </div>

        {/* Estado */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
          <p className="text-[10px] uppercase tracking-widest text-navy-light/40 mb-3"
            style={{ fontFamily: 'var(--font-display)' }}>Estado en el sistema</p>
          <div className="flex gap-3">
            {(['active', 'inactive'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  'flex-1 rounded-xl py-2.5 text-[13px] font-medium transition-all border',
                  status === s
                    ? s === 'active'
                      ? 'bg-[rgba(61,185,122,0.10)] border-[rgba(61,185,122,0.40)] text-[#3DB97A]'
                      : 'bg-[rgba(239,85,84,0.08)] border-[rgba(239,85,84,0.30)] text-coral'
                    : 'border-[rgba(22,20,64,0.12)] text-navy-light/50 hover:bg-surface-low'
                )}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {s === 'active' ? 'Activo' : 'Inactivo'}
              </button>
            ))}
          </div>
        </div>

        {/* Información médica */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
          <p className="text-[10px] uppercase tracking-widest text-navy-light/40"
            style={{ fontFamily: 'var(--font-display)' }}>Información médica</p>

          <div>
            <label className={LABEL} style={{ fontFamily: 'var(--font-body)' }}>Alergias</label>
            <textarea
              value={alergias}
              onChange={e => setAlergias(e.target.value)}
              placeholder="Ninguna conocida"
              rows={2}
              className={cn(INPUT, 'resize-none')}
              style={{ fontFamily: 'var(--font-body)' }}
            />
          </div>

          <div>
            <label className={LABEL} style={{ fontFamily: 'var(--font-body)' }}>Medicamentos</label>
            <textarea
              value={medicamentos}
              onChange={e => setMedicamentos(e.target.value)}
              placeholder="Ninguno"
              rows={2}
              className={cn(INPUT, 'resize-none')}
              style={{ fontFamily: 'var(--font-body)' }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all disabled:opacity-60"
            style={{
              background: '#EF5554',
              fontFamily: 'var(--font-body)',
              boxShadow: saving ? 'none' : '0 8px 24px rgba(239,85,84,0.25)',
            }}
          >
            {saving
              ? <><Loader2 size={15} className="animate-spin" /> Guardando...</>
              : 'Guardar cambios'
            }
          </button>
          <Link
            href={`/miembros/${id}`}
            className="rounded-xl border px-6 py-3 text-sm text-navy-light/60 hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            Cancelar
          </Link>
        </div>
      </form>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm text-white"
          style={{ background: '#161440', boxShadow: '0 12px 32px rgba(22,20,64,0.20)', fontFamily: 'var(--font-body)' }}
        >
          <Check size={15} className="text-[#3DB97A] shrink-0" />
          Perfil actualizado exitosamente
        </div>
      )}
    </div>
  )
}

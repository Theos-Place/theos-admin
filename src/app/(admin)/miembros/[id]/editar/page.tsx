'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { mockMembers } from '@/data/mock-members'
import { ACTIVE_SEDES } from '@/data/mock-sedes'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { useMockAuth } from '@/hooks/useMockAuth'

export default function EditarMiembroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user } = useMockAuth()
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('direccion')

  const member = mockMembers.find(m => m.id === id)

  // ── Estado del formulario ──────────────────────────────────────────────────
  const [firstName,             setFirstName]             = useState(member?.first_name ?? '')
  const [lastName,              setLastName]              = useState(member?.last_name ?? '')
  const [email,                 setEmail]                 = useState(member?.email ?? '')
  const [phone,                 setPhone]                 = useState(member?.phone ?? '')
  const [sede,                  setSede]                  = useState(member?.sede ?? '')
  const [isActive,              setIsActive]              = useState(member?.status === 'active' || member?.status == null)
  const [birthDate,             setBirthDate]             = useState(member?.birth_date ?? '')
  const [gender,                setGender]                = useState(member?.gender ?? 'no_indica')
  const [maritalStatus,         setMaritalStatus]         = useState(member?.marital_status ?? '')
  const [profession,            setProfession]            = useState(member?.profession ?? '')
  const [workplace,             setWorkplace]             = useState(member?.workplace ?? '')
  const [address,               setAddress]               = useState(member?.address ?? '')
  const [province,              setProvince]              = useState('')
  const [canton,                setCanton]                = useState('')
  const [district,              setDistrict]              = useState('')
  const [alergias,              setAlergias]              = useState(member?.alergias ?? '')
  const [medicamentos,          setMedicamentos]          = useState(member?.medicamentos ?? '')
  const [emergencyContactName,  setEmergencyContactName]  = useState(member?.emergency_contact_name ?? '')
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(member?.emergency_contact_phone ?? '')
  const [saving,                setSaving]                = useState(false)
  const [toast,                 setToast]                 = useState(false)

  // ── Modal desactivar ───────────────────────────────────────────────────────
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false)
  const [deactivateReason,    setDeactivateReason]    = useState('')

  if (!member) {
    return (
      <div className="page">
        <div className="ph">
          <div className="ptitle">Editar perfil</div>
        </div>
        <div className="card" style={{ padding: 22 }}>
          <p className="text-sm text-navy-light/50 text-center py-8" style={{ fontFamily: 'var(--font-body)' }}>
            Miembro no encontrado.
          </p>
        </div>
      </div>
    )
  }

  async function handleSave() {
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
    <div className="page">

      {/* ── Header ── */}
      <div className="ph">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => router.back()}
          style={{ marginBottom: 10 }}
        >
          ← Volver
        </button>
        <div className="ph-row">
          <div>
            <div className="ptitle">Editar perfil</div>
            <div className="psub">{member.first_name} {member.last_name}</div>
          </div>
          <div className="ph-actions">

            {/* Toggle estado — solo admins */}
            {isAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--fg-muted)', fontFamily: 'var(--font-body)' }}>
                  Estado:
                </span>
                <label
                  className="toggle"
                  title={isActive ? 'Clic para desactivar este miembro' : 'Clic para activar este miembro'}
                  style={{ cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => {
                      if (isActive) {
                        setDeactivateModalOpen(true)
                      } else {
                        setIsActive(true)
                      }
                    }}
                  />
                  <div className="toggle-track" />
                </label>
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  color: isActive ? 'var(--success)' : 'var(--fg-muted)',
                }}>
                  {isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            )}

            <button className="btn btn-ghost" onClick={() => router.back()}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving
                ? <><Loader2 size={14} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} />Guardando...</>
                : 'Guardar cambios'
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── Secciones ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>

        {/* ── Sección 1: Datos personales ── */}
        <div className="card">
          <div className="card-hd">
            <div className="card-title">Datos personales</div>
          </div>
          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="edit-first-name">Nombre *</label>
                <input
                  id="edit-first-name"
                  className="form-input"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Ej: Alejandro"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-last-name">Apellidos *</label>
                <input
                  id="edit-last-name"
                  className="form-input"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Ej: Ruiz Moreno"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="edit-cedula">Cédula</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="edit-cedula"
                    className="form-input"
                    value={member.cedula ?? 'Sin cédula'}
                    disabled
                    style={{ background: 'rgba(22,20,64,0.04)', color: 'rgba(41,54,92,0.45)', paddingRight: 36, cursor: 'not-allowed' }}
                  />
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13 }}>🔒</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 3, fontFamily: 'var(--font-body)' }}>
                  No editable — contactá al admin principal
                </span>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-birth-date">Fecha de nacimiento</label>
                <input
                  id="edit-birth-date"
                  type="date"
                  className="form-input"
                  value={birthDate}
                  onChange={e => setBirthDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="edit-gender">Género</label>
                <select
                  id="edit-gender"
                  className="form-select"
                  value={gender}
                  onChange={e => setGender(e.target.value as typeof gender)}
                >
                  <option value="no_indica">Prefiero no indicar</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-marital-status">Estado civil</label>
                <select
                  id="edit-marital-status"
                  className="form-select"
                  value={maritalStatus}
                  onChange={e => setMaritalStatus(e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  <option value="Soltero/a">Soltero/a</option>
                  <option value="Casado/a">Casado/a</option>
                  <option value="Divorciado/a">Divorciado/a</option>
                  <option value="Viudo/a">Viudo/a</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sección 2: Contacto ── */}
        <div className="card">
          <div className="card-hd">
            <div className="card-title">Información de contacto</div>
          </div>
          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <PhoneInput
              label="Teléfono WhatsApp"
              value={phone}
              onChange={setPhone}
            />
            <div className="form-group">
              <label className="form-label" htmlFor="edit-email">Correo electrónico</label>
              <input
                id="edit-email"
                type="email"
                className="form-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="form-row">
              <PhoneInput
                label="Contacto de emergencia — Teléfono"
                value={emergencyContactPhone}
                onChange={setEmergencyContactPhone}
              />
              <div className="form-group">
                <label className="form-label" htmlFor="edit-emergency-name">Contacto de emergencia — Nombre</label>
                <input
                  id="edit-emergency-name"
                  className="form-input"
                  value={emergencyContactName}
                  onChange={e => setEmergencyContactName(e.target.value)}
                  placeholder="Nombre completo..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Sección 3: Dirección ── */}
        <div className="card">
          <div className="card-hd">
            <div className="card-title">Dirección</div>
          </div>
          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Provincia</label>
                <select
                  className="form-select"
                  value={province}
                  onChange={e => setProvince(e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  <option>San José</option>
                  <option>Alajuela</option>
                  <option>Cartago</option>
                  <option>Heredia</option>
                  <option>Guanacaste</option>
                  <option>Puntarenas</option>
                  <option>Limón</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cantón</label>
                <input
                  className="form-input"
                  value={canton}
                  onChange={e => setCanton(e.target.value)}
                  placeholder="Ej: Escazú"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Distrito</label>
                <input
                  className="form-input"
                  value={district}
                  onChange={e => setDistrict(e.target.value)}
                  placeholder="Ej: San Rafael"
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-senas">Señas</label>
              <textarea
                id="edit-senas"
                className="form-textarea"
                rows={2}
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Del semáforo 100m norte..."
              />
            </div>
          </div>
        </div>

        {/* ── Sección 4: Trabajo y ocupación ── */}
        <div className="card">
          <div className="card-hd">
            <div className="card-title">Trabajo y ocupación</div>
          </div>
          <div style={{ padding: '18px 22px' }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="edit-profession">Profesión / Ocupación</label>
                <input
                  id="edit-profession"
                  className="form-input"
                  value={profession}
                  onChange={e => setProfession(e.target.value)}
                  placeholder="Ej: Ingeniería en Sistemas"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-workplace">Lugar de trabajo</label>
                <input
                  id="edit-workplace"
                  className="form-input"
                  value={workplace}
                  onChange={e => setWorkplace(e.target.value)}
                  placeholder="Ej: Intel Costa Rica"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Sección 5: Sede y salud ── */}
        <div className="card">
          <div className="card-hd">
            <div className="card-title">Sede y salud</div>
          </div>
          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Sede */}
            <div className="form-group">
              <label className="form-label" htmlFor="edit-sede">Sede</label>
              <select
                id="edit-sede"
                className="form-select"
                value={sede}
                onChange={e => setSede(e.target.value)}
              >
                <option value="">Seleccioná una sede</option>
                {ACTIVE_SEDES.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Salud */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="edit-alergias">Alergias</label>
                <textarea
                  id="edit-alergias"
                  className="form-textarea"
                  value={alergias}
                  onChange={e => setAlergias(e.target.value)}
                  placeholder="Ninguna conocida"
                  rows={2}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-medicamentos">Medicamentos</label>
                <textarea
                  id="edit-medicamentos"
                  className="form-textarea"
                  value={medicamentos}
                  onChange={e => setMedicamentos(e.target.value)}
                  placeholder="Ninguno"
                  rows={2}
                />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm text-white"
          style={{ background: '#161440', boxShadow: '0 12px 32px rgba(22,20,64,0.20)', fontFamily: 'var(--font-body)' }}
        >
          <Check size={15} className="text-[#3DB97A] shrink-0" />
          Perfil actualizado exitosamente
        </div>
      )}

      {/* ── Modal desactivar ── */}
      {deactivateModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            background: 'var(--surface-card)', borderRadius: 20,
            padding: 28, maxWidth: 440, width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            {/* Ícono de advertencia */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'rgba(239,85,84,.1)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand-coral)" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--brand-navy)', fontFamily: 'var(--font-display)' }}>
                ¿Desactivar a {member.first_name} {member.last_name}?
              </h3>
              <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 6, fontFamily: 'var(--font-body)' }}>
                El perfil quedará inaccesible y la persona será removida de todos sus roles activos. El historial se conserva intacto.
              </p>
            </div>

            {/* Motivo obligatorio */}
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Motivo de desactivación *</label>
              <select
                className="form-select"
                value={deactivateReason}
                onChange={e => setDeactivateReason(e.target.value)}
              >
                <option value="">Seleccionar motivo...</option>
                <option value="fallecimiento">Fallecimiento</option>
                <option value="solicitud_miembro">Solicitud del miembro</option>
                <option value="inactividad">Inactividad prolongada</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            {/* Botones */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setDeactivateModalOpen(false)
                  setDeactivateReason('')
                }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={!deactivateReason}
                onClick={() => {
                  setIsActive(false)
                  setDeactivateModalOpen(false)
                  setDeactivateReason('')
                }}
              >
                Sí, desactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { sedeLabel } from '@/lib/sedes'
import { useMember } from '@/hooks/useMember'
import { PhoneInput } from '@/components/shared/PhoneInput'
import { useAuth } from '@/hooks/useAuth'

export default function EditarMiembroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { user } = useAuth()
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('direccion')

  const { member, loading } = useMember(id)

  // ── Estado del formulario ──────────────────────────────────────────────────
  const [firstName,             setFirstName]             = useState(member?.first_name ?? '')
  const [lastName,              setLastName]              = useState(member?.last_name ?? '')
  const [cedula,                setCedula]                = useState(member?.cedula ?? '')
  const [email,                 setEmail]                 = useState(member?.email ?? '')
  const [phone,                 setPhone]                 = useState(member?.phone ?? '')
  const [sede,                  setSede]                  = useState(member?.sede ?? '')
  const [isActive,              setIsActive]              = useState(member?.is_active ?? true)
  const [birthDate,             setBirthDate]             = useState(member?.birth_date ?? '')
  const [gender,                setGender]                = useState(member?.gender ?? 'otro')
  const [maritalStatus,         setMaritalStatus]         = useState(member?.marital_status ?? '')
  const [profession,            setProfession]            = useState(member?.occupation ?? '')
  const [workplace,             setWorkplace]             = useState(member?.workplace ?? '')
  const [address,               setAddress]               = useState(member?.address ?? '')
  const [province,              setProvince]              = useState(member?.province ?? '')
  const [canton,                setCanton]                = useState(member?.canton ?? '')
  const [district,              setDistrict]              = useState(member?.district ?? '')
  const [alergias,              setAlergias]              = useState(member?.allergies ?? '')
  const [medicamentos,          setMedicamentos]          = useState(member?.medicamentos ?? '')
  const [emergencyContactName,  setEmergencyContactName]  = useState(member?.emergency_contact_name ?? '')
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(member?.emergency_contact_phone ?? '')
  const [saving,                setSaving]                = useState(false)
  const [toast,                 setToast]                 = useState(false)

  // ── Modal desactivar ───────────────────────────────────────────────────────
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false)
  const [deactivateReason,    setDeactivateReason]    = useState('')

  // Poblar el formulario cuando carga el miembro (fetch async).
  useEffect(() => {
    if (!member) return
    setFirstName(member.first_name ?? '')
    setLastName(member.last_name ?? '')
    setCedula(member.cedula ?? '')
    setEmail(member.email ?? '')
    setPhone(member.phone ?? '')
    setSede(member.sede ?? '')
    setIsActive(member.is_active ?? true)
    setBirthDate(member.birth_date ?? '')
    setGender(member.gender ?? 'otro')
    setMaritalStatus(member.marital_status ?? '')
    setProfession(member.occupation ?? '')
    setWorkplace(member.workplace ?? '')
    setAddress(member.address ?? '')
    setProvince(member.province ?? '')
    setCanton(member.canton ?? '')
    setDistrict(member.district ?? '')
    setAlergias(member.allergies ?? '')
    setMedicamentos(member.medicamentos ?? '')
    setEmergencyContactName(member.emergency_contact_name ?? '')
    setEmergencyContactPhone(member.emergency_contact_phone ?? '')
  }, [member])

  if (!member) {
    return (
      <div className="page">
        <div className="ph">
          <div className="ptitle">Editar perfil</div>
        </div>
        <div className="card p-[22px]">
          <p className="text-sm text-navy-light/50 text-center py-8 font-body">
            {loading ? 'Cargando…' : 'Miembro no encontrado.'}
          </p>
        </div>
      </div>
    )
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      cedula: cedula.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      birth_date: birthDate || null,
      gender: gender || null,
      marital_status: maritalStatus || null,
      province: province || null,
      canton: canton || null,
      district: district || null,
      occupation: profession.trim() || null,
      workplace: workplace.trim() || null,
      address: address.trim() || null,
      allergies: alergias.trim() || null,
      medications: medicamentos.trim() || null,
      emergency_contact_name: emergencyContactName.trim() || null,
      emergency_contact_phone: emergencyContactPhone.trim() || null,
      is_active: isActive,
    }
    try {
      const res = await fetch(`/api/members/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Error guardando cambios')
      setSaving(false)
      setToast(true)
      setTimeout(() => {
        setToast(false)
        router.push(`/miembros/${id}`)
      }, 1500)
    } catch (e) {
      console.error(e)
      alert('No se pudieron guardar los cambios. Intentá de nuevo.')
      setSaving(false)
    }
  }

  return (
    <div className="page">

      {/* ── Header ── */}
      <div className="ph">
        <button
          className="btn btn-ghost btn-sm mb-[10px]"
          onClick={() => router.back()}
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
              <div className="flex items-center gap-2 mr-2">
                <span className="text-[12px] text-[var(--fg-muted)] font-body">
                  Estado:
                </span>
                <label
                  className="toggle cursor-pointer"
                  title={isActive ? 'Clic para desactivar este miembro' : 'Clic para activar este miembro'}
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
                <span
                  className="text-[12px] font-semibold font-body"
                  style={{ color: isActive ? 'var(--success)' : 'var(--fg-muted)' }}
                >
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
                ? <><Loader2 size={14} className="animate-spin inline mr-[6px]" />Guardando...</>
                : 'Guardar cambios'
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── Secciones ── */}
      <div className="flex flex-col gap-5 w-full">

        {/* ── Sección 1: Datos personales ── */}
        <div className="card">
          <div className="card-hd">
            <div className="card-title">Datos personales</div>
          </div>
          <div className="py-[18px] px-[22px] flex flex-col gap-[14px]">
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
                <input
                  id="edit-cedula"
                  className="form-input"
                  value={cedula}
                  onChange={e => setCedula(e.target.value)}
                  placeholder="Ej: 1-1234-5678"
                />
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
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="otro">Otro / Prefiero no indicar</option>
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
                  <option value="Unión libre">Unión libre</option>
                  {maritalStatus &&
                    !['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a', 'Unión libre'].includes(maritalStatus) && (
                      <option value={maritalStatus}>
                        {maritalStatus.charAt(0).toUpperCase() + maritalStatus.slice(1)}
                      </option>
                    )}
                </select>
              </div>
            </div>

            <div className="form-row">
              <PhoneInput
                label="Teléfono"
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
            </div>
          </div>
        </div>

        {/* ── Sección 2: Dirección ── */}
        <div className="card">
          <div className="card-hd">
            <div className="card-title">Dirección</div>
          </div>
          <div className="py-[18px] px-[22px] flex flex-col gap-[14px]">
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

            {/* Sede — calculada automáticamente por asistencia a charlas (no editable) */}
            <div className="form-group">
              <label className="form-label">Sede</label>
              <p className="text-sm text-navy-light/70 py-2 font-body">
                {sede ? sedeLabel(sede) : 'Sin sede asignada'}
              </p>
              <p className="text-[11px] text-navy-light/40 font-body">
                Se asigna automáticamente según la charla a la que más asiste.
              </p>
            </div>
          </div>
        </div>

        {/* ── Sección 3: Trabajo y ocupación ── */}
        <div className="card">
          <div className="card-hd">
            <div className="card-title">Trabajo y ocupación</div>
          </div>
          <div className="py-[18px] px-[22px]">
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

        {/* ── Sección 4: Contacto de emergencia y salud ── */}
        <div className="card">
          <div className="card-hd">
            <div className="card-title">Contacto de emergencia y salud</div>
          </div>
          <div className="py-[18px] px-[22px] flex flex-col gap-5">

            {/* Contacto de emergencia */}
            <div className="bg-[rgba(112,189,194,0.12)] border border-[rgba(112,189,194,0.30)] rounded-xl p-4">
              <p className="form-label mb-3">Contacto de emergencia</p>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-emergency-name">Nombre</label>
                  <input
                    id="edit-emergency-name"
                    className="form-input bg-white"
                    value={emergencyContactName}
                    onChange={e => setEmergencyContactName(e.target.value)}
                    placeholder="Nombre completo..."
                  />
                </div>
                <PhoneInput
                  label="Teléfono"
                  value={emergencyContactPhone}
                  onChange={setEmergencyContactPhone}
                />
              </div>
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
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm text-white bg-navy shadow-[0_12px_32px_rgba(22,20,64,0.20)] font-body"
        >
          <Check size={15} className="text-[#3DB97A] shrink-0" />
          Perfil actualizado exitosamente
        </div>
      )}

      {/* ── Modal desactivar ── */}
      {deactivateModalOpen && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,0.45)] z-[1000] flex items-center justify-center p-5">
          <div className="bg-surface-card rounded-[20px] p-7 max-w-[440px] w-full shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
            {/* Ícono de advertencia */}
            <div className="text-center mb-5">
              <div className="w-[52px] h-[52px] rounded-full bg-[rgba(239,85,84,.1)] flex items-center justify-center mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand-coral)" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h3 className="text-[16px] font-bold text-navy-light font-display">
                ¿Desactivar a {member.first_name} {member.last_name}?
              </h3>
              <p className="text-[13px] text-[var(--fg-muted)] mt-[6px] font-body">
                El perfil quedará inaccesible y la persona será removida de todos sus roles activos. El historial se conserva intacto.
              </p>
            </div>

            {/* Motivo obligatorio */}
            <div className="form-group mb-5">
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
            <div className="flex gap-2 justify-end">
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

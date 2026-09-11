'use client'

import { Phone, Mail, MapPin, User, Heart, Briefcase, Building, Lock, Cake } from 'lucide-react'
import type { Member } from '@/types/member'
import { formatDate } from '@/lib/format'
import { textoDeRestricciones } from '@/lib/members/restriccion-alimenticia'
import { puedeEditarColumna } from '@/lib/members/autoedicion'
import { OPCIONES_GENERO } from '@/lib/members/campo-editable'
import { CampoPerfilEditable } from '@/components/members/CampoPerfilEditable'
import { RestriccionAlimenticia } from '@/components/members/RestriccionAlimenticia'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/hooks/useAuth'

function calculateAge(dateStr: string): number {
  const birth = new Date(dateStr)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

/**
 * Una fila del perfil.
 *
 * ANTES: toda fila "editable" pintaba un lápiz que NO TENÍA onClick. Era
 * decorativo — la pantalla prometía una edición que no existía, y las filas que
 * sí importaban (salud) mostraban un candado. Ahora el lápiz aparece solo donde
 * de verdad se puede editar, y editar de verdad; donde no, va el candado.
 *
 * Quién puede qué lo decide puedeEditarColumna, que distingue staff de la propia
 * persona. Preguntarlo por columna y no "¿es editable?" en abstracto es
 * justamente lo que evita volver a ofrecer algo que el servidor rechaza.
 */
function Fila({
  icon, label, value, columna, tipo = 'texto', opciones, memberId, puedeEditar, onGuardado,
}: {
  icon: React.ReactNode
  label: string
  value: string
  /** Sin columna, la fila es de solo lectura (un dato calculado, por ejemplo). */
  columna?: string
  tipo?: 'texto' | 'telefono' | 'parrafo' | 'fecha' | 'seleccion'
  opciones?: ReadonlyArray<{ valor: string; etiqueta: string }>
  memberId: string
  puedeEditar: boolean
  onGuardado?: (columna: string, valor: string) => void
}) {
  const editable = !!columna && puedeEditar
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="mt-0.5 text-navy-light/80 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        {editable ? (
          <CampoPerfilEditable
            etiqueta={label}
            valor={value || '—'}
            memberId={memberId}
            columna={columna!}
            tipo={tipo}
            opciones={opciones}
            onGuardado={onGuardado}
          />
        ) : (
          <>
            <p className="text-[11px] uppercase tracking-wider text-navy-light/80 mb-0.5 font-display">
              {label}
            </p>
            <p className="text-sm text-navy font-body">{value || '—'}</p>
          </>
        )}
      </div>
      {!editable && (
        <div className="rounded-lg p-1.5 text-navy-light/80" title="Este dato no se edita desde acá">
          <Lock size={13} strokeWidth={1.75} aria-hidden />
        </div>
      )}
    </div>
  )
}

type Props = {
  member: Member
  /** Recarga la ficha. El encabezado y las otras pestañas leen el mismo objeto,
   *  así que un dato corregido acá tiene que refrescarlas: sin esto la pantalla
   *  seguía mostrando el valor viejo y parecía que el guardado había fallado. */
  onActualizado?: () => void
}

export function MemberPersonalTab({ member, onActualizado }: Props) {
  const { can } = usePermissions()
  const { user } = useAuth()
  // Los dos casos que el PATCH de /api/members/[id] ya acepta: staff de padrón
  // sobre cualquier ficha, o la persona sobre la suya.
  const ctx = {
    esStaff: can('miembros', 'edit'),
    esPropia: user?.member_id === member.id,
    tieneDocumento: !!member.cedula?.trim(),
  }
  const edita = (columna: string) => puedeEditarColumna(columna, ctx)
  const comun = { memberId: member.id, onGuardado: () => onActualizado?.() }

  return (
    <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
      <div className="mb-4 pb-4 border-b border-[var(--outline-variant)]">
        {/* El nombre va en DOS filas y no en una de "nombre completo": son dos
            columnas distintas, y un solo campo obligaría a adivinar dónde parte
            un apellido compuesto. */}
        <Fila {...comun} icon={<User size={15} strokeWidth={1.75} />} label="Nombre"
          value={member.first_name} columna="first_name" puedeEditar={edita('first_name')} />
        <Fila {...comun} icon={<User size={15} strokeWidth={1.75} />} label="Apellidos"
          value={member.last_name} columna="last_name" puedeEditar={edita('last_name')} />
        <Fila {...comun} icon={<Lock size={15} strokeWidth={1.75} />} label="Cédula"
          value={member.cedula ?? 'Sin cédula'} columna="cedula" puedeEditar={edita('cedula')} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-navy-light/80 mb-3 font-display">Contacto</p>
          <Fila {...comun} icon={<Phone size={15} strokeWidth={1.75} />} label="Teléfono"
            value={member.phone ?? '—'} columna="phone" tipo="telefono" puedeEditar={edita('phone')} />
          <Fila {...comun} icon={<Mail size={15} strokeWidth={1.75} />} label="Correo"
            value={member.email ?? '—'} columna="email" puedeEditar={edita('email')} />
          <Fila {...comun} icon={<MapPin size={15} strokeWidth={1.75} />} label="Dirección"
            value={member.address ?? '—'} columna="address" tipo="parrafo" puedeEditar={edita('address')} />
          <Fila {...comun} icon={<Phone size={15} strokeWidth={1.75} />} label="Contacto de emergencia"
            value={member.emergency_contact_name ?? '—'} columna="emergency_contact_name"
            puedeEditar={edita('emergency_contact_name')} />
          <Fila {...comun} icon={<Phone size={15} strokeWidth={1.75} />} label="Teléfono de emergencia"
            value={member.emergency_contact_phone ?? '—'} columna="emergency_contact_phone" tipo="telefono"
            puedeEditar={edita('emergency_contact_phone')} />
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wider text-navy-light/80 mb-3 font-display">Datos personales</p>
          {/* La EDAD es un cálculo y no se edita: se edita la fecha, y la edad se
              recalcula sola. Por eso la fila dice "Fecha de nacimiento" y muestra
              los años al lado, en vez de fingir que la edad es el dato. */}
          <Fila {...comun} icon={<Cake size={15} strokeWidth={1.75} />} label="Fecha de nacimiento"
            value={member.birth_date ?? ''} columna="birth_date" tipo="fecha"
            puedeEditar={edita('birth_date')} />
          {member.birth_date && (
            <p className="-mt-2 mb-1 ml-[27px] text-[11px] text-navy-light/80 font-body">
              {calculateAge(member.birth_date)} años · {formatDate(member.birth_date)}
            </p>
          )}
          <Fila {...comun} icon={<User size={15} strokeWidth={1.75} />} label="Género"
            value={member.gender ?? ''} columna="gender" tipo="seleccion" opciones={OPCIONES_GENERO}
            puedeEditar={edita('gender')} />
          <Fila {...comun} icon={<Heart size={15} strokeWidth={1.75} />} label="Estado civil"
            value={member.marital_status ?? '—'} columna="marital_status"
            puedeEditar={edita('marital_status')} />
          <Fila {...comun} icon={<Briefcase size={15} strokeWidth={1.75} />} label="Profesión"
            value={member.occupation ?? '—'} columna="occupation" puedeEditar={edita('occupation')} />
          <Fila {...comun} icon={<Building size={15} strokeWidth={1.75} />} label="Lugar de trabajo"
            value={member.workplace ?? '—'} columna="workplace" puedeEditar={edita('workplace')} />
        </div>
      </div>

      {/* Salud — SIEMPRE visible, aunque esté vacía. Antes el bloque solo se
          pintaba si ya había algo, y desaparecía justo para quien no tenía nada
          registrado: parecía que el campo se había eliminado (reportado
          2026-09-10). Un dato de salud en blanco no es un dato ausente. */}
      <div className="mt-4 pt-4 border-t border-[var(--outline-variant)]">
        <p className="text-[11px] uppercase tracking-wider text-navy-light/80 mb-3 font-display">Salud</p>
        <Fila {...comun} icon={<Lock size={15} strokeWidth={1.75} />} label="Alergias"
          value={member.allergies ?? '—'} columna="allergies" tipo="parrafo"
          puedeEditar={edita('allergies')} />
        <Fila {...comun} icon={<Lock size={15} strokeWidth={1.75} />} label="Medicamentos"
          value={member.medicamentos ?? '—'} columna="medications" tipo="parrafo"
          puedeEditar={edita('medications')} />
        <div className="flex items-start gap-3 py-2.5">
          <div className="mt-0.5 text-navy-light/80 shrink-0"><Lock size={15} strokeWidth={1.75} /></div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-navy-light/80 mb-1.5 font-display">
              Restricción alimenticia
            </p>
            {edita('dietary_restrictions') ? (
              <RestriccionAlimenticia valores={member.dietary_restrictions ?? []} memberId={member.id} />
            ) : (
              <p className="text-sm text-navy font-body">
                {textoDeRestricciones(member.dietary_restrictions)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

import { Plus, X } from 'lucide-react'
import { inputCls, Toggle, FieldLabel } from './shared'
import { RegistrationFormPicker } from '@/components/events/RegistrationFormPicker'
import { EventSurveyFields, type SurveyFieldsValue } from '@/components/events/EventSurveyFields'

type SubEventInput = { id: string; name: string; max_capacity: string }

interface Step3Props {
  sub_events: SubEventInput[]
  showSubEventForm: boolean
  newSubName: string
  newSubCap: string
  requires_registration: boolean
  max_capacity: string
  has_satisfaction_survey: boolean
  onSetShowSubEventForm: (v: boolean) => void
  onNewSubNameChange: (v: string) => void
  onNewSubCapChange: (v: string) => void
  onAddSubEvent: () => void
  onRemoveSubEvent: (id: string) => void
  onToggleRegistration: () => void
  onMaxCapacityChange: (v: string) => void
  onToggleSatisfactionSurvey: () => void
  /** EVE-4 · Formulario de inscripción del evento (null = sin formulario). */
  registration_form_id: string | null
  onRegistrationFormChange: (id: string | null) => void
  /** EVE-4 · Programación de la encuesta. */
  survey: SurveyFieldsValue
  onSurveyChange: (patch: Partial<SurveyFieldsValue>) => void
  /** Fin del evento (ISO) para calcular el momento del envío. */
  endsAt: string | null
}

export function Step3SubEventos({
  sub_events,
  showSubEventForm,
  newSubName,
  newSubCap,
  requires_registration,
  max_capacity,
  has_satisfaction_survey,
  onSetShowSubEventForm,
  onNewSubNameChange,
  onNewSubCapChange,
  onAddSubEvent,
  onRemoveSubEvent,
  onToggleRegistration,
  onMaxCapacityChange,
  onToggleSatisfactionSurvey,
  registration_form_id,
  onRegistrationFormChange,
  survey,
  onSurveyChange,
  endsAt,
}: Step3Props) {
  return (
    <div className="space-y-4">
      {/* Sub-eventos */}
      <div className="card py-5 px-6 w-full">
        <div className="card-title mb-4">Sub-eventos</div>

        {sub_events.length > 0 && (
          <div className="space-y-2 mb-3">
            {sub_events.map(se => (
              <div
                key={se.id}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 bg-surface-low"
              >
                <div>
                  <p
                    className="text-sm font-medium text-navy font-body"
                  >
                    {se.name}
                  </p>
                  <p className="text-[13px] text-navy-light/80">Cap. {se.max_capacity}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveSubEvent(se.id)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-navy-light/80 hover:text-coral hover:bg-coral/10 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {showSubEventForm ? (
          <div
            className="rounded-xl border border-[var(--outline-variant)] p-3 space-y-2"
          >
            <div className="form-row">
              <input
                className={`${inputCls} font-body`}
                placeholder="Nombre del sub-evento"
                value={newSubName}
                onChange={e => onNewSubNameChange(e.target.value)}
                autoFocus
              />
              <input
                type="number"
                className={`${inputCls} font-body`}
                placeholder="Capacidad"
                value={newSubCap}
                onChange={e => onNewSubCapChange(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onAddSubEvent}
                className="btn btn-primary btn-sm"
              >
                Agregar
              </button>
              <button
                type="button"
                onClick={() => onSetShowSubEventForm(false)}
                className="btn btn-ghost btn-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onSetShowSubEventForm(true)}
            className="btn btn-ghost btn-sm"
          >
            <Plus size={13} />
            Añadir sub-evento
          </button>
        )}

        {sub_events.length === 0 && !showSubEventForm && (
          <p
            className="text-[13px] text-navy-light/80 mt-2 font-body"
          >
            Opcional. Agrega divisiones como Kids, Teens o sesiones por día.
          </p>
        )}
      </div>

      {/* Inscripción */}
      <div className="card py-5 px-6 w-full">
        <div className="card-title mb-4">Inscripciones</div>
        <div className="space-y-4">
          <Toggle
            checked={requires_registration}
            onToggle={onToggleRegistration}
            label="Requiere inscripción previa"
          />
          {requires_registration && (
            <div className="space-y-3 pl-14">
              <div className="form-row">
                <div>
                  <FieldLabel>Capacidad máxima</FieldLabel>
                  <input
                    type="number"
                    className={`${inputCls} font-body`}
                    placeholder="100"
                    value={max_capacity}
                    onChange={e => onMaxCapacityChange(e.target.value)}
                  />
                </div>
                {/* "Prerrequisito" se quitó: los eventos no tienen ese campo en
                    la BD y el valor se descartaba en silencio al publicar. */}
              </div>
              {/* EVE-4 · Formulario de inscripción. La inscripción sigue
                  siendo event_registrations (cupo, pago, check-in): esto se
                  llena además y queda enlazado a ella. */}
              <RegistrationFormPicker
                value={registration_form_id}
                onChange={onRegistrationFormChange}
              />
            </div>
          )}
        </div>
      </div>

      {/* Encuesta */}
      <div className="card py-5 px-6 w-full">
        <div className="card-title mb-4">Encuesta de satisfacción</div>
        <div className="space-y-4">
          <Toggle
            checked={has_satisfaction_survey}
            onToggle={onToggleSatisfactionSurvey}
            label="Enviar encuesta al finalizar el evento"
          />
          {has_satisfaction_survey && (
            <EventSurveyFields value={survey} onChange={onSurveyChange} endsAt={endsAt} />
          )}
        </div>
      </div>
    </div>
  )
}

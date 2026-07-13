import { Plus, X } from 'lucide-react'
import { inputCls, Toggle, FieldLabel } from './shared'

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
                  <p className="text-[11px] text-navy-light/60">Cap. {se.max_capacity}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveSubEvent(se.id)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-navy-light/60 hover:text-coral hover:bg-coral/10 transition-colors"
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
            className="text-[12px] text-navy-light/60 mt-2 font-body"
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
              <a
                href="/formularios/nuevo"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
                title="Abre el builder de formularios en otra pestaña (el wizard conserva tu avance)"
              >
                <Plus size={13} />
                Crear formulario de inscripción
              </a>
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
            <div className="pl-14">
              <a
                href="/formularios/nuevo"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
                title="Abre el builder de formularios en otra pestaña (el wizard conserva tu avance)"
              >
                <Plus size={13} />
                Crear encuesta
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

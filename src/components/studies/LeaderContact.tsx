// GRU-3 · Contacto del dirigente (y del co-dirigente) en el detalle del grupo.
//
// DATOS PERSONALES: esto solo se pinta para quien gestiona el grupo. El API ya
// los borra del payload para el resto (viewer_scope 'member'/'none'), así que
// acá no llega nada que mostrar — pero el componente igual no asume: sin
// teléfono ni correo, no dibuja la fila.
import { Phone, Mail, MessageCircle } from 'lucide-react'
import { waLink } from '@/lib/phone'

type Persona = {
  rol: string
  nombre: string | null
  phone?: string | null
  email?: string | null
}

export function LeaderContact({ personas }: { personas: Persona[] }) {
  const conDatos = personas.filter(p => p.nombre && (p.phone || p.email))
  if (conDatos.length === 0) return null

  return (
    <div className="space-y-1.5">
      {conDatos.map(p => (
        <div key={p.rol} className="flex items-center gap-2 flex-wrap text-[13px] font-body">
          <span className="text-navy-light/70">{p.rol}:</span>
          <span className="text-navy font-medium">{p.nombre}</span>
          {p.phone && (
            <>
              <a
                href={`tel:${p.phone.replace(/[^\d+]/g, '')}`}
                className="inline-flex items-center gap-1 text-navy-light hover:text-navy transition-colors"
                title={`Llamar a ${p.nombre}`}
              >
                <Phone size={12} /> {p.phone}
              </a>
              <a
                href={waLink(p.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-teal-deep hover:underline"
                title={`Escribirle a ${p.nombre} por WhatsApp`}
              >
                <MessageCircle size={12} /> WhatsApp
              </a>
            </>
          )}
          {p.email && (
            <a
              href={`mailto:${p.email}`}
              className="inline-flex items-center gap-1 text-navy-light hover:text-navy transition-colors break-all"
              title={`Escribirle a ${p.nombre}`}
            >
              <Mail size={12} /> {p.email}
            </a>
          )}
        </div>
      ))}
    </div>
  )
}

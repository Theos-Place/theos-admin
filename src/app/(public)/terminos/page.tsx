// NOTA: Este contenido es un borrador base y DEBE ser revisado por un abogado antes
// de considerarse definitivo, especialmente las secciones de datos personales
// (Sección 4) y datos de menores de edad (Sección 5).
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { PageContainer } from '@/components/layout/PageContainer'

export const metadata: Metadata = {
  title: 'Términos y Condiciones y Política de Privacidad · Theos Place',
  description: 'Términos y Condiciones y Política de Privacidad de Theos.',
}

// Fecha de última actualización (versión vigente). Actualizar al cambiar el contenido.
const LAST_UPDATED = '1 de julio de 2026'

const SECTIONS: { id: string; title: string }[] = [
  { id: 'introduccion', title: '1. Introducción y aceptación' },
  { id: 'uso', title: '2. Uso del sistema' },
  { id: 'cuentas', title: '3. Cuentas y acceso' },
  { id: 'privacidad', title: '4. Política de Privacidad y tratamiento de datos' },
  { id: 'menores', title: '5. Datos de personas menores de edad' },
  { id: 'comunicaciones', title: '6. Comunicaciones' },
  { id: 'propiedad', title: '7. Propiedad intelectual' },
  { id: 'disponibilidad', title: '8. Disponibilidad y limitación de responsabilidad' },
  { id: 'cambios', title: '9. Cambios a estos términos' },
  { id: 'contacto', title: '10. Contacto' },
]

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      {/* Barra superior con logo */}
      <header className="border-b border-[var(--outline-variant)] bg-surface-card">
        <PageContainer width="reading" className="px-5 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center" aria-label="Theos Place — inicio">
            <Image
              src="/logo-theos-original.png"
              alt="Theos Place"
              width={661}
              height={337}
              priority
              className="h-9 w-auto"
            />
          </Link>
          <Link href="/login" className="text-[13px] text-navy-light/60 hover:text-navy transition-colors font-body">
            Ingresar →
          </Link>
        </PageContainer>
      </header>

      <main><PageContainer width="reading" className="px-5 py-8 sm:py-12">
        {/* Título */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy font-display tracking-[-0.02em] leading-tight">
          Términos y Condiciones y Política de Privacidad
        </h1>
        <p className="mt-2 text-sm text-navy-light/70 font-body">Theos</p>
        <p className="mt-1 text-[13px] text-navy-light/60 font-body">
          Última actualización: {LAST_UPDATED}
        </p>

        {/* Nota de vigencia (discreta, de cara al público) */}
        <div className="mt-5 rounded-2xl bg-teal-soft/20 px-4 py-3 text-[13px] text-teal-deep/90 font-body leading-relaxed">
          Este documento puede actualizarse periódicamente. La fecha de última
          actualización indicada arriba refleja la versión vigente. Te recomendamos
          revisarlo de vez en cuando.
        </div>

        {/* Índice */}
        <nav aria-label="Contenido" className="mt-6 rounded-2xl bg-surface-card shadow-[var(--shadow-sm)] p-5">
          <p className="text-[10px] uppercase tracking-widest text-navy-light/60 font-display mb-3">Contenido</p>
          <ol className="space-y-1.5">
            {SECTIONS.map(s => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-[14px] text-navy-light hover:text-coral transition-colors font-body">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Cuerpo */}
        <article className="mt-8 space-y-10 font-body text-[15px] leading-relaxed text-navy-light/80 [&_h2]:scroll-mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-navy [&_h2]:font-display [&_h2]:tracking-[-0.01em] [&_h3]:font-semibold [&_h3]:text-navy [&_h3]:mt-4 [&_h3]:mb-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:space-y-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-coral [&_a]:font-medium hover:[&_a]:underline">

          <section id="introduccion">
            <h2>1. Introducción y aceptación</h2>
            <p>
              Este documento regula el uso del sistema de gestión de <strong className="text-navy">Theos</strong>
              {' '}(en adelante, «Theos» o «el sistema»). El acceso y uso del sistema implican la aceptación plena
              de estos Términos y Condiciones y de la Política de Privacidad aquí descrita. Si no estás de acuerdo
              con ellos, no debés utilizar el sistema.
            </p>
            <p>
              El responsable del sistema y del tratamiento de los datos personales es Theos,
              a quien podés contactar en <a href="mailto:soporte@theosplace.org">soporte@theosplace.org</a>.
            </p>
          </section>

          <section id="uso">
            <h2>2. Uso del sistema</h2>
            <p>
              El sistema es una herramienta interna para la gestión de la membresía, los estudios, los eventos
              y las actividades de Theos. Al usarlo, te comprometés a:
            </p>
            <ul>
              <li>Utilizar el sistema de buena fe y para los fines propios de Theos.</li>
              <li>No compartir tus credenciales de acceso con terceros.</li>
              <li>No intentar accesos no autorizados, ni vulnerar la seguridad del sistema o de otras cuentas.</li>
              <li>
                Mantener la confidencialidad de la información de otros miembros a la que tengas acceso en razón
                de tu rol, y usarla únicamente para las funciones que te corresponden.
              </li>
            </ul>
            <p>
              El uso indebido del sistema o de la información puede conllevar la suspensión del acceso y las
              acciones que correspondan.
            </p>
          </section>

          <section id="cuentas">
            <h2>3. Cuentas y acceso</h2>
            <p>
              Cada persona usuaria es responsable de la actividad realizada desde su cuenta. Debés resguardar tu
              contraseña, elegir una contraseña segura y notificar de inmediato a Theos ante cualquier uso
              no autorizado o sospecha de compromiso de tu cuenta, escribiendo a{' '}
              <a href="mailto:soporte@theosplace.org">soporte@theosplace.org</a>.
            </p>
          </section>

          <section id="privacidad">
            <h2>4. Política de Privacidad y tratamiento de datos personales</h2>
            <p>
              Theos trata datos personales conforme a la <strong className="text-navy">Ley N.° 8968,
              Ley de Protección de la Persona frente al tratamiento de sus datos personales</strong> de Costa
              Rica, y su reglamento.
            </p>

            <h3>Datos que se recopilan</h3>
            <ul>
              <li>Datos de contacto e identificación (por ejemplo: nombre, cédula, correo, teléfono, dirección).</li>
              <li>Datos de membresía (estado, fechas, roles y participación en la comunidad).</li>
              <li>Datos de participación en estudios, grupos, eventos y servicio.</li>
              <li>
                Datos sensibles, como información espiritual o religiosa (por ejemplo, participación en estudios
                bíblicos), que reciben protección reforzada y se tratan con base en tu consentimiento.
              </li>
            </ul>

            <h3>Finalidad del tratamiento</h3>
            <ul>
              <li>Gestionar la membresía y el vínculo de las personas con Theos.</li>
              <li>Comunicar información relevante sobre actividades, estudios y eventos.</li>
              <li>Organizar y coordinar estudios, grupos, eventos y el servicio voluntario.</li>
            </ul>

            <h3>Base legal y consentimiento</h3>
            <p>
              El tratamiento se fundamenta en el consentimiento de la persona titular y en el interés legítimo de
              Theos para gestionar su membresía y actividades. Para los datos sensibles se requiere
              consentimiento informado, que podés retirar en cualquier momento.
            </p>

            <h3>Con quién se comparte</h3>
            <p>
              Theos <strong className="text-navy">no vende ni cede tus datos a terceros</strong> con
              fines comerciales. Los datos pueden ser procesados por proveedores de servicios tecnológicos
              (por ejemplo, alojamiento del sistema y envío de correos) que actúan por cuenta de Theos
              y bajo obligaciones de confidencialidad y seguridad.
            </p>

            <h3>Tus derechos (acceso, rectificación, actualización y eliminación)</h3>
            <p>
              Como titular de los datos, tenés derecho a acceder a tu información, rectificarla, actualizarla y
              solicitar su eliminación, así como a retirar tu consentimiento, conforme a la Ley N.° 8968.
              Para ejercer estos derechos, escribí a{' '}
              <a href="mailto:soporte@theosplace.org">soporte@theosplace.org</a>. Atenderemos tu solicitud en los
              plazos que establece la normativa aplicable.
            </p>

            <h3>Seguridad de los datos</h3>
            <p>
              Theos adopta medidas técnicas y organizativas razonables para proteger los datos personales
              frente a accesos no autorizados, pérdida o alteración. Ningún sistema es completamente infalible,
              pero trabajamos para mantener niveles de seguridad adecuados.
            </p>
          </section>

          <section id="menores">
            <h2>5. Datos de personas menores de edad</h2>
            <p>
              El sistema puede contener datos de personas menores de edad, que se tratan con base en el
              consentimiento de sus padres, madres o representantes legales.
            </p>
            <ul>
              <li>
                Los datos de menores reciben <strong className="text-navy">protección especial</strong> y se
                utilizan únicamente para los fines de la membresía y las actividades de Theos.
              </li>
              <li>
                Los padres, madres o representantes legales pueden solicitar el acceso, la rectificación o la
                eliminación de los datos de las personas menores a su cargo, escribiendo a{' '}
                <a href="mailto:soporte@theosplace.org">soporte@theosplace.org</a>.
              </li>
            </ul>
          </section>

          <section id="comunicaciones">
            <h2>6. Comunicaciones</h2>
            <p>
              Theos puede enviarte dos tipos de comunicaciones:
            </p>
            <ul>
              <li>
                <strong className="text-navy">Transaccionales</strong>: necesarias para el funcionamiento del
                sistema y tu membresía (por ejemplo, activación de cuenta, recuperación de contraseña o avisos
                importantes). Estas no requieren consentimiento adicional.
              </li>
              <li>
                <strong className="text-navy">Informativas o de difusión</strong>: sobre actividades, estudios y
                eventos, que se envían con tu consentimiento.
              </li>
            </ul>
            <p>
              Podés cancelar en cualquier momento la suscripción a las comunicaciones no esenciales mediante el
              enlace incluido en cada correo o escribiendo a{' '}
              <a href="mailto:soporte@theosplace.org">soporte@theosplace.org</a>. Las comunicaciones transaccionales
              se mantienen mientras exista tu cuenta.
            </p>
          </section>

          <section id="propiedad">
            <h2>7. Propiedad intelectual</h2>
            <p>
              El sistema, su software, su diseño, la marca «Theos» y los contenidos propios de Theos son de
              su titularidad o de sus licenciantes. El acceso al
              sistema no transfiere ningún derecho sobre ellos; queda prohibida su copia, distribución,
              modificación o ingeniería inversa sin autorización. La información que cada persona registra en
              el sistema sigue siendo suya, conforme a la Política de Privacidad de la Sección 4.
            </p>
          </section>

          <section id="disponibilidad">
            <h2>8. Disponibilidad y limitación de responsabilidad</h2>
            <p>
              El sistema se ofrece «tal cual» y «según disponibilidad». Theos procura mantenerlo
              operativo y seguro, pero no garantiza que esté disponible de forma ininterrumpida ni libre de
              errores. En la medida permitida por la ley, Theos no será responsable por daños
              indirectos o incidentales derivados del uso o la imposibilidad de uso del sistema. Nada en esta
              sección limita los derechos que la legislación de Costa Rica reconoce a la persona titular de los
              datos.
            </p>
          </section>

          <section id="cambios">
            <h2>9. Cambios a estos términos</h2>
            <p>
              Theos puede actualizar estos Términos y Condiciones y esta Política de Privacidad cuando sea
              necesario. La fecha de última actualización, indicada al inicio de esta página, refleja la versión
              vigente. El uso continuado del sistema tras una actualización implica la aceptación de la versión
              vigente.
            </p>
          </section>

          <section id="contacto">
            <h2>10. Contacto</h2>
            <p>
              Para consultas sobre estos términos, sobre el tratamiento de tus datos o para ejercer tus derechos,
              contactá a:
            </p>
            <p className="mt-2 text-navy">
              <strong>Theos</strong><br />
              <a href="mailto:soporte@theosplace.org">soporte@theosplace.org</a>
            </p>
          </section>
        </article>

        {/* Pie */}
        <footer className="mt-12 border-t border-[var(--outline-variant)] pt-6 text-[13px] text-navy-light/60 font-body flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} Theos</span>
          <Link href="/login" className="hover:text-navy transition-colors">Volver a ingresar</Link>
        </footer>
      </PageContainer></main>
    </div>
  )
}

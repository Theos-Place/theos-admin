import { getAuthContext } from '@/lib/auth/guard'
import { getHelpIndex } from '@/lib/help/loader'
import { HelpIndex } from '@/components/help/HelpIndex'

// Índice del centro de ayuda. El filtrado pasa en el SERVIDOR: getHelpIndex solo
// devuelve lo que esta sesión (o la falta de sesión) puede leer.
export default async function AyudaPage() {
  const ctx = await getAuthContext()
  const docs = await getHelpIndex(ctx?.roles ?? null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">
          Centro de ayuda
        </h1>
        <p className="mt-1 max-w-2xl text-[15px] text-navy-light/80 font-body leading-relaxed">
          {ctx
            ? 'Las guías de los procesos que podés hacer con tu cuenta.'
            : 'Guías para entrar al sistema, matricularte y hacer tus trámites. Al iniciar sesión vas a ver además las guías de lo que te toca hacer.'}
        </p>
      </div>

      <HelpIndex docs={docs} />

      <p className="text-[13px] text-navy-light/80 font-body">
        ¿No encontrás lo que buscás? Escribinos a{' '}
        <a href="mailto:soporte@theosplace.org" className="text-teal-deep underline">
          soporte@theosplace.org
        </a>
        .
      </p>
    </div>
  )
}

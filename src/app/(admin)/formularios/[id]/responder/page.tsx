'use client'

// Llenado REAL de un formulario. Es la ruta a la que apuntan las convocatorias
// por correo, así que la abre CUALQUIER sesión autenticada (excepción en el
// ModuleGuard del layout: /formularios exige el módulo, que solo tienen
// dirección y admin — antes un miembro no podía responder ningún formulario).
import { useParams } from 'next/navigation'
import { FormFiller } from '@/components/forms/FormFiller'

export default function ResponderFormularioPage() {
  const { id } = useParams<{ id: string }>()
  return <FormFiller formId={id} mode="fill" />
}

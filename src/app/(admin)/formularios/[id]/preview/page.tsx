'use client'

// Vista previa del builder: misma pantalla de llenado, en modo preview (banner,
// datos de perfil de ejemplo y sin guardar respuestas).
import { useParams } from 'next/navigation'
import { FormFiller } from '@/components/forms/FormFiller'

export default function FormPreviewPage() {
  const { id } = useParams<{ id: string }>()
  return <FormFiller formId={id} mode="preview" />
}

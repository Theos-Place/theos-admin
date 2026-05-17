'use client'

import { useParams } from 'next/navigation'
import { FormBuilder } from '../_components/FormBuilder'

export default function EditarFormularioPage() {
  const { id } = useParams<{ id: string }>()
  return <FormBuilder formId={id} />
}

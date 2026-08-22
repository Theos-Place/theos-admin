// AUD-1 · Vincular el error de un campo con su input.
//
// EL PROBLEMA. Los formularios pintan el mensaje de error debajo del campo (bien,
// y no dependen solo del color), pero el `<input>` no queda marcado como inválido
// ni apunta al mensaje. Medido el 2026-08-21: 20 `role="alert"` en el código
// contra 5 `aria-invalid` y 2 `aria-describedby`. O sea que el error existe en la
// pantalla y no en el recorrido del campo: quien usa lector de pantalla tabula al
// input, escucha su label, y nada le dice que está en error ni cuál es.
//
// POR QUÉ UNA FUNCIÓN Y NO UN COMPONENTE `<Field>`. Hay más de 20 formularios ya
// escritos, cada uno con su markup y sus clases. Un componente obligaría a
// reescribirlos para adoptarlo, y lo que no se adopta no arregla nada. Esto entra
// en dos líneas sin tocar el resto:
//
//   const a11y = fieldA11y('cedula', error, { required: true })
//   <label htmlFor={a11y.labelFor}>Cédula</label>
//   <input {...a11y.input} … />
//   {error && <p {...a11y.error}>{error}</p>}

export type FieldA11y = {
  /** Va al input / select / textarea. */
  input: {
    id: string
    'aria-invalid': true | undefined
    'aria-describedby': string | undefined
    'aria-required': true | undefined
  }
  /** Va al elemento que muestra el mensaje. */
  error: {
    id: string
    role: 'alert'
  }
  /** Para el `htmlFor` del label. */
  labelFor: string
}

/**
 * Los atributos de accesibilidad de un campo.
 *
 * `name` tiene que ser único en la pantalla: es lo que ata label → input → error.
 *
 * Los aria van en `undefined` cuando no hay error, no en `false` ni en `''`: un
 * `aria-invalid="false"` es válido pero ruidoso, y un `aria-describedby` que
 * apunta a un elemento inexistente hace que algunos lectores anuncien vacío.
 */
export function fieldA11y(
  name: string,
  error?: string | null,
  opts: { required?: boolean; id?: string } = {},
): FieldA11y {
  // `opts.id` respeta un id que ya existe en la pantalla. Importa: cambiar el id
  // de un input de login rompe el autocompletado del navegador y del gestor de
  // contraseñas, que se acuerdan del campo por su id.
  const id = opts.id ?? `f-${name}`
  const errorId = `${id}-error`
  const hayError = !!error?.trim()
  return {
    input: {
      id,
      'aria-invalid': hayError ? true : undefined,
      'aria-describedby': hayError ? errorId : undefined,
      'aria-required': opts.required ? true : undefined,
    },
    error: { id: errorId, role: 'alert' },
    labelFor: id,
  }
}

-- Menores con datos protegidos (EVE-12).
--
-- En España no se puede pedir información protegida de un menor. Su ficha
-- guarda SOLO nombre y fecha de nacimiento, y no tiene cuenta de acceso.
--
-- La marca vive en la BASE y no solo en el código porque de ella dependen dos
-- cosas que no se pueden dejar a que alguien se acuerde: que la ficha no
-- acumule datos y que nunca se le cree un usuario.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS datos_protegidos boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.members.datos_protegidos IS
  'Menor con datos protegidos (EVE-12): solo nombre y fecha de nacimiento, sin cuenta de acceso. Su ficha cuelga de la familia.';

-- Una ficha protegida NO puede tener correo, teléfono ni documento. El CHECK va
-- en la base porque el camino del check-in no es el único que escribe en
-- members: un import o un script futuro también tendrían que respetarlo, y a
-- esos no los cubre ninguna validación de la app.
ALTER TABLE public.members
  DROP CONSTRAINT IF EXISTS members_datos_protegidos_sin_contacto;
ALTER TABLE public.members
  ADD CONSTRAINT members_datos_protegidos_sin_contacto CHECK (
    NOT datos_protegidos OR (
      email IS NULL AND phone IS NULL AND cedula IS NULL AND auth_user_id IS NULL
    )
  );

-- Y tampoco puede ser mayor de edad: la marca existe para menores.
ALTER TABLE public.members
  DROP CONSTRAINT IF EXISTS members_datos_protegidos_con_fecha;
ALTER TABLE public.members
  ADD CONSTRAINT members_datos_protegidos_con_fecha CHECK (
    NOT datos_protegidos OR birth_date IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS members_datos_protegidos_idx
  ON public.members (datos_protegidos) WHERE datos_protegidos;

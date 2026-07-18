-- 034: Corrige los nombres de rol en las políticas RLS. Las políticas (010)
-- referenciaban roles en inglés/abreviados que NO existen en member_roles.role
-- (los reales están en español). Sin esto, esos roles nunca matchean.
-- Mapeo: staff_leader→encargado_staff, editor_profiles→editor_perfiles,
-- committee_leader→lider_comite, comms→comunicaciones, director→direccion,
-- finance→finanzas. (admin y direccion ya eran correctos.)

DO $do$
DECLARE
  r record;
  q text;
  wc text;
  pat text := '''staff_leader''::text|''editor_profiles''::text|''committee_leader''::text|''comms''::text|''director''::text|''finance''::text';
  fix text;
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (COALESCE(qual,'') || COALESCE(with_check,'')) ~ pat
  LOOP
    q  := r.qual;
    wc := r.with_check;
    FOR fix IN SELECT unnest(ARRAY[
      'staff_leader=>encargado_staff','editor_profiles=>editor_perfiles',
      'committee_leader=>lider_comite','comms=>comunicaciones',
      'director=>direccion','finance=>finanzas'
    ]) LOOP
      q  := replace(q,  '''' || split_part(fix,'=>',1) || '''::text', '''' || split_part(fix,'=>',2) || '''::text');
      wc := replace(wc, '''' || split_part(fix,'=>',1) || '''::text', '''' || split_part(fix,'=>',2) || '''::text');
    END LOOP;
    IF r.qual IS NOT NULL AND r.with_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)', r.policyname, r.tablename, q, wc);
    ELSIF r.qual IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)', r.policyname, r.tablename, q);
    ELSE
      EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)', r.policyname, r.tablename, wc);
    END IF;
  END LOOP;
END
$do$;

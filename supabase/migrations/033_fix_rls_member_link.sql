-- 033: Arregla el bug de las políticas RLS. Las políticas (009/010) comparaban
-- member_roles.member_id = auth.uid(), pero member_id referencia members.id, NO
-- auth.users.id. El enlace correcto es members.auth_user_id = auth.uid().
-- Sin esto, ninguna política de admin/rol evalúa true y, al prender RLS, todo
-- queda bloqueado.

-- 1) Helper is_admin() (lo usan member_roles, family_unlink_requests)
CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM member_roles mr
    JOIN members m ON m.id = mr.member_id
    WHERE m.auth_user_id = auth.uid()
      AND mr.role = 'admin'
      AND mr.is_active = TRUE
  );
$$;

-- 2) Reescribe TODAS las políticas que tienen el patrón roto, reemplazando
--    `mr.member_id = (select auth.uid())` por una resolución vía members.auth_user_id.
DO $do$
DECLARE
  r record;
  q text;
  wc text;
  bad  text := 'mr.member_id = ( SELECT auth.uid() AS uid)';
  good text := 'mr.member_id IN ( SELECT m.id FROM members m WHERE m.auth_user_id = ( SELECT auth.uid() AS uid))';
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual LIKE '%' || bad || '%' OR with_check LIKE '%' || bad || '%')
  LOOP
    q  := replace(r.qual, bad, good);
    wc := replace(r.with_check, bad, good);
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

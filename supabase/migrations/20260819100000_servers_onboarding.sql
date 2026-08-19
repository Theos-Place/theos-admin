-- Onboarding de servidores en el perfil del miembro (pestaña Administrativo):
-- check de "llevó el onboarding" + fecha automática al marcarlo + quién lo marcó.
-- Mismo patrón que authorized_virtual_studies en member_admin_data.
ALTER TABLE public.member_admin_data
  ADD COLUMN IF NOT EXISTS servers_onboarding boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS servers_onboarding_at timestamptz,
  ADD COLUMN IF NOT EXISTS servers_onboarding_by uuid;

DO $$ BEGIN
  ALTER TABLE public.member_admin_data
    ADD CONSTRAINT member_admin_data_servers_onboarding_by_fkey
    FOREIGN KEY (servers_onboarding_by) REFERENCES public.members(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

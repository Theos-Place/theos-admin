-- Auditoría db (docs/db-audit-2026-07-18.md) — hallazgo 🟡 §1.
-- forms usa una relación polimórfica (entity_type + entity_id) SIN FK, porque
-- entity_id puede apuntar a events o a study_groups según entity_type. Al no
-- haber FK, nada impide (a) insertar un entity_id inexistente, ni (b) que el
-- form quede colgante si se borra el evento/grupo referenciado.
-- Hoy hay 0 colgantes; esto es protección preventiva antes del squash.
--
-- Enfoque elegido (documentado):
--   1) Validación en INSERT/UPDATE de forms: si entity_type es 'event' o
--      'study_group' y entity_id no es NULL, el id DEBE existir en la tabla
--      correspondiente; si no, se rechaza. (entity_type 'general'/NULL no valida
--      nada — es un form no atado a entidad.)
--   2) Borrado del padre: triggers AFTER DELETE en events y study_groups que
--      "huerfanan de forma controlada" los forms que los referenciaban
--      (entity_type → 'general', entity_id → NULL). Se preserva el form y sus
--      respuestas en vez de borrarlos o dejarlos colgando.
-- Se usan triggers (no FK) porque el destino es polimórfico.

-- 1. Validación de existencia al escribir en forms.
CREATE OR REPLACE FUNCTION public.forms_validate_entity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.entity_id IS NOT NULL AND NEW.entity_type = 'event' THEN
    IF NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = NEW.entity_id) THEN
      RAISE EXCEPTION 'forms.entity_id % no existe en events (entity_type=event)', NEW.entity_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  ELSIF NEW.entity_id IS NOT NULL AND NEW.entity_type = 'study_group' THEN
    IF NOT EXISTS (SELECT 1 FROM public.study_groups g WHERE g.id = NEW.entity_id) THEN
      RAISE EXCEPTION 'forms.entity_id % no existe en study_groups (entity_type=study_group)', NEW.entity_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forms_validate_entity ON public.forms;
CREATE TRIGGER trg_forms_validate_entity
  BEFORE INSERT OR UPDATE OF entity_type, entity_id ON public.forms
  FOR EACH ROW EXECUTE FUNCTION public.forms_validate_entity();

-- 2. Al borrar el padre, huerfanar de forma controlada los forms que lo apuntan.
CREATE OR REPLACE FUNCTION public.forms_detach_on_parent_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text := TG_ARGV[0];
BEGIN
  UPDATE public.forms
     SET entity_type = 'general', entity_id = NULL
   WHERE entity_type = v_type AND entity_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_forms_detach_on_event_delete ON public.events;
CREATE TRIGGER trg_forms_detach_on_event_delete
  AFTER DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.forms_detach_on_parent_delete('event');

DROP TRIGGER IF EXISTS trg_forms_detach_on_group_delete ON public.study_groups;
CREATE TRIGGER trg_forms_detach_on_group_delete
  AFTER DELETE ON public.study_groups
  FOR EACH ROW EXECUTE FUNCTION public.forms_detach_on_parent_delete('study_group');

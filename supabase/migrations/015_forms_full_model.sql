-- 015: Formularios — alinear forms/form_fields con el builder del frontend.

-- ─────────────────────────────────────────────────────────────────────────────
-- forms: categoría y entidad asociada
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE forms
  ADD COLUMN category    TEXT CHECK (category IN (
                'event_registration', 'study_registration', 'survey', 'registration', 'other'
              )),
  ADD COLUMN entity_type TEXT CHECK (entity_type IN ('event', 'study_group', 'general')),
  ADD COLUMN entity_id   UUID;  -- evento o grupo según entity_type (sin FK dura)

-- ─────────────────────────────────────────────────────────────────────────────
-- form_fields: tipos extra del builder + escala y descripción
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE form_fields DROP CONSTRAINT IF EXISTS form_fields_field_type_check;
ALTER TABLE form_fields ADD CONSTRAINT form_fields_field_type_check CHECK (field_type IN (
  'text', 'textarea', 'number', 'email', 'phone', 'date', 'select', 'multiselect',
  'checkbox', 'radio', 'scale', 'file', 'personal_data', 'section_header',
  'yes_no', 'section', 'page_break'
));

ALTER TABLE form_fields
  ADD COLUMN description     TEXT,
  ADD COLUMN scale_min       INT,
  ADD COLUMN scale_max       INT,
  ADD COLUMN scale_min_label TEXT,
  ADD COLUMN scale_max_label TEXT;

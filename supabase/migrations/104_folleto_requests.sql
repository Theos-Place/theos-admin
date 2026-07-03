-- Folletos: solicitudes de impresión/entrega de folletos del siguiente nivel,
-- generadas al cerrar un grupo de Nivel 1/2/3 o Discípulos 1/2 con aprobados.
-- Flujo de estado: creada → en_impresion → enviado_entregado → cerrada.

CREATE TABLE IF NOT EXISTS folleto_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_group_id uuid REFERENCES study_groups(id) ON DELETE SET NULL,
  source_plan_code text,               -- nivel origen (N1, N2, N3, DIS1, DIS2)
  target_level_code text NOT NULL,     -- nivel destino (N2, N3, N4, DIS2, DIS3)
  quantity integer NOT NULL DEFAULT 0, -- = cantidad de aprobados
  sede text,                           -- sede destino (tomada del perfil del dirigente, editable)
  close_date date NOT NULL,            -- fecha de cierre del grupo
  available_at date NOT NULL,          -- estimada: close_date + 2 semanas
  status text NOT NULL DEFAULT 'creada'
    CHECK (status = ANY (ARRAY['creada','en_impresion','enviado_entregado','cerrada']::text[])),
  confirmed_by uuid REFERENCES members(id) ON DELETE SET NULL,
  confirmed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_folleto_requests_status ON folleto_requests(status);
CREATE INDEX IF NOT EXISTS idx_folleto_requests_sede ON folleto_requests(sede);
CREATE INDEX IF NOT EXISTS idx_folleto_requests_created ON folleto_requests(created_at DESC);

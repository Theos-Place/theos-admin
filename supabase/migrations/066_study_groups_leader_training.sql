-- Grupos de doble propósito = capacitación de dirigentes (Capacitación Dirigentes
-- 2019, Precampaña/Transformados 2025 y futuros). is_leader_training marca el grupo;
-- training_modality guarda la modalidad cuando aplica ('larga'|'corta'|NULL).
alter table study_groups
  add column if not exists is_leader_training boolean default false,
  add column if not exists training_modality text;

-- Rango de edad del grupo de estudio (opcional). Si está definido, en la matrícula
-- solo se ofrecen los grupos cuyo rango incluye la edad del miembro (salvo
-- excepción por edad otorgada en el panel admin). Idempotente.
alter table study_groups add column if not exists age_min int;
alter table study_groups add column if not exists age_max int;

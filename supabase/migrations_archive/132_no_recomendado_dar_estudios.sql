-- Inversión de semántica: approved_to_lead_studies (lista blanca: "aprobado
-- para dar estudios") pasa a ser not_recommended_to_lead_studies (lista
-- negra: "no recomendado para dar estudios"). El significado se invierte por
-- completo, así que se descarta cualquier valor viejo — todos quedan
-- desactivados (nadie marcado), empezando la lista de excepciones vacía.

alter table member_admin_data rename column approved_to_lead_studies to not_recommended_to_lead_studies;
alter table member_admin_data rename column approved_to_lead_studies_by to not_recommended_to_lead_studies_by;
alter table member_admin_data rename column approved_to_lead_studies_at to not_recommended_to_lead_studies_at;

alter table member_admin_data
  rename constraint member_admin_data_approved_to_lead_studies_by_fkey
  to member_admin_data_not_recommended_to_lead_studies_by_fkey;

update member_admin_data set
  not_recommended_to_lead_studies = false,
  not_recommended_to_lead_studies_by = null,
  not_recommended_to_lead_studies_at = null;

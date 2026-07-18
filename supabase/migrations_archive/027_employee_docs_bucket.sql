-- Bucket privado para documentos de empleados (contratos, cédula, CCSS, etc.).
-- El acceso es siempre por el servidor con service role (que ignora RLS de storage),
-- así que no se definen policies: nadie llega directo sin pasar por las rutas API.
insert into storage.buckets (id, name, public)
values ('employee-docs', 'employee-docs', false)
on conflict (id) do nothing;

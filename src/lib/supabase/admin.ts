import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
// Valida las env vars al cargar el módulo (falla claro, no a media request).
import '@/lib/env'
import { actorActual, HEADER_ACTOR } from '@/lib/auth/actor-actual'

// Helpers de tipos derivados del esquema generado (src/types/database.ts).
type PublicTables = Database['public']['Tables']
export type TableName = keyof PublicTables
export type Row<T extends TableName> = PublicTables[T]['Row']
export type Insertable<T extends TableName> = PublicTables[T]['Insert']
export type Updatable<T extends TableName> = PublicTables[T]['Update']

export function createAdminClient() {
  // El actor viaja como header para que el trigger de auditoría sepa QUIÉN
  // escribió: la llave de servicio deja `auth.uid()` en null y la bitácora se
  // quedaba sin autor. Ver lib/auth/actor-actual.ts. Sin sesión no se manda
  // nada y todo se comporta igual que antes.
  const actor = actorActual()
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      ...(actor ? { global: { headers: { [HEADER_ACTOR]: actor } } } : {}),
    }
  )
}
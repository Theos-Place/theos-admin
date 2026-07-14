import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
// Valida las env vars al cargar el módulo (falla claro, no a media request).
import '@/lib/env'

// Helpers de tipos derivados del esquema generado (src/types/database.ts).
type PublicTables = Database['public']['Tables']
export type TableName = keyof PublicTables
export type Row<T extends TableName> = PublicTables[T]['Row']
export type Insertable<T extends TableName> = PublicTables[T]['Insert']
export type Updatable<T extends TableName> = PublicTables[T]['Update']

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
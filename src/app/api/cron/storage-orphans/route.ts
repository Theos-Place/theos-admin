import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { pingHealthcheck } from '@/lib/health'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Autorizado con el CRON_SECRET (cron semanal) o sesión de dirección/admin. */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secretsMatch(bearer, process.env.CRON_SECRET)) return null
  const auth = await requireRoles('direccion', 'admin')
  return auth.res ?? null
}

const PAGE = 1000

/** Lista recursivamente todos los objetos de un bucket (list() es por carpeta:
 *  las entradas sin `id` son carpetas y hay que descender en ellas). */
async function listBucketObjects(supabase: SupabaseClient, bucket: string, prefix = ''): Promise<string[]> {
  const paths: string[] = []
  let offset = 0
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: PAGE, offset })
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`)
    for (const entry of data ?? []) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.id === null) {
        // Carpeta (p. ej. enrollment_id o employee_id): descender.
        paths.push(...(await listBucketObjects(supabase, bucket, full)))
      } else {
        paths.push(full)
      }
    }
    if ((data ?? []).length < PAGE) break
    offset += PAGE
  }
  return paths
}

/** Pagina todas las filas de una tabla y devuelve el set de paths no nulos. */
async function listDbPaths(supabase: SupabaseClient, table: string, column: string): Promise<Set<string>> {
  const paths = new Set<string>()
  let offset = 0
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .not(column, 'is', null)
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(`select ${table}.${column}: ${error.message}`)
    for (const row of (data ?? []) as unknown as Array<Record<string, string | null>>) {
      const p = row[column]
      if (p) paths.add(p)
    }
    if ((data ?? []).length < PAGE) break
    offset += PAGE
  }
  return paths
}

type BucketReport = {
  bucket: string
  objects: number
  rows: number
  /** Objetos en el bucket sin fila que los referencie. */
  orphan_objects: string[]
  /** Filas con path que no existe en el bucket (rotas: 404 al abrir). */
  broken_rows: string[]
}

async function reportBucket(
  supabase: SupabaseClient,
  bucket: string,
  table: string,
  column: string,
): Promise<BucketReport> {
  const [objects, dbPaths] = await Promise.all([
    listBucketObjects(supabase, bucket),
    listDbPaths(supabase, table, column),
  ])
  const objectSet = new Set(objects)
  return {
    bucket,
    objects: objects.length,
    rows: dbPaths.size,
    orphan_objects: objects.filter(p => !dbPaths.has(p)),
    broken_rows: [...dbPaths].filter(p => !objectSet.has(p)),
  }
}

// POST: reporte semanal de consistencia Storage ↔ BD. SOLO REPORTA, NO BORRA
// (el borrado de huérfanos es decisión humana). Los huérfanos son inofensivos
// (ocupan espacio); las filas rotas dan 404 al abrir el archivo y sí urgen.
export async function POST(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied
  try {
    const supabase = createAdminClient()
    const reports = await Promise.all([
      reportBucket(supabase, 'payment-receipts', 'payments', 'receipt_path'),
      reportBucket(supabase, 'employee-docs', 'employee_documents', 'file_url'),
    ])

    const issues = reports.filter(r => r.orphan_objects.length > 0 || r.broken_rows.length > 0)
    if (issues.length > 0) {
      console.warn(
        'storage-orphans: inconsistencias Storage↔BD —',
        issues.map(r => `${r.bucket}: ${r.orphan_objects.length} huérfano(s), ${r.broken_rows.length} fila(s) rota(s)`).join('; '),
      )
    }

    await pingHealthcheck('HEALTHCHECK_URL_STORAGE_ORPHANS')
    return NextResponse.json({ ok: issues.length === 0, reports })
  } catch (error) {
    console.error('POST /api/cron/storage-orphans:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Los crons de Vercel invocan con GET (vercel.json); mismo handler.
export const GET = POST

/** Segunda tanda: processPendingEmails trae como mucho 1.000 filas por corrida
 *  (tope de PostgREST), así que un comunicado de 1.300 necesita repetirlo. */
;(async () => {
  const q = await import('../../src/lib/supabase/queries/communications.ts')
  console.log(await q.processPendingEmails('a95616b8-4356-4bb1-aece-b4e36e4d0b57'))
})().catch(e => { console.error(e); process.exit(1) })

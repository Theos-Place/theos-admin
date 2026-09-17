/** ¿Cuánto tarda y cuántas veces falla conectarse a la base? */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
;(async () => {
  let ok = 0, fallos = 0; const tiempos = []
  for (let i = 0; i < 10; i++) {
    const t0 = Date.now()
    const c = nuevoCliente()
    try {
      await c.connect()
      await c.query('select 1')
      const ms = Date.now() - t0; tiempos.push(ms); ok++
      process.stdout.write(`  intento ${i+1}: ${ms} ms\n`)
      await c.end()
    } catch (e) {
      fallos++; process.stdout.write(`  intento ${i+1}: FALLÓ tras ${Date.now()-t0} ms (${e.code ?? e.message})\n`)
      try { await c.end() } catch {}
    }
  }
  tiempos.sort((a,b)=>a-b)
  console.log(`\nok: ${ok} · fallos: ${fallos}`)
  if (tiempos.length) console.log(`mediana ${tiempos[Math.floor(tiempos.length/2)]} ms · min ${tiempos[0]} · max ${tiempos[tiempos.length-1]}`)
})()

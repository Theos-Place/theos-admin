export type Sede = {
  id: string
  name: string
  is_active: boolean
  is_historical: boolean
  day?: string
  time?: string
  location?: string
  age_group?: string
  waze_url?: string
}

export const SEDES: Sede[] = [
  // ── Sedes activas ────────────────────────────────────────────────────────────
  {
    id: 'meridiano', name: 'Meridiano', is_active: true, is_historical: false,
    day: 'Martes', time: '7:30pm', location: 'Edificio Meridiano, Escazú',
    age_group: '+32', waze_url: 'https://www.waze.com/live-map/directions?to=ll.9.942691,-84.152763',
  },
  {
    id: 'antares', name: 'Antares', is_active: true, is_historical: false,
    day: 'Miércoles', time: '7:30pm', location: 'Plaza Antares, San Pedro',
    age_group: '+18', waze_url: 'https://waze.com/ul/hd1u0x3283',
  },
  {
    id: 'liberia', name: 'Liberia', is_active: true, is_historical: false,
    day: 'Miércoles', time: '7:30pm', location: 'Donde Pipe, Bo. Los Ángeles',
    age_group: '+18', waze_url: 'https://waze.com/ul/hd1ghrxnvn',
  },
  {
    id: 'guapiles', name: 'Guápiles', is_active: true, is_historical: false,
    day: 'Miércoles', time: '7:00pm', location: 'Salón Pueblo en Fiesta',
    age_group: '+18', waze_url: 'https://waze.com/ul/hd1u6jmwyc',
  },
  {
    id: 'cartago', name: 'Cartago', is_active: true, is_historical: false,
    day: 'Miércoles', time: '7:30pm', location: 'Rancho Típico El Ensueño',
    age_group: '+18', waze_url: 'https://waze.com/ul/hd1u24ju5s',
  },
  {
    id: 'perez-zeledon', name: 'Pérez Zeledón', is_active: true, is_historical: false,
    day: 'Miércoles', time: '7:00pm', location: 'Casa Sindical SEC',
    age_group: '+18', waze_url: 'https://www.waze.com/live-map/directions?to=ll.9.376938,-83.705027',
  },
  {
    id: 'potrero', name: 'Potrero', is_active: true, is_historical: false,
    day: 'Jueves', time: '7:30pm', location: 'Playa Penca, Tempate',
    age_group: '+18', waze_url: 'https://waze.com/ul/hd1g580v31',
  },
  {
    id: 'alajuela', name: 'Alajuela', is_active: true, is_historical: false,
    day: 'Jueves', time: '7:30pm', location: 'Lifehouse, Alajuela Centro',
    age_group: '+18', waze_url: 'https://waze.com/ul/hd1u158h2e',
  },
  {
    id: 'madrid', name: 'Madrid', is_active: true, is_historical: false,
    day: 'Domingo', time: '11:30am', location: 'MadHat, Madrid',
    age_group: 'Todas las edades', waze_url: 'https://maps.app.goo.gl/VoquA2tPCYk6MYLv7',
  },
  {
    id: 'pedregal', name: 'Pedregal', is_active: true, is_historical: false,
    day: 'Miércoles / Jueves / Domingo', time: '7:30pm | 7:30pm | 11:00am',
    location: 'Pedregal',
    age_group: 'Miércoles y Domingo: Todas las edades | Jueves: 18–32',
    waze_url: 'https://waze.com/ul/hd1u0u2xsj',
  },
  {
    id: 'heredia', name: 'Heredia', is_active: true, is_historical: false,
    day: 'Miércoles', time: '7:30pm', location: 'Heredia Centro',
    age_group: '+18',
  },
  {
    id: 'united', name: 'United', is_active: true, is_historical: false,
    day: 'Sábado', time: '7:00pm', location: 'Sede Central',
    age_group: '+18',
  },

  // ── Sedes históricas — ya no operan pero se conservan para reportes ──────────
  { id: 'colegiales',       name: 'Colegiales',       is_active: false, is_historical: true },
  { id: 'entre-mujeres',    name: 'Entre Mujeres',    is_active: false, is_historical: true },
  { id: 'united-este',      name: 'United Este',      is_active: false, is_historical: true },
  { id: 'youth-united-este',name: 'Youth United Este',is_active: false, is_historical: true },
  { id: 'heredia-youth',    name: 'Heredia Youth',    is_active: false, is_historical: true },
  { id: 'united-youth',     name: 'United Youth',     is_active: false, is_historical: true },
  { id: 'home',             name: 'Home',             is_active: false, is_historical: true },
  { id: 'life-escalante',   name: 'Life Escalante',   is_active: false, is_historical: true },
]

// Solo sedes en operación — usar en formularios de creación
export const ACTIVE_SEDES = SEDES.filter(s => s.is_active)

// Solo históricas — para agrupar en reportes
export const HISTORICAL_SEDES = SEDES.filter(s => s.is_historical)

export type SedeId = (typeof SEDES)[number]['id']

export function sedeLabel(id: string): string {
  const found = SEDES.find(s => s.id === id)
  return found ? found.name : id
}

export const SEDES = [
  { id: 'meridiano', name: 'Meridiano', day: 'Martes', time: '7:30pm', location: 'Edificio Meridiano, Escazú', age_group: '+32', waze_url: 'https://www.waze.com/live-map/directions?to=ll.9.942691,-84.152763' },
  { id: 'antares', name: 'Antares', day: 'Miércoles', time: '7:30pm', location: 'Plaza Antares, San Pedro', age_group: '+18', waze_url: 'https://waze.com/ul/hd1u0x3283' },
  { id: 'liberia', name: 'Liberia', day: 'Miércoles', time: '7:30pm', location: 'Donde Pipe, Bo. Los Ángeles', age_group: '+18', waze_url: 'https://waze.com/ul/hd1ghrxnvn' },
  { id: 'guapiles', name: 'Guápiles', day: 'Miércoles', time: '7:00pm', location: 'Salón Pueblo en Fiesta', age_group: '+18', waze_url: 'https://waze.com/ul/hd1u6jmwyc' },
  { id: 'cartago', name: 'Cartago', day: 'Miércoles', time: '7:30pm', location: 'Rancho Típico El Ensueño', age_group: '+18', waze_url: 'https://waze.com/ul/hd1u24ju5s' },
  { id: 'perez-zeledon', name: 'Pérez Zeledón', day: 'Miércoles', time: '7:00pm', location: 'Casa Sindical SEC', age_group: '+18', waze_url: 'https://www.waze.com/live-map/directions?to=ll.9.376938,-83.705027' },
  { id: 'potrero', name: 'Potrero', day: 'Jueves', time: '7:30pm', location: 'Playa Penca, Tempate', age_group: '+18', waze_url: 'https://waze.com/ul/hd1g580v31' },
  { id: 'alajuela', name: 'Alajuela', day: 'Jueves', time: '7:30pm', location: 'Lifehouse, Alajuela Centro', age_group: '+18', waze_url: 'https://waze.com/ul/hd1u158h2e' },
  { id: 'madrid', name: 'Madrid', day: 'Domingo', time: '11:30am', location: 'MadHat, Madrid', age_group: 'Todas las edades', waze_url: 'https://maps.app.goo.gl/VoquA2tPCYk6MYLv7' },
  { id: 'pedregal', name: 'Pedregal', day: 'Miércoles / Jueves / Domingo', time: '7:30pm | 7:30pm | 11:00am', location: 'Pedregal', age_group: 'Miércoles y Domingo: Todas las edades | Jueves: 18–32', waze_url: 'https://waze.com/ul/hd1u0u2xsj' },
] as const

export type SedeId = typeof SEDES[number]['id']

export function sedeLabel(id: string): string {
  const found = SEDES.find(s => s.id === id)
  return found ? found.name : id
}

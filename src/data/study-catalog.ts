export type StudyCatalogItem = {
  code: string
  name: string
  stage: 'niveles' | 'inicial' | 'intermedia' | 'campaña'
  prerequisite: string | null
  weeks: number
  mentor?: string
  description?: string
  commitments?: string
  level?: 'Básico' | 'Intermedio' | 'Avanzado'
  requires_payment?: boolean
  cost?: number
  req_donor?: boolean
  req_server?: boolean
  req_attendee?: boolean
  requires_grade?: boolean
  auto_promote?: boolean
  next_study_id?: string
  is_archived?: boolean
}

export const STUDY_CATALOG: StudyCatalogItem[] = [

  // NIVELES
  { code: 'N1', name: 'Nivel 1', stage: 'niveles', prerequisite: null,  weeks: 10 },
  { code: 'N2', name: 'Nivel 2', stage: 'niveles', prerequisite: 'N1', weeks: 11 },
  { code: 'N3', name: 'Nivel 3', stage: 'niveles', prerequisite: 'N2', weeks: 10 },
  { code: 'N4', name: 'Nivel 4', stage: 'niveles', prerequisite: 'N3', weeks: 11 },

  // ETAPA INICIAL
  {
    code: 'SCJ',
    name: 'Sirviendo como Jesús',
    stage: 'inicial',
    prerequisite: 'N4',
    weeks: 12,
    mentor:'Daniela Sánchez',
    level: 'Intermedio',
    description: 'Un curso diseñado para descubrir la invitación de Jesús a ser servidores, y la forma única en la que Dios nos creó para servirle a Él y a las personas de nuestro alrededor. Primero, veremos el ejemplo de Jesús como el máximo servidor y extraeremos principios de servicio para aplicar a nuestra vida. Luego, veremos diferentes áreas de nuestra vida (personalidad, talentos, pasiones, dones y experiencias) para identificar cómo seguir el ejemplo de Jesús de forma personal. Finalmente, a través del estudio de personajes bíblicos, descubriremos cómo sus virtudes, decisiones y ejemplos reflejan el modelo de servicio de Jesús.',
    commitments: 'Tareas + presentación final',
  },
  {
    code: 'AED',
    name: 'Administrando el Dinero',
    stage: 'inicial',
    prerequisite: 'N4',
    weeks: 8,
    mentor:'Danilo Mata',
    level: 'Intermedio',
    description: 'Este curso invita a correr la "Maratón Financiera", un viaje transformador basado en principios bíblicos de buena administración y fe. A lo largo de etapas claras, se aprenden habilidades prácticas para cada fase: desde crear un presupuesto y un plan para emergencias, hasta desarrollar un plan intenso para eliminar todas las deudas usando el método de "bola de nieve". El objetivo final es cruzar la meta de la libertad financiera total, permitiendo vivir con una paz profunda y experimentar la alegría de una generosidad radical.',
    commitments: 'Tareas',
  },
  {
    code: 'EVM',
    name: 'Evangelismo',
    stage: 'inicial',
    prerequisite: 'N4',
    weeks: 10,
    mentor:'Charlie',
    level: 'Intermedio',
    description: 'Compartir el mensaje del evangelio es una de las grandes responsabilidades, pero también grandes privilegios de un cristiano. En este curso, aprenderemos a compartir el mensaje del evangelio de forma práctica y efectiva. Exploraremos estrategias, tácticas y métodos reales para compartir el mensaje de salvación. Estudiaremos los elementos teóricos que son esenciales en el evangelio, comprendiendo claramente sus componentes fundamentales para poder comunicarlo con convicción y fidelidad.',
    commitments: 'Quiz y tareas',
  },
  {
    code: 'ASF',
    name: 'Amor sin Fronteras',
    stage: 'inicial',
    prerequisite: 'N4',
    weeks: 7,
    level: 'Intermedio',
    description: 'En este curso descubrirás los fundamentos de la palabra, el mundo y la obra de Dios, ayudándonos a desarrollar nuestro amor y preocupación por aquellas personas alrededor del mundo que todavía no han escuchado el mensaje del Evangelio. A lo largo del curso estudiaremos lo que dice la Biblia acerca del deseo de Dios porque TODAS las personas lo conozcan, veremos el estado de nuestro mundo actual en cuanto al conocimiento del evangelio, e identificaremos las oportunidades para ser parte de la obra de Dios.',
    commitments: 'Ninguno (solo asistencia)',
  },
  {
    code: 'MAT',
    name: 'Matrimonios',
    stage: 'inicial',
    prerequisite: 'N4',
    weeks: 6,
    level: 'Básico',
    description: 'El curso de matrimonio estudia el diseño bíblico y el propósito de la unión entre un hombre y una mujer. Está pensado para parejas desde recién casadas hasta veteranas en la relación. Además, el curso aborda temas importantes en relaciones de pareja como la comunicación, el conflicto y la intimidad.',
    commitments: 'Sin compromisos adicionales',
  },
  {
    code: 'PREMAT',
    name: 'Prematrimonial',
    stage: 'inicial',
    prerequisite: 'N4',
    weeks: 10,
    level: 'Intermedio',
    description: 'El Curso Prematrimonial es un proceso de diez semanas en el que un matrimonio con experiencia guía a una pareja de creyentes que están comprometidos y desean prepararse espiritualmente para el matrimonio, entendiendo que este es un pacto sagrado de amor y fidelidad delante de Dios. Cada sesión ayuda a establecer a Dios como el centro sobre el cual se edifica toda la familia, guiando a los futuros esposos a tomar decisiones sabias en áreas espirituales, emocionales y prácticas.',
    commitments: 'Sin compromisos adicionales',
  },

  // ETAPA INTERMEDIA
  {
    code: 'DIS1',
    name: 'Discípulos 1',
    stage: 'intermedia',
    prerequisite: 'SCJ',
    weeks: 10,
    level: 'Avanzado',
    requires_payment: true,
    cost: 15000,
    description: 'Esta capacitación te llevará a profundizar en lo que significa seguir a Jesús en la vida diaria. A través de este proceso, podrás fortalecer tu relación con Dios, reflexionar sobre tu estilo de vida y crecer espiritualmente a la luz de Su Palabra. No solo te brinda conocimiento, sino que te invita a una transformación real, guiándote a través de las enseñanzas de Jesús y experiencias de otros discípulos, para inspirarte a vivir con propósito.',
    commitments: 'Tareas semanales',
  },
  {
    code: 'DIS2',
    name: 'Discípulos 2',
    stage: 'intermedia',
    prerequisite: 'DIS1',
    weeks: 9,
    level: 'Avanzado',
    requires_payment: true,
    cost: 15000,
    description: 'Continuación del proceso de Discípulos, profundizando en el llamado a hacer discípulos y en las disciplinas espirituales que forman el carácter de Cristo en nosotros.',
    commitments: 'Tareas semanales',
  },
  {
    code: 'DIS3',
    name: 'Discípulos 3',
    stage: 'intermedia',
    prerequisite: 'DIS2',
    weeks: 10,
    level: 'Avanzado',
    requires_payment: true,
    cost: 15000,
    description: 'El cierre del proceso de Discípulos, enfocado en multiplicar lo aprendido y en el liderazgo espiritual como estilo de vida.',
    commitments: 'Tareas semanales',
  },
  {
    code: 'CTBD',
    name: 'Cómo Tomar Buenas Decisiones',
    stage: 'intermedia',
    prerequisite: 'DIS3',
    weeks: 12,
    mentor:'Yendry',
    level: 'Avanzado',
    requires_payment: true,
    cost: 15000,
    description: 'Este curso invita a los participantes a reflexionar sobre cómo los mandamientos y principios bíblicos pueden guiar nuestras decisiones diarias. A través del análisis de situaciones cotidianas, se busca desarrollar una comprensión práctica de cómo vivir con integridad, amor y obediencia a Dios en cada área de la vida. El objetivo central es aprender a tomar decisiones que honren a Dios, promoviendo una fe activa y coherente con Su voluntad.',
    commitments: 'Quices, lectura, caso práctico, examen final',
  },
  {
    code: 'PAN',
    name: 'Panorama',
    stage: 'intermedia',
    prerequisite: 'DIS3',
    weeks: 12,
    mentor:'Lara Aguilar',
    level: 'Avanzado',
    requires_payment: true,
    cost: 15000,
    description: 'El curso Panorama de la Biblia tiene como propósito guiar al estudiante a través de toda la historia bíblica —desde la creación hasta la salvación— mostrando el hilo conductor del amor, la fidelidad y el plan redentor de Dios manifestado en Jesucristo. A lo largo de las semanas, los estudiantes comprenderán la estructura completa de la Biblia, descubriendo cómo los libros del Antiguo y Nuevo Testamento se entrelazan para revelar un solo mensaje: la salvación en Jesús.',
    commitments: 'Quices + exámenes cortos + examen final',
  },
  {
    code: 'EVA',
    name: 'Evangelios',
    stage: 'intermedia',
    prerequisite: 'PAN',
    weeks: 10,
    level: 'Avanzado',
    requires_payment: true,
    cost: 15000,
    description: 'En este curso haremos un viaje a través de los cuatro evangelios, pasando no solo por el texto sino también viendo el contexto en el que fue escrito. Estudiaremos los diferentes aspectos de la vida de Jesús y, al finalizar, obtendremos una mejor comprensión del mensaje principal, el propósito y las particularidades de cada evangelio.',
    commitments: 'Lecturas, tareas y quices semanales. Una presentación final.',
  },
  {
    code: 'HCH',
    name: 'Hechos',
    stage: 'intermedia',
    prerequisite: 'PAN',
    weeks: 9,
    level: 'Avanzado',
    requires_payment: true,
    cost: 15000,
    description: 'El libro de los Hechos narra el nacimiento, formación y expansión de los primeros cristianos. Este curso guía a los participantes a comprender ese modelo original, analizar los contextos históricos y bíblicos, y aplicar esos principios en nuestra vida diaria y en nuestra comunidad. Es ideal para quienes desean avanzar en su formación y servir con mayor claridad y compromiso.',
    commitments: 'Lecturas semanales, proyecto o ensayo final',
  },
  {
    code: 'ROM',
    name: 'Romanos',
    stage: 'intermedia',
    prerequisite: 'PAN',
    weeks: 12,
    mentor:'Naomi',
    level: 'Avanzado',
    requires_payment: true,
    cost: 15000,
    description: 'El libro de Romanos es una de las exposiciones más completas y poderosas del evangelio de Jesucristo. A través de esta carta, el apóstol Pablo revela la profundidad del amor y la justicia de Dios, explicando cómo la fe en Cristo nos libera del pecado, nos justifica ante Dios y nos llama a vivir una vida nueva guiada por el Espíritu. A través del análisis del texto bíblico, discusión en grupo, memorización de versículos y tareas de aplicación, los estudiantes comprenderán el poder del evangelio a mayor profundidad.',
    commitments: 'Quices + memorización de versículos + ensayos + proyecto final',
  },
  {
    code: 'HEB',
    name: 'Hebreos',
    stage: 'intermedia',
    prerequisite: 'PAN',
    weeks: 10,
    mentor:'Flori',
    level: 'Avanzado',
    requires_payment: true,
    cost: 15000,
    description: 'El curso de Hebreos es un recorrido profundo y práctico por esta carta, capítulo por capítulo. Descubriremos su mensaje, su contexto, sus advertencias, sus promesas y su aplicación para nuestra vida hoy. Utilizaremos diferentes métodos de estudio bíblico que nos ayudarán a crecer y a fortalecer nuestra fe de forma sólida, consciente e intencional.',
    commitments: 'Memorización de versículos + 1 proyecto de investigación y exposición',
  },
  {
    code: 'RDM',
    name: 'Religiones del Mundo',
    stage: 'intermedia',
    prerequisite: 'PAN',
    weeks: 12,
    mentor:'Josué',
    level: 'Avanzado',
    requires_payment: true,
    cost: 15000,
    description: 'Esta capacitación estudia las características importantes de otras religiones (Hinduismo, Budismo, Judaísmo, Islam, Fe Bahaí, Mormones y Testigos de Jehová) con el fin de capacitar al estudiante para interactuar con personas de una fe distinta y poder apuntar a la verdad revelada en la Biblia. El curso no se enfoca en un estudio profundo de cada religión, sino en un acercamiento que nos permita mostrar el amor de Cristo a otros, generando empatía.',
    commitments: 'Tareas + exposición final',
  },
  {
    code: 'DLF',
    name: 'Defendiendo la Fe',
    stage: 'intermedia',
    prerequisite: 'PAN',
    weeks: 10,
    mentor:'Naomi',
    level: 'Avanzado',
    requires_payment: true,
    cost: 15000,
    description: 'Vivimos en una época donde la fe cristiana es constantemente cuestionada, y los creyentes necesitan estar preparados para responder con verdad, claridad y humildad. En este curso los participantes explorarán los fundamentos bíblicos, filosóficos e históricos de la fe cristiana. A través de clases dinámicas, debates, análisis de argumentos y ejercicios prácticos, los estudiantes aprenderán a responder con convicción a los desafíos más comunes contra la fe.',
    commitments: 'Por definir',
  },
  {
    code: 'HER',
    name: 'Hermenéutica',
    stage: 'intermedia',
    prerequisite: 'PAN',
    weeks: 10,
    mentor:'Naomi',
    level: 'Avanzado',
    requires_payment: true,
    cost: 15000,
    description: 'La Palabra de Dios es viva y eficaz, pero para entenderla correctamente necesitamos interpretarla con fidelidad y discernimiento espiritual. En este curso estudiaremos los principios fundamentales de interpretación bíblica y cómo aplicarlos a diferentes géneros literarios de la Escritura. A través de exposiciones, análisis de pasajes, ejercicios prácticos y discusiones guiadas, los estudiantes desarrollarán las herramientas necesarias para estudiar y enseñar la Biblia con mayor profundidad, claridad y fidelidad al mensaje original.',
    commitments: 'Tareas + Proyecto final con exposición',
  },

  // CAMPAÑAS
  { code: 'TRANS', name: 'Transformados',                       stage: 'campaña', prerequisite: null, weeks: 8 },
  { code: 'UFA',   name: 'Una Fe Audaz',                        stage: 'campaña', prerequisite: null, weeks: 8 },
  { code: 'PQET',  name: '¿Para qué estoy aquí en la tierra?',  stage: 'campaña', prerequisite: null, weeks: 8 },
  { code: 'TPS',   name: 'Tiempo para Soñar',                   stage: 'campaña', prerequisite: null, weeks: 8 },
]

export const STUDY_STAGES = {
  niveles:    { label: 'Niveles',          color: 'navy',   description: 'Fundamentos de la fe cristiana' },
  inicial:    { label: 'Etapa Inicial',    color: 'teal',   description: 'Crecimiento y servicio' },
  intermedia: { label: 'Etapa Intermedia', color: 'coral',  description: 'Profundización bíblica y liderazgo' },
  campaña:    { label: 'Campañas',         color: 'purple', description: 'Estudios especiales sin prerequisitos' },
}

export const INTERMEDIA_REQUIREMENTS = [
  'Asistir regularmente a charlas (con check-in)',
  'Haber escuchado "¿A dónde va este bus?"',
  'Servir activamente en un comité y apoyar financieramente',
]

export type StudyCode = string
export type StudyStage = 'niveles' | 'inicial' | 'intermedia' | 'campaña'

export function studyLabel(code: string): string {
  const found = STUDY_CATALOG.find(s => s.code === code)
  return found ? `${found.code} — ${found.name}` : code
}

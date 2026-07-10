// Caso de prueba end-to-end: dos respondientes de la misma marca, con una tensión
// deliberada entre ellos (la fundadora quiere lentitud y comunidad; el socio quiere
// escalar y competir por volumen). El análisis debería NOMBRAR esa tensión, no promediarla.
//
// Uso: node seed-caso-prueba.mjs http://localhost:3001
const BASE = process.argv[2] ?? 'http://localhost:3001'

const ANA = {
  perfil: { name: 'Ana Restrepo', company: 'Cafe Lunar', role: 'Fundadora', email: 'ana@cafelunar.co' },
  abiertas: {
    empresa_historia: 'Cafe Lunar nacio en 2019 en un local chiquito de Laureles, en Medellin. Empezamos tostando en una maquina prestada. Hoy tenemos dos tiendas y vendemos grano a unas treinta cafeterias de la ciudad.',
    productos: 'Cafe de origen tostado por nosotros, metodos de preparacion en barra, y una suscripcion mensual de grano que despachamos a domicilio.',
    porque_ahora: 'Porque abrieron tres cadenas grandes a menos de diez cuadras y la gente empieza a vernos como una cafeteria mas. Si no contamos quienes somos, nos comen por precio.',
    estrategia: 'Queremos que la gente se sienta acompañada, no vendida. Que el cafe sea la excusa y la conversacion sea el producto.',
    competencia_hace: 'Compiten por rapidez y por precio. Nadie esta hablando del origen del grano ni de los productores.',
    kpis: 'Subir la suscripcion de 200 a 500 clientes en un año y que la gente se quede en promedio mas de cuarenta minutos en el local.',
    competidores: 'Directos: Starbucks, Juan Valdez y Pergamino. Indirectos: las panaderias de barrio que ahora ponen maquina de espresso.',
    problema: 'La gente toma cafe todos los dias pero no tiene donde sentarse a conversar sin que la apuren.',
    target: 'Adultos de 28 a 45 en Medellin, que trabajan cerca, que valoran el producto y tienen tiempo para quedarse.',
    percepcion: 'Nos ven como el cafe rico del barrio, pero no saben nada de nosotros ni de donde viene el grano.',
    cambio: 'Que dejen de vernos como un lugar para comprar cafe y empiecen a vernos como un lugar donde uno se queda.',
    objetivos: 'Una identidad calida, artesanal, que se vea bien en la bolsa de grano y en el letrero de la calle.',
    donde_vive: 'Las dos tiendas, las bolsas de grano, la caja de la suscripcion y el Instagram.',
    marketing_mix: 'Lanzamiento con catacion abierta, alianza con los productores y contenido contando de donde viene cada lote.',
  },
  proyectivas: {
    animal: { choice: 'zorro', why: 'Un zorro. Somos astutos pero calidos, no imponemos, nos acercamos despacio.' },
    color: { choice: 'marron', why: 'El marron del grano tostado y de la madera del local. Nada estridente.' },
    genero: { choice: 'mujer', why: 'Una mujer que escucha antes de hablar.' },
    edad_mujer: { choice: '30s', why: 'Ya sabe quien es pero todavia tiene ganas de descubrir cosas.' },
    olor: { choice: 'cerezo', why: 'Dulce, discreto, no te tumba. Se queda.' },
    ciudad: { choice: 'lisboa', why: 'Una ciudad donde uno camina despacio y se sienta a mirar.' },
  },
}

const BETO = {
  perfil: { name: 'Beto Ramirez', company: 'Cafe Lunar', role: 'Socio y director comercial', email: 'beto@cafelunar.co' },
  abiertas: {
    empresa_historia: 'Cafe Lunar arranco en 2019 como un proyecto de tostion. Yo entre en 2021 cuando vi que el margen del grano al por mayor era mejor que el de la barra.',
    productos: 'Grano tostado al por mayor, dos tiendas propias y la suscripcion. El fuerte del negocio hoy es el mayoreo.',
    porque_ahora: 'Porque las cadenas grandes nos van a sacar del mercado si no crecemos rapido. Hay que abrir mas puntos este año.',
    estrategia: 'Escalar. Mas puntos de venta, mas volumen de grano, bajar el costo por kilo tostado.',
    competencia_hace: 'Starbucks tiene la operacion afinada y Juan Valdez tiene la marca. Nosotros no tenemos ninguna de las dos, tenemos el producto.',
    kpis: 'Duplicar facturacion, abrir cuatro puntos y bajar el costo de tostion un quince por ciento.',
    competidores: 'Starbucks, Juan Valdez, Pergamino y Cafe Quindio en el canal mayorista.',
    problema: 'El consumidor no distingue un cafe bueno de uno malo y termina comprando por precio o por cercania.',
    target: 'Todo el que tome cafe. Y sobre todo las cafeterias que nos compran el grano.',
    percepcion: 'Creo que la gente ni piensa en nosotros, honestamente. Somos una opcion mas cuando pasan por ahi.',
    cambio: 'Que nos elijan primero, que la marca pese cuando decidan.',
    objetivos: 'Algo que se vea profesional y que aguante crecer. Que no parezca un negocio de garaje.',
    donde_vive: 'Puntos de venta, empaque mayorista, camion de reparto y material para las cafeterias clientes.',
    marketing_mix: 'Pauta digital, presencia en ferias de cafe y fuerza comercial para el canal mayorista.',
  },
  proyectivas: {
    animal: { choice: 'leon', why: 'Un leon. Hay que imponerse en esta categoria o te comen.' },
    color: { choice: 'rojo', why: 'Algo que se vea de lejos en la gondola.' },
    genero: { choice: 'hombre', why: 'Un hombre que sabe lo que quiere y va por eso.' },
    edad_hombre: { choice: '40s', why: 'Con experiencia y con capital para invertir.' },
    olor: { choice: 'cesped', why: 'Fresco, limpio, que suene a nuevo.' },
    ciudad: { choice: 'nueva-york', why: 'Rapida, competitiva, la que gana se queda.' },
  },
}

async function crear(p) {
  const r = await fetch(`${BASE}/api/sessions`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p.perfil),
  })
  const { id } = await r.json()
  console.log(`  sesion de ${p.perfil.name}: ${id}`)

  for (const [questionId, rawText] of Object.entries(p.abiertas)) {
    await fetch(`${BASE}/api/sessions/${id}/answers`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ questionId, rawText }),
    })
  }
  for (const [questionId, { choice, why }] of Object.entries(p.proyectivas)) {
    await fetch(`${BASE}/api/sessions/${id}/answers`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionId, rawText: why, imageChoice: choice }),
    })
  }
  const c = await fetch(`${BASE}/api/sessions/${id}/complete`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  })
  console.log(`    completada: ${JSON.stringify(await c.json())}`)
  return id
}

console.log('Sembrando caso de prueba "Cafe Lunar" (2 respondientes con tension deliberada)...')
await crear(ANA)
await crear(BETO)
console.log('Listo.')

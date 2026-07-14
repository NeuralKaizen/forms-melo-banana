// Caso de demo: "Fruta Viva", comercializadora de fruta fresca. Tres respondientes
// de la misma empresa con tres visiones que NO coinciden — la fundadora quiere origen
// y trato directo con el campesino, el comercial quiere volumen y cadena de supermercados,
// y marketing quiere conveniencia y app. El entregable debería NOMBRAR esa tensión.
//
// Las tres sesiones comparten `company`, así que al completarlas la app las agrupa sola
// en un mismo proyecto. Después se genera el entregable desde /admin.
//
// Uso: node scripts/seed-frutas.mjs                                       (localhost:3000)
//      node scripts/seed-frutas.mjs https://<app>.vercel.app              (contra el deploy)
//      node scripts/seed-frutas.mjs https://<app>.vercel.app "Otra Marca"  (otro nombre de empresa)
//
// El nombre de empresa define el proyecto: las sesiones se agrupan por él. Cambiarlo
// crea un proyecto aparte (la normalización es sólo minúsculas + espacios).
const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')
const COMPANY = process.argv[3] ?? 'Fruta Viva'

const LUCIA = {
  perfil: { name: 'Lucía Ospina', company: COMPANY, role: 'Fundadora y directora general', email: 'lucia@frutaviva.co' },
  abiertas: {
    empresa_historia: 'Fruta Viva empezó en 2017 con un camión prestado y catorce fincas de la zona cafetera. Mi papá era acopiador de fruta y yo crecí viendo cómo al campesino le pagaban lo que sobraba. Armamos la empresa para comprarle directo y pagarle bien. Hoy trabajamos con ciento veinte fincas y despachamos a Medellín, Bogotá y Cali.',
    productos: 'Fruta fresca de temporada: mango, aguacate, mora, uchuva, maracuyá. Vendemos canastas semanales a hogares, y le vendemos a restaurantes y a fruterías de barrio. También sacamos pulpa congelada de lo que no cumple el calibre para vender fresco, para no botar nada.',
    porque_ahora: 'Porque entraron dos plataformas de mercado a domicilio con plata de fondos y están comprando cuota de mercado a pérdida. Si la gente nos ve como un intermediario más, competimos por precio y ahí perdemos: nosotros pagamos más caro en la finca a propósito. Si no contamos por qué costamos lo que costamos, nos borran.',
    estrategia: 'Que la marca sostenga el precio. Queremos que el cliente entienda que está comprando trazabilidad y que su plata llega al que la sembró, y que eso justifique pagar quince o veinte por ciento más que en la plaza.',
    competencia_hace: 'Compiten con descuento y con velocidad de entrega. Nadie está diciendo de dónde viene la fruta ni quién la sembró. La palabra "campesino" no aparece en ninguna de sus comunicaciones.',
    kpis: 'Pasar de mil doscientas a tres mil canastas semanales en el año, mantener el margen por encima del treinta por ciento sin bajar el precio de compra en finca, y que la recompra a tres meses pase del cuarenta al sesenta por ciento.',
    competidores: 'Directos: Merqueo, Rappi Turbo y las plataformas de mercado a domicilio. Indirectos: las plazas de mercado, los supermercados de cadena y las fruterías de barrio, que siguen siendo donde la gente compra por costumbre.',
    problema: 'La gente quiere comer fruta buena pero la que consigue cerca está madurada a la fuerza o lleva días en una bodega. Compra fruta, se le daña en tres días, y termina sintiendo que la fruta es cara y no rinde.',
    target: 'Hogares de estrato medio y medio-alto en las tres ciudades, gente de treinta a cincuenta que cocina en la casa y que le importa qué le da de comer a los hijos.',
    percepcion: 'Los que ya nos compran nos quieren mucho y nos recomiendan. El problema es que somos invisibles: el que no nos conoce no tiene ni idea de que existimos.',
    cambio: 'Que dejen de comprar fruta como un commodity y empiecen a preguntarse de dónde viene, igual que ya hacen con el café.',
    objetivos: 'Una identidad que se sienta del campo pero que no se vea pobre ni improvisada. Que la caja que llega a la casa se vea digna del trabajo que hay detrás.',
    donde_vive: 'La caja de la canasta semanal, el camión de reparto, la web donde se hace el pedido y las fruterías que revenden nuestra fruta.',
    marketing_mix: 'Contar la historia de las fincas, llevar clientes a conocerlas, y que cada caja traiga el nombre de la finca que sembró lo que viene adentro.',
  },
  proyectivas: {
    animal: { choice: 'caballo', why: 'Un caballo. Trabajador, noble, aguanta. No es el más vistoso pero es el que hace el trabajo de verdad.' },
    color: { choice: 'verde', why: 'El verde de la mata antes de que la fruta madure. Es vida y es campo, sin tener que gritarlo.' },
    genero: { choice: 'mujer', why: 'Una mujer, porque la empresa cuida. Le importa de dónde viene la cosa y a quién le paga.' },
    edad_mujer: { choice: '40s', why: 'Ya sabe lo que vale su trabajo y no se deja regatear.' },
    olor: { choice: 'hierba', why: 'A hierba mojada, a finca temprano en la mañana. Ese es el olor de donde venimos.' },
    ciudad: { choice: 'marrakech', why: 'Por el mercado: gente gritando, fruta apilada, todo el mundo tocando y oliendo lo que va a comprar. Eso es comercio de verdad.' },
  },
}

const MARCOS = {
  perfil: { name: 'Marcos Tobón', company: COMPANY, role: 'Director comercial', email: 'marcos@frutaviva.co' },
  abiertas: {
    empresa_historia: 'Fruta Viva es una comercializadora de fruta fresca que arrancó en 2017. Yo entré en 2022 desde el mundo del consumo masivo, y entré porque vi que el negocio tenía producto pero no tenía canal. La historia de las fincas es linda, pero lo que paga la nómina es el volumen.',
    productos: 'Fruta fresca en fresco y pulpa congelada. Hoy el fuerte es la canasta a hogares, pero el crecimiento real está en venderle a las cadenas y al canal institucional: hoteles, restaurantes, casinos de empresas.',
    porque_ahora: 'Porque estamos en el peor lugar posible: somos muy caros para competir en la góndola y muy chiquitos para que una cadena nos tome en serio. Hay que definirse ya. Si nos quedamos en el nicho, en dos años nos quedamos sin caja.',
    estrategia: 'Escalar el volumen para bajar el costo por kilo. Entrar a dos cadenas grandes este año, negociar mejores fletes, y usar la pulpa congelada para monetizar la fruta que hoy se pierde.',
    competencia_hace: 'Las plataformas tienen la logística resuelta y la data del cliente. Nosotros no tenemos ninguna de las dos. Tienen precio, tienen velocidad y tienen surtido. Lo único que no tienen es la calidad de la fruta.',
    kpis: 'Duplicar la facturación, cerrar dos cadenas nacionales, bajar el costo logístico por pedido un veinte por ciento y llevar la pulpa congelada al treinta por ciento de los ingresos.',
    competidores: 'Merqueo, Rappi, las grandes superficies con su marca propia de fruta, y los mayoristas de la central de abastos que mueven volúmenes que nosotros ni soñamos.',
    problema: 'El consumidor no sabe distinguir una fruta buena de una regular hasta que se la come. Y como no sabe, decide por precio y por cuál le llega más rápido.',
    target: 'Hogares, sí, pero sobre todo el canal: supermercados, restaurantes y fruterías. Ahí está el volumen que hace rentable el camión.',
    percepcion: 'Honestamente, creo que el mercado no piensa en nosotros. Somos una opción bonita para el que ya nos conoce y nadie más nos tiene en el radar.',
    cambio: 'Que nos consideren primero cuando van a comprar fruta, y que una cadena nos vea como un proveedor serio y no como un proyecto de finca.',
    objetivos: 'Algo que se vea profesional y que aguante estar al lado de marcas grandes en una góndola sin verse chiquito. Que no parezca un emprendimiento de mercado campesino.',
    donde_vive: 'Empaque para góndola, material para la fuerza comercial, el camión, y las fichas técnicas que le mandamos a los compradores de las cadenas.',
    marketing_mix: 'Pauta digital para captar hogares, y sobre todo fuerza comercial y presencia en ferias del sector para el canal. Descuento de introducción para entrar a las cadenas.',
  },
  proyectivas: {
    animal: { choice: 'aguila', why: 'Un águila. Ve el campo completo desde arriba y cae donde tiene que caer. Hay que ser estratégico, no romántico.' },
    color: { choice: 'naranja', why: 'Naranja, porque en una góndola llena de verde y de blanco, el naranja es lo único que te frena el carrito.' },
    genero: { choice: 'hombre', why: 'Un hombre que sabe negociar y que no se va de una reunión sin cerrar.' },
    edad_hombre: { choice: '40s', why: 'Con recorrido y con contactos. Ya sabe cómo funciona el negocio por dentro.' },
    olor: { choice: 'naranjas', why: 'A naranja recién partida. Es fruta, es fresco y se reconoce al instante. No hay que explicarlo.' },
    ciudad: { choice: 'ny', why: 'Nueva York. Rápida, competitiva, y el que no rinde se va. Así es este mercado.' },
  },
}

const PAULA = {
  perfil: { name: 'Paula Quintero', company: COMPANY, role: 'Jefa de marketing y canal digital', email: 'paula@frutaviva.co' },
  abiertas: {
    empresa_historia: 'Fruta Viva vende fruta fresca directo de finca, desde 2017. Yo llevo dos años y me tocó armar el canal digital de cero: hoy el ochenta por ciento de los pedidos entran por la web, aunque el equipo todavía piensa como si vendiéramos en camión.',
    productos: 'La canasta semanal por suscripción es el producto estrella, aunque adentro nadie la llame así. También hay pedido suelto y pulpa congelada. Lo que la gente compra en realidad no es fruta: es no tener que pensar en la fruta.',
    porque_ahora: 'Porque la gente joven que se está mudando sola es la que va a comprar comida a domicilio los próximos veinte años, y esa gente no nos conoce. Nos ven como algo de mamás. Si no entramos ahí ahora, entramos cuando ya sea carísimo entrar.',
    estrategia: 'Convertir la compra de fruta en un hábito automático. La suscripción es el negocio: elimina la decisión semanal y nos vuelve parte de la rutina de la casa.',
    competencia_hace: 'Están gastando muchísimo en adquisición y quemando plata. Pero tienen una app que funciona y nosotros tenemos una web que se cae los domingos, que es justo cuando la gente pide.',
    kpis: 'Bajar el costo de adquisición por cliente a la mitad, subir la retención de la suscripción al mes seis por encima del cincuenta por ciento, y que la app tenga más pedidos que la web antes de fin de año.',
    competidores: 'Rappi y Merqueo por el lado del domicilio, pero también compito contra la pereza: contra que el tipo simplemente no compre fruta esa semana y se coma unas galletas.',
    problema: 'Comprar fruta buena es un trabajo. Hay que ir, escoger, cargar, y aun así te equivocás. Nosotros le quitamos ese trabajo de encima a la gente y se lo entregamos resuelto en la puerta.',
    target: 'Gente de veinticinco a cuarenta en ciudad, que vive sola o en pareja, que quiere comer mejor pero no tiene tiempo ni ganas de ir a la plaza.',
    percepcion: 'Los que nos conocen nos ven como algo bueno pero un poquito de nicho, como para gente que tiene tiempo de cocinar. Y eso nos está cerrando el mercado más grande.',
    cambio: 'Que la fruta deje de ser una decisión y pase a ser algo que simplemente llega. Que no piensen en comprarla, que piensen en comérsela.',
    objetivos: 'Una marca que funcione en pantalla chiquita, que se vea joven y que no sea otra marca verde de campo con una tipografía rústica. Hay veinte marcas así y todas se ven iguales.',
    donde_vive: 'La app y la web sobre todo, el ícono en el celular, las notificaciones, las redes, y la caja como pieza de contenido: la gente la fotografía cuando llega.',
    marketing_mix: 'Contenido y creadores hablando de comida real, referidos entre suscriptores, y una primera caja con descuento para bajar la barrera de entrada.',
  },
  proyectivas: {
    animal: { choice: 'flamenco', why: 'Un flamenco. Es raro, es llamativo, y en una foto lo reconocés entre mil. Necesitamos eso, no otro animal serio.' },
    color: { choice: 'amarillo', why: 'Amarillo porque es alegre y porque se ve en un feed. El verde ya lo tienen todos.' },
    genero: { choice: 'mujer', why: 'Una mujer, pero joven, con humor. No la señora que cuida: la amiga que te dice qué comer.' },
    edad_mujer: { choice: '20s', why: 'Porque es la que está armando sus hábitos ahora, y si la agarramos ahora se queda diez años.' },
    olor: { choice: 'pina', why: 'A piña. Dulce, tropical, te despierta. Es un olor que da ganas de algo.' },
    ciudad: { choice: 'bali', why: 'Bali. Fresca, luminosa, se ve bien en foto y la gente quiere estar ahí.' },
  },
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function crear(p) {
  const { id } = await post('/api/sessions', p.perfil)
  console.log(`  ${p.perfil.name} (${p.perfil.role})\n    sesión ${id}`)

  for (const [questionId, rawText] of Object.entries(p.abiertas)) {
    await post(`/api/sessions/${id}/answers`, { questionId, rawText })
  }
  for (const [questionId, { choice, why }] of Object.entries(p.proyectivas)) {
    await post(`/api/sessions/${id}/answers`, { questionId, rawText: why, imageChoice: choice })
  }
  const abiertas = Object.keys(p.abiertas).length
  const proyectivas = Object.keys(p.proyectivas).length
  console.log(`    ${abiertas} abiertas + ${proyectivas} proyectivas`)

  const { status } = await post(`/api/sessions/${id}/complete`)
  console.log(`    completada (status: ${status})`)
  return id
}

console.log(`Sembrando "${COMPANY}" (3 respondientes) en ${BASE}\n`)
for (const p of [LUCIA, MARCOS, PAULA]) await crear(p)
console.log(`\nListo. Las 3 sesiones se agruparon en el proyecto "${COMPANY}".`)
console.log(`Abrí ${BASE}/admin → ${COMPANY} → "Generar entregable".`)

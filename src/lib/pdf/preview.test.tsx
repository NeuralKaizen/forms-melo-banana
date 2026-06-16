// @vitest-environment node
// Prueba de humo / preview: arma una sesión COMPLETA (todas las secciones + proyectivo),
// renderiza el brief y lo escribe a disco para revisarlo a ojo como saldría del panel.
//   npx vitest run src/lib/pdf/preview.test.tsx
// Salida: tmp/brief-completo.pdf
import { describe, it, expect } from 'vitest'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { renderToBuffer } from '@react-pdf/renderer'
import { BriefDocument } from './BriefDocument'
import { buildBriefView } from './answers-view'

// Respuestas de ejemplo para cada pregunta abierta (texto realista de relleno).
const TEXT: Record<string, string> = {
  empresa_historia:
    'Frutaria nació en 2018 en Valencia como un puesto de mercado y hoy distribuye fruta de proximidad a más de 400 tiendas. La marca creció por boca a boca y nunca tuvo una identidad visual formal.',
  productos: 'Cajas de fruta de temporada por suscripción, zumos prensados en frío y una línea de snacks deshidratados sin azúcar añadido.',
  porque_ahora:
    'Entran dos competidores con fuerte inversión y la marca actual se ve amateur frente a ellos. Si no evolucionamos ahora, perdemos el posicionamiento premium que ganamos y la conversación de retail se vuelve solo precio.',
  estrategia: 'Pasar de "fruta barata a domicilio" a "el hábito saludable de tu semana": subir ticket medio con suscripción y defender margen con marca.',
  competencia_hace: 'La competencia compite por precio y promesa de rapidez. Nadie está construyendo vínculo emocional ni narrativa de origen del producto.',
  kpis: 'Aumentar la suscripción activa un 25% en 12 meses, subir el ticket medio un 15% y mejorar el recuerdo de marca asistido del 8% al 20%.',
  competidores: 'Directos: FreshBox y La Huerta Online. Indirectos: la sección de fruta de los supermercados y los mercados de barrio.',
  problema: 'Comer fruta fresca de calidad de forma constante es un esfuerzo logístico; la gente quiere comer sano pero la fruta se le echa a perder o no es buena.',
  target: 'Adultos urbanos de 28 a 45 años, conscientes de su salud, con poco tiempo y disposición a pagar por comodidad y calidad.',
  percepcion: 'Hoy nos ven como "los de la fruta buena pero con web fea". Confían en el producto pero no en la marca.',
  cambio: 'Que pasen de comprar fruta por impulso a verla como un ritual semanal de autocuidado al que se suscriben.',
  objetivos: 'Una identidad cálida y premium, legible en formato pequeño (etiqueta y app) y con un sistema flexible para packaging estacional.',
  donde_vive: 'App y web de suscripción, packaging de las cajas, etiquetas de zumos, redes sociales y stands en ferias gastronómicas.',
  marketing_mix: 'Lanzamiento con campaña de origen del producto, sampling en oficinas y partnership con gimnasios; la marca tiene que sostener tanto digital como punto de venta físico.',
}

// Elección elegida para cada pregunta proyectiva (id de opción del SCRIPT).
const CHOICE: Record<string, string> = {
  animal: 'leon',
  color: 'amarillo',
  genero: 'mujer',
  edad_mujer: '30s', // como genero = mujer, esta es la variante que se muestra
  olor: 'naranjas',
  ciudad: 'barcelona',
}

describe('preview brief completo', () => {
  it('renderiza y escribe tmp/brief-completo.pdf', async () => {
    const answers = [
      ...Object.entries(TEXT).map(([questionId, rawText]) => ({ questionId, rawText })),
      ...Object.entries(CHOICE).map(([questionId, imageChoice]) => ({ questionId, rawText: '', imageChoice })),
    ]

    const session = {
      name: 'Lucía Martín',
      company: 'Frutaria',
      role: 'Directora de Marketing',
      email: 'lucia@frutaria.com',
      completedAt: new Date('2026-06-16T10:00:00'),
    }

    const view = buildBriefView(session, answers)
    const buffer = await renderToBuffer(<BriefDocument view={view} />)

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF')

    const out = resolve(process.cwd(), 'tmp/brief-completo.pdf')
    await mkdir(resolve(process.cwd(), 'tmp'), { recursive: true })
    await writeFile(out, buffer)
    console.log(`\n✓ PDF escrito en ${out} (${buffer.length} bytes)\n`)
  })
})

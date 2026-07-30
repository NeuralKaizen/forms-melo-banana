/**
 * Carga un landscape de ejemplo en un proyecto existente, para poder ver el panel
 * funcionando antes de que exista el MCP. Uso:
 *
 *   npm run seed:landscape -- "Fruta Viva"
 */
import { db } from '../src/lib/db/client'
import {
  listProjects, normalizeCompanyName,
  saveLandscapeVersion, approveLandscapeVersion, setStageStatus,
} from '../src/lib/db/store'

const CONTEXTO = {
  datos_generales: 'La categoría de alimentos frescos en Colombia creció 7,4 % en 2025, por encima del promedio de consumo masivo.',
  cifras_relevantes: [
    { dato: '7,4 % de crecimiento anual', fuente: 'RADDAR Reports', anio: 2025 },
    { dato: '38 % de los hogares compra fresco al menos 3 veces por semana', fuente: 'Kantar Colombia', anio: 2025 },
  ],
  drivers_de_cambio: [
    'Precio del transporte y su efecto en la cadena de frío',
    'Migración del canal tradicional al d2c por suscripción',
  ],
  retos_del_sector: ['Merma en el último tramo', 'Fragmentación de la oferta de origen'],
}

const TENDENCIAS = {
  candidatas: [
    {
      id: 't1', eje: 'Marca',
      titulo: 'Longevidad como aspiración, no como miedo',
      descripcion: 'La alimentación saludable deja de venderse como prevención del deterioro y pasa a venderse como ampliación de la vida activa.',
      fuentes: [
        { doc: 'Mintel 2026 Global Food and Drink Predictions', pagina: 31 },
        { doc: 'WGSN Generation Cheat Sheet', pagina: 12 },
      ],
    },
    {
      id: 't2', eje: 'Marca',
      titulo: 'El origen como identidad, no como sello',
      descripcion: 'La procedencia deja de ser un ícono en el empaque y se convierte en el relato central de la marca: quién lo cultiva y dónde.',
      fuentes: [{ doc: 'Whole Foods Market Trends 2026' }, { doc: 'RADDAR Reports octubre 2025', pagina: 9 }],
    },
    {
      id: 't3', eje: 'Estrategia',
      titulo: 'Transparencia radical de la cadena',
      descripcion: 'Publicar precios, márgenes y condiciones del productor como diferencial competitivo y no como obligación regulatoria.',
      fuentes: [{ doc: 'Good Deed Economy · TrendWatching', pagina: 24 }],
    },
    {
      id: 't4', eje: 'Estrategia',
      titulo: 'Conveniencia sin renunciar a lo fresco',
      descripcion: 'El formato listo para consumir deja de asociarse a lo procesado; gana quien resuelve la fricción sin perder la percepción de fresco.',
      fuentes: [
        { doc: 'VML The Future Shopper Report 2025', pagina: 44 },
        { doc: 'Mintel 2026 Global Consumer Predictions', pagina: 18 },
      ],
    },
    {
      id: 't5', eje: 'Comunicación',
      titulo: 'El productor como creador',
      descripcion: 'La autoridad de la marca se construye en formato corto y en primera persona, desde el campo y no desde el estudio.',
      fuentes: [{ doc: 'Social Media Study 2026', pagina: 37 }, { doc: '2026 Social Trends Report' }],
    },
    {
      id: 't6', eje: 'Comunicación',
      titulo: 'Vocabulario sin promesa',
      descripcion: 'Retirada del lenguaje de milagro nutricional por presión regulatoria y por fatiga del consumidor.',
      fuentes: [{ doc: 'RADDAR Reports octubre 2025', pagina: 22 }],
    },
  ],
}

async function main() {
  const nombre = process.argv[2]
  if (!nombre) {
    console.error('Falta el nombre del proyecto. Uso: npm run seed:landscape -- "Fruta Viva"')
    process.exit(1)
  }

  const proyectos = await listProjects(db)
  const objetivo = proyectos.find(
    (p: { id: string; name: string }) => normalizeCompanyName(p.name) === normalizeCompanyName(nombre),
  )
  if (!objetivo) {
    console.error(`No encontré el proyecto "${nombre}". Los que hay:`)
    for (const p of proyectos as { name: string }[]) console.error(`  · ${p.name}`)
    process.exit(1)
  }

  const setup = await saveLandscapeVersion(db, objetivo.id, 'setup', {
    content: { carpeta_dropbox: `/Clientes/${objetivo.name}/Fase 01 Landscape`, deck: `${objetivo.name} — Landscape.key` },
    author: 'claude',
  })
  await approveLandscapeVersion(db, setup.id, { projectId: objetivo.id, stage: 'setup' })

  const contexto = await saveLandscapeVersion(db, objetivo.id, 'contexto', { content: CONTEXTO, author: 'claude' })
  await approveLandscapeVersion(db, contexto.id, { projectId: objetivo.id, stage: 'contexto' })

  await saveLandscapeVersion(db, objetivo.id, 'tendencias', { content: TENDENCIAS, author: 'claude' })
  await setStageStatus(db, objetivo.id, 'diagnostico', 'no_aplica')

  console.log(`Listo. Abrí /admin/projects/${objetivo.id}/landscape`)
}

main()

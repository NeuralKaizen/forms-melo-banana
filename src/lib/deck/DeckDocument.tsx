import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { DeckView, DeckSection, DeckBlock, DeckItem } from './view-model'
import type { Origen } from '@/lib/deliverable/schema'

const C = {
  banana: '#ffd400',
  ink: '#1a1510',
  cream: '#fffdf2',
  gray: '#6b6155',
  border: '#e6dfd0',
}

const ORIGEN_LABEL: Partial<Record<Origen, string>> = {
  equipo: 'propuesta del equipo',
  pendiente: 'pendiente del taller',
}

const s = StyleSheet.create({
  page: { paddingBottom: 46, backgroundColor: C.cream, color: C.ink, fontFamily: 'Helvetica', fontSize: 11 },
  body: { paddingHorizontal: 44, paddingTop: 34 },

  // Portada
  cover: { backgroundColor: C.ink, height: '100%', justifyContent: 'flex-end', padding: 44 },
  coverBar: { width: 90, height: 10, backgroundColor: C.banana, marginBottom: 18 },
  coverTitle: { fontFamily: 'Times-Roman', fontSize: 34, color: C.cream },
  coverBrand: { fontFamily: 'Helvetica-Bold', fontSize: 15, color: C.banana, marginTop: 16 },
  coverDate: { fontSize: 10, color: '#9a9186', marginTop: 6 },

  // Divisor de sección: campo amarillo, número gigante detrás
  divider: { backgroundColor: C.banana, height: '100%', justifyContent: 'center', padding: 44 },
  divNum: { position: 'absolute', right: 24, bottom: -10, fontFamily: 'Times-Roman', fontSize: 190, color: C.ink, opacity: 0.12 },
  divKicker: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: C.ink, opacity: 0.6, letterSpacing: 2, marginBottom: 12 },
  divTitle: { fontFamily: 'Times-Roman', fontSize: 30, color: C.ink, maxWidth: '80%' },

  // Contenido
  secHead: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: C.gray, letterSpacing: 1.5, marginBottom: 18 },
  blockTitle: { fontFamily: 'Times-Roman', fontSize: 14, marginTop: 20, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 5 },
  parrafo: { fontSize: 12, lineHeight: 1.5 },

  item: { flexDirection: 'row', marginTop: 9 },
  bullet: { width: 12, fontSize: 11, color: C.banana },
  itemBody: { flex: 1 },
  itemText: { fontSize: 11.5, lineHeight: 1.45 },
  // Sin fontStyle italic: obligaría a registrar Helvetica-Oblique. El gris + la etiqueta ya distinguen.
  itemTextPend: { fontSize: 11.5, lineHeight: 1.45, color: C.gray },
  cita: { fontSize: 10, color: C.gray, marginTop: 3, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: C.banana, lineHeight: 1.4 },
  tag: { fontSize: 8, color: C.gray, marginTop: 3, letterSpacing: 0.4 },

  // Tabla JTBD
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 7 },
  th: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: C.gray, letterSpacing: 0.6 },
  cell: { fontSize: 10, lineHeight: 1.4, paddingRight: 8 },
  c1: { width: '30%' }, c2: { width: '30%' }, c3: { width: '40%' },

  error: { backgroundColor: '#fff4f4', borderWidth: 1, borderColor: '#f0d0d0', padding: 12, fontSize: 10, color: '#8a3a3a', marginTop: 16 },
  foot: { position: 'absolute', bottom: 18, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between', fontSize: 9, color: C.gray },
})

function ItemRow({ it }: { it: DeckItem }) {
  const pend = it.origen === 'pendiente'
  return (
    <View style={s.item} wrap={false}>
      <Text style={s.bullet}>—</Text>
      <View style={s.itemBody}>
        <Text style={pend ? s.itemTextPend : s.itemText}>{it.texto}</Text>
        {!!it.cita && <Text style={s.cita}>&ldquo;{it.cita}&rdquo;</Text>}
        {!!ORIGEN_LABEL[it.origen] && <Text style={s.tag}>{ORIGEN_LABEL[it.origen]}</Text>}
      </View>
    </View>
  )
}

function Block({ b }: { b: DeckBlock }) {
  return (
    <View>
      <Text style={s.blockTitle} wrap={false}>{b.titulo}</Text>
      {!!b.parrafo && <Text style={s.parrafo}>{b.parrafo}</Text>}
      {b.items.map((it, i) => <ItemRow key={i} it={it} />)}
    </View>
  )
}

function Divider({ sec }: { sec: DeckSection }) {
  return (
    <Page size="A4" style={{ padding: 0 }}>
      <View style={s.divider}>
        <Text style={s.divNum}>{`0${sec.numero}`}</Text>
        <Text style={s.divKicker}>TALLER PROPUESTA DE VALOR</Text>
        <Text style={s.divTitle}>{sec.titulo}</Text>
      </View>
    </Page>
  )
}

function Tabla({ filas }: { filas: DeckSection['tabla'] }) {
  if (!filas.length) return null
  return (
    <View>
      <Text style={s.blockTitle} wrap={false}>Cómo lo resolvemos, trabajo por trabajo</Text>
      <View style={[s.row, { borderBottomColor: C.ink }]} wrap={false}>
        <Text style={[s.th, s.c1]}>JOB TO BE DONE</Text>
        <Text style={[s.th, s.c2]}>SOLUCIÓN</Text>
        <Text style={[s.th, s.c3]}>CÓMO SE RESUELVE</Text>
      </View>
      {filas.map((f, i) => (
        // Sin wrap={false}: `comoSeResuelve` es texto libre generado por un LLM,
        // sin tope de longitud. Si la fila no pudiera partirse entre páginas y
        // no entrara en el espacio restante, react-pdf la recorta en vez de
        // fluirla a la página siguiente.
        <View key={i} style={s.row}>
          <Text style={[s.cell, s.c1]}>{f.job}</Text>
          <Text style={[s.cell, s.c2]}>{f.solucion}</Text>
          <View style={s.c3}>
            <Text style={s.cell}>{f.comoSeResuelve}</Text>
            {!!ORIGEN_LABEL[f.origen] && <Text style={s.tag}>{ORIGEN_LABEL[f.origen]}</Text>}
          </View>
        </View>
      ))}
    </View>
  )
}

export function DeckDocument({ view }: { view: DeckView }) {
  return (
    <Document title={`Taller Propuesta de Valor — ${view.marca}`}>
      <Page size="A4" style={{ padding: 0 }}>
        <View style={s.cover}>
          <View style={s.coverBar} />
          <Text style={s.coverTitle}>Taller de{'\n'}Propuesta de Valor</Text>
          <Text style={s.coverBrand}>{view.marca}</Text>
          <Text style={s.coverDate}>{view.fecha}</Text>
        </View>
      </Page>

      {/* flatMap, no fragmentos: <Document> espera <Page> como hijos directos. */}
      {view.secciones.flatMap(sec => [
        <Divider key={`d${sec.numero}`} sec={sec} />,
        <Page key={`p${sec.numero}`} size="A4" style={s.page}>
          <View style={s.body}>
            <Text style={s.secHead}>{`PARTE 0${sec.numero} · ${sec.titulo.toUpperCase()}`}</Text>
            {sec.error
              ? <Text style={s.error}>{`Esta parte no se pudo generar: ${sec.error}`}</Text>
              : (
                <>
                  {sec.blocks.map((b, i) => <Block key={i} b={b} />)}
                  <Tabla filas={sec.tabla} />
                </>
              )}
          </View>
          <View style={s.foot} fixed>
            <Text>Mellow &amp; Banana · Branding</Text>
            <Text>{view.marca}</Text>
          </View>
        </Page>,
      ])}
    </Document>
  )
}

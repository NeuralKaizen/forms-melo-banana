import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { BriefView } from './answers-view'

const C = { ink: '#1F1B14', gray: '#9A917D', cream: '#FAF6EC', banana: '#E9B949', border: '#ECE4D2', secGray: '#B9AF98', foot: '#BCB29C' }

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 46, fontFamily: 'Helvetica', color: C.ink, fontSize: 11 },
  // La franja va fija y absoluta: en flujo sólo saldría en la primera página, y el
  // `paddingTop` de la página la empujaría hacia abajo en vez de dejarla al borde.
  band: { position: 'absolute', top: 0, left: 0, right: 0, height: 10, backgroundColor: C.banana },
  body: { paddingHorizontal: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  logo: { width: 46, height: 46, borderRadius: 8, backgroundColor: C.banana, alignItems: 'center', justifyContent: 'center' },
  logoTxt: { fontFamily: 'Times-Roman', fontSize: 8, color: '#ffffff', textAlign: 'center' },
  title: { fontFamily: 'Times-Roman', fontSize: 20 },
  subtitle: { color: C.gray, fontSize: 10, marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, marginBottom: 4 },
  metaLabel: { color: C.gray, fontSize: 9 },
  metaVal: { fontSize: 12 },
  secTitle: { fontFamily: 'Times-Roman', fontSize: 12, color: C.secGray, textTransform: 'uppercase', letterSpacing: 1, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 6, marginTop: 30, marginBottom: 10 },
  q: { color: C.gray, fontSize: 10, marginTop: 14 },
  a: { fontSize: 12, marginTop: 3, lineHeight: 1.4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.cream, borderWidth: 1, borderColor: C.border, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 },
  chipLabel: { color: C.gray, fontSize: 9 },
  chipVal: { fontSize: 11 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  foot: { position: 'absolute', bottom: 18, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8, fontSize: 9, color: C.foot },
})

// Puntos que tienen que quedar libres debajo de un título o una pregunta para que no
// terminen solos al pie de la página: un par de líneas de la respuesta que introducen.
const TITLE_AHEAD = 56
const PROMPT_AHEAD = 34

export function BriefDocument({ view }: { view: BriefView }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed />
        <View style={s.body}>
          <View style={s.header}>
            <View style={s.logo}><Text style={s.logoTxt}>Mellow{'\n'}& Banana</Text></View>
            <View>
              <Text style={s.title}>Brief de entrevista</Text>
              <Text style={s.subtitle}>Ejercicio proyectivo de marca</Text>
            </View>
          </View>

          <View style={s.metaRow}>
            <View><Text style={s.metaLabel}>Empresa</Text><Text style={s.metaVal}>{view.company}</Text></View>
            {!!view.contact && <View><Text style={s.metaLabel}>Contacto</Text><Text style={s.metaVal}>{view.contact}</Text></View>}
            {!!view.email && <View><Text style={s.metaLabel}>Correo</Text><Text style={s.metaVal}>{view.email}</Text></View>}
            {!!view.date && <View><Text style={s.metaLabel}>Fecha</Text><Text style={s.metaVal}>{view.date}</Text></View>}
          </View>

          {view.sections.map((sec, i) => (
            <View key={i}>
              {/* Nada de `wrap={false}` acá: una respuesta normalizada puede ser más alta que
                  una página entera, y un bloque que no puede partirse se desborda por abajo y
                  el siguiente se dibuja encima. Con `minPresenceAhead` alcanza: el título y la
                  pregunta arrastran las primeras líneas de la respuesta, y el resto fluye. */}
              <Text style={s.secTitle} minPresenceAhead={TITLE_AHEAD}>{sec.title}</Text>
              {sec.items.map((it, j) => (
                <View key={j}>
                  <Text style={s.q} minPresenceAhead={PROMPT_AHEAD}>{it.prompt}</Text>
                  <Text style={s.a}>{it.answer}</Text>
                </View>
              ))}
            </View>
          ))}

          {view.projective.length > 0 && (
            <>
              <View>
                <Text style={s.secTitle} minPresenceAhead={TITLE_AHEAD}>Ejercicio proyectivo</Text>
                <View style={s.chips} wrap={false}>
                  {view.projective.map((c, i) => (
                    <View key={i} style={s.chip}>
                      <Text style={s.chipLabel}>{c.label}</Text>
                      {!!c.swatch && <View style={[s.swatch, { backgroundColor: c.swatch }]} />}
                      <Text style={s.chipVal}>{c.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
              {view.projectiveReasons.map((r, i) => (
                <View key={i}>
                  <Text style={s.q} minPresenceAhead={PROMPT_AHEAD}>{r.prompt}</Text>
                  <Text style={s.a}>{r.answer}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={s.foot} fixed>
          <Text>Mellow & Banana · Branding</Text>
          <Text>Entrevista completada</Text>
        </View>
      </Page>
    </Document>
  )
}

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { BriefView } from './answers-view'

const C = { ink: '#1F1B14', gray: '#9A917D', cream: '#FAF6EC', banana: '#E9B949', border: '#ECE4D2', secGray: '#B9AF98', foot: '#BCB29C' }

const s = StyleSheet.create({
  page: { paddingBottom: 46, fontFamily: 'Helvetica', color: C.ink, fontSize: 11 },
  band: { height: 10, backgroundColor: C.banana },
  body: { paddingHorizontal: 40, paddingTop: 24 },
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

export function BriefDocument({ view }: { view: BriefView }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.band} />
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
              {/* Título + primera pregunta juntos: el título nunca queda huérfano al pie.
                  El resto de las preguntas fluye libremente entre páginas. */}
              <View wrap={false}>
                <Text style={s.secTitle}>{sec.title}</Text>
                {sec.items[0] && (
                  <View>
                    <Text style={s.q}>{sec.items[0].prompt}</Text>
                    <Text style={s.a}>{sec.items[0].answer}</Text>
                  </View>
                )}
              </View>
              {sec.items.slice(1).map((it, j) => (
                <View key={j} wrap={false}>
                  <Text style={s.q}>{it.prompt}</Text>
                  <Text style={s.a}>{it.answer}</Text>
                </View>
              ))}
            </View>
          ))}

          {view.projective.length > 0 && (
            <>
              <View wrap={false}>
                <Text style={s.secTitle}>Ejercicio proyectivo</Text>
                <View style={s.chips}>
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
                <View key={i} wrap={false}>
                  <Text style={s.q}>{r.prompt}</Text>
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

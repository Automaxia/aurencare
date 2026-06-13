import 'server-only'
import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

/**
 * PDF da transcrição da sessão — texto corrido em turnos (Psicóloga / Paciente).
 * Documento de apoio (não é o relatório formal CFP). Cabeçalho com paciente,
 * número da sessão e data; rodapé com paginação.
 */

export type TranscricaoPdfInput = {
  psicologo: { nome: string; crp: string }
  pacienteNome: string
  numero: number
  dataHora: string
  turnos: Array<{ who: 'psicologo' | 'paciente'; texto: string }>
}

const C = {
  ink: '#1a1825', inkSoft: '#38324e', muted: '#7a7590',
  accent: '#6a4ec8', accentDark: '#291860', sage: '#5a9e8a',
  border: '#e6e3d8', page: '#fdfcf9',
}

const s = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 52, paddingHorizontal: 48, fontSize: 10.5, fontFamily: 'Helvetica', color: C.ink, lineHeight: 1.55, backgroundColor: C.page },
  wordmark: { fontFamily: 'Times-Roman', fontSize: 15, color: C.accentDark, marginBottom: 2 },
  rotulo: { fontSize: 8, color: C.muted, letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'Helvetica-Bold' },
  titulo: { fontSize: 20, fontFamily: 'Times-Roman', color: C.accentDark, marginTop: 14 },
  sub: { fontSize: 10, color: C.muted, marginTop: 4, marginBottom: 18 },
  hr: { borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 16 },
  turn: { flexDirection: 'row', marginBottom: 9 },
  who: { width: 64, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  whoPsic: { color: C.accent },
  whoPac: { color: C.sage },
  fala: { flex: 1, color: C.inkSoft },
  vazio: { color: C.muted, fontStyle: 'italic' },
  rodape: { position: 'absolute', bottom: 24, left: 48, right: 48, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: C.muted },
})

export function TranscricaoSessaoPDF({ d }: { d: TranscricaoPdfInput }) {
  const data = new Date(d.dataHora).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.wordmark}>Audere</Text>
        <Text style={s.rotulo}>Transcrição da sessão</Text>
        <Text style={s.titulo}>{d.pacienteNome}</Text>
        <Text style={s.sub}>Sessão #{d.numero} · {data} · {d.psicologo.nome} (CRP {d.psicologo.crp})</Text>
        <View style={s.hr} />

        {d.turnos.length === 0 ? (
          <Text style={s.vazio}>Sem transcrição registrada.</Text>
        ) : (
          d.turnos.map((t, i) => (
            <View key={i} style={s.turn} wrap={false}>
              <Text style={[s.who, t.who === 'psicologo' ? s.whoPsic : s.whoPac]}>
                {t.who === 'psicologo' ? 'Psicóloga' : 'Paciente'}
              </Text>
              <Text style={s.fala}>{t.texto}</Text>
            </View>
          ))
        )}

        <View style={s.rodape} fixed>
          <Text>Audere · documento de apoio · não substitui avaliação clínica (CFP 09/2024)</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

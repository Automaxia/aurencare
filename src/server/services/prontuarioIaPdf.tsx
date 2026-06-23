import 'server-only'
import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, Svg, Path, Circle, Rect, G,
} from '@react-pdf/renderer'

/**
 * PDF do prontuário em formato NARRATIVO — gerado a partir do texto livre
 * produzido pela IA assistente. Compartilha o branding do template formal
 * (capa, cabeçalho/rodapé), mas o corpo é texto corrido em parágrafos.
 *
 * Marca explícita "Rascunho elaborado com apoio de IA — revisar antes de
 * assinar" no topo do corpo. Mesma referência CFP 09/2024.
 */

export type ProntuarioIaPdfInput = {
  psicologo: { nome: string; crp: string; email: string; telefone: string | null }
  paciente:  { nome: string; cadastradoEm: string }
  /** Texto livre redigido pela psicóloga (com apoio da IA). */
  texto:     string
  /** Título opcional do documento (default: "Prontuário psicológico — narrativa"). */
  titulo?:   string
  /** Hash de integridade do texto final. */
  hash:      string
  geradoEm:  string
}

const C = {
  ink: '#1a1825',
  inkSoft: '#38324e',
  muted: '#7a7590',
  faint: '#b0acc4',
  accent: '#6a4ec8',
  accentDark: '#291860',
  accentLo: '#f0eef9',
  amber: '#b07d40',
  amberLo: '#f6efe0',
  border: '#e6e3d8',
  surface: '#f5f2ea',
  card: '#ffffff',
  page: '#fdfcf9',
}

const s = StyleSheet.create({
  page: {
    paddingTop: 56, paddingBottom: 56, paddingLeft: 56, paddingRight: 56,
    fontSize: 11, fontFamily: 'Helvetica',
    color: C.ink, lineHeight: 1.65,
    backgroundColor: C.page,
  },

  // Capa
  capaTopo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 60 },
  capaWordmark: { fontFamily: 'Times-Roman', fontSize: 18, color: C.accentDark },
  capaWordmarkBold: { fontFamily: 'Times-Bold', fontSize: 18, color: C.accent },
  capaRotulo: {
    fontSize: 9, color: C.muted, letterSpacing: 3, textTransform: 'uppercase',
    marginBottom: 14, fontFamily: 'Helvetica-Bold',
  },
  capaTitulo: {
    fontSize: 34, fontFamily: 'Times-Roman', color: C.accentDark,
    marginBottom: 4, letterSpacing: -0.5, lineHeight: 1.1,
  },
  capaTituloAlt: { fontFamily: 'Times-Italic', fontSize: 34, color: C.accent },
  capaPaciente: {
    fontSize: 26, fontFamily: 'Times-Italic', color: C.inkSoft,
    marginTop: 8, marginBottom: 36,
  },
  capaBox: {
    padding: 22, borderRadius: 4, backgroundColor: C.card,
    border: `1pt solid ${C.border}`,
  },
  capaBoxTit: {
    fontSize: 9, color: C.muted, letterSpacing: 2, textTransform: 'uppercase',
    marginBottom: 12, fontFamily: 'Helvetica-Bold',
  },
  capaLinha: { flexDirection: 'row', marginBottom: 8 },
  capaLbl: { width: 130, fontSize: 9, color: C.muted },
  capaVal: { flex: 1, fontSize: 11, color: C.ink, fontFamily: 'Helvetica-Bold' },
  capaRodape: {
    position: 'absolute', bottom: 56, left: 56, right: 56,
    paddingTop: 14, borderTop: `0.5pt solid ${C.border}`,
    fontSize: 8, color: C.faint, lineHeight: 1.6, textAlign: 'justify',
  },

  // Cabeçalho/rodapé internos
  cabecalho: {
    position: 'absolute', top: 22, left: 56, right: 56,
    flexDirection: 'row', justifyContent: 'space-between',
    fontSize: 8, color: C.faint,
    paddingBottom: 6, borderBottom: `0.3pt solid ${C.border}`,
  },
  rodape: {
    position: 'absolute', bottom: 22, left: 56, right: 56,
    flexDirection: 'row', justifyContent: 'space-between',
    fontSize: 7, color: C.faint,
    paddingTop: 6, borderTop: `0.3pt solid ${C.border}`,
  },

  // Aviso "RASCUNHO IA" no topo do corpo
  alertaIa: {
    flexDirection: 'row', gap: 10, alignItems: 'center',
    padding: 12, borderRadius: 6,
    backgroundColor: C.amberLo, border: `0.5pt solid #d9bf80`,
    marginBottom: 24,
  },
  alertaIco: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#7a5520',
    justifyContent: 'center', alignItems: 'center',
  },
  alertaIcoTxt: { color: 'white', fontSize: 11, fontFamily: 'Helvetica-Bold' },
  alertaTexto: { flex: 1, fontSize: 9, color: '#7a5520', lineHeight: 1.5 },

  // Corpo narrativo
  paragrafo: {
    fontSize: 11, color: C.ink, lineHeight: 1.65,
    textAlign: 'justify', marginBottom: 12,
  },

  // Bloco de assinatura
  assinaturaBloco: {
    marginTop: 60, paddingTop: 30,
  },
  linhaAssinatura: {
    borderTop: `0.5pt solid ${C.ink}`,
    width: 300, marginBottom: 6,
  },
  assinaturaNome: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.ink },
  assinaturaCRP: { fontSize: 9, color: C.muted, marginTop: 2 },
})

function AudereMark({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 50 50">
      <Rect x={0} y={0} width={50} height={50} rx={10} fill="#7b5ee8" />
      <G>
        <Path d="M 25 38 C 25 38 14 38 14 27 C 14 16 25 16 25 16"
          stroke="white" strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.5} />
        <Path d="M 25 16 C 25 16 36 16 36 27 C 36 38 25 44 12 42"
          stroke="white" strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.75} />
        <Path d="M 12 42 C 4 40 4 28 4 24 C 4 12 14 6 26 6 C 38 6 46 14 46 26"
          stroke="white" strokeWidth={2.2} strokeLinecap="round" fill="none" />
        <Circle cx={46} cy={26} r={3} fill="white" />
      </G>
    </Svg>
  )
}

export function ProntuarioIaPDF(input: ProntuarioIaPdfInput) {
  const titulo = input.titulo ?? 'Prontuário psicológico — narrativa'
  // Quebra texto em parágrafos por linha em branco (e/ou quebra simples)
  const paragrafos = input.texto
    .split(/\n\s*\n/g)
    .map(p => p.trim())
    .filter(Boolean)

  return (
    <Document
      title={`Prontuário (narrativa) — ${input.paciente.nome}`}
      author={input.psicologo.nome}
      subject="Prontuário psicológico em formato narrativo"
      creator="Audere"
    >
      {/* Capa */}
      <Page size="A4" style={s.page}>
        <View style={s.capaTopo}>
          <AudereMark size={32} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={s.capaWordmark}>Au</Text>
            <Text style={s.capaWordmarkBold}>dere</Text>
          </View>
        </View>

        <Text style={s.capaRotulo}>Documento clínico · narrativa assistida por IA</Text>
        <Text style={s.capaTitulo}>
          {titulo.split('—')[0].trim()} <Text style={s.capaTituloAlt}>{titulo.split('—')[1]?.trim() ?? ''}</Text>
        </Text>
        <Text style={s.capaPaciente}>{input.paciente.nome}</Text>

        <View style={s.capaBox}>
          <Text style={s.capaBoxTit}>Identificação</Text>
          <View style={s.capaLinha}>
            <Text style={s.capaLbl}>Profissional</Text>
            <Text style={s.capaVal}>{input.psicologo.nome}</Text>
          </View>
          <View style={s.capaLinha}>
            <Text style={s.capaLbl}>Registro CRP</Text>
            <Text style={s.capaVal}>{input.psicologo.crp}</Text>
          </View>
          <View style={s.capaLinha}>
            <Text style={s.capaLbl}>Atendimento iniciado</Text>
            <Text style={s.capaVal}>{formatLonga(input.paciente.cadastradoEm)}</Text>
          </View>
          <View style={s.capaLinha}>
            <Text style={s.capaLbl}>Documento emitido</Text>
            <Text style={s.capaVal}>{formatLonga(input.geradoEm)}</Text>
          </View>
        </View>

        <Text style={s.capaRodape}>
          Documento elaborado em conformidade com a Resolução CFP nº 06/2019 (elaboração de
          documentos escritos) e a Resolução CFP nº 09/2024 (uso de IA — sem diagnóstico). A
          redação foi assistida por inteligência artificial e revisada pelo(a) psicólogo(a)
          responsável, que se responsabiliza pelo conteúdo final.
          Integridade verificável pelo hash no rodapé: {input.hash}.
        </Text>
      </Page>

      {/* Corpo narrativo */}
      <Page size="A4" style={s.page}>
        <View style={s.cabecalho} fixed>
          <Text>{titulo} · {input.paciente.nome}</Text>
          <Text>{input.psicologo.nome} · {input.psicologo.crp}</Text>
        </View>

        <View style={s.alertaIa}>
          <View style={s.alertaIco}><Text style={s.alertaIcoTxt}>!</Text></View>
          <Text style={s.alertaTexto}>
            Rascunho elaborado com apoio de IA assistente (CFP 09/2024).
            A IA é apoio à redação; a interpretação clínica, decisões e
            responsabilidade pelo conteúdo são do(a) psicólogo(a) que assina abaixo.
          </Text>
        </View>

        {paragrafos.map((p, i) => (
          <Text key={i} style={s.paragrafo}>{p}</Text>
        ))}

        <View style={s.assinaturaBloco} wrap={false}>
          <View style={s.linhaAssinatura} />
          <Text style={s.assinaturaNome}>{input.psicologo.nome}</Text>
          <Text style={s.assinaturaCRP}>{input.psicologo.crp}</Text>
        </View>

        <View style={s.rodape} fixed>
          <Text>Gerado em {formatHora(input.geradoEm)} · integridade {input.hash.slice(0, 12)}</Text>
          <Text render={({ pageNumber, totalPages }) => `página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

function formatLonga(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo',
    })
  } catch { return iso }
}
function formatHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
    })
  } catch { return iso }
}

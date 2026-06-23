import 'server-only'
import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, Svg, Path, Circle, Rect, G,
} from '@react-pdf/renderer'
import type { ExportacaoMensal } from './exportacaoContabil'

/**
 * Relatório mensal formal pra contador. Documento sucinto, focado em
 * totais + lista de cobranças. Estética azul institucional (mesma do
 * Relatório de Sessão), pra dar peso documental.
 */

const C = {
  ink: '#222',
  inkSoft: '#3a3650',
  mute: '#595959',
  faint: '#9a9a9a',
  tituloAzul: '#1F3864',
  secaoAzul:  '#2E74B5',
  border:  '#d9d9d9',
  surface: '#f5f5f5',
  page: '#ffffff',
  sage: '#5a9e8a',
  rose: '#c4607a',
  amber: '#b07d40',
}

const s = StyleSheet.create({
  page: {
    paddingTop: 56, paddingBottom: 60,
    paddingLeft: 48, paddingRight: 48,
    fontSize: 10, fontFamily: 'Helvetica',
    color: C.ink, lineHeight: 1.4,
    backgroundColor: C.page,
  },

  // Brand topo
  brand: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 24,
  },
  brandWord:  { fontFamily: 'Times-Roman', fontSize: 14, color: C.tituloAzul },
  brandBold:  { fontFamily: 'Times-Bold',  fontSize: 14, color: C.secaoAzul },

  // Título doc
  docTitulo: {
    fontFamily: 'Helvetica-Bold', fontSize: 18,
    color: C.tituloAzul, textAlign: 'center', letterSpacing: 1.2,
    marginBottom: 4,
  },
  docSubtitulo: {
    fontFamily: 'Helvetica-Oblique', fontSize: 11, color: C.mute,
    textAlign: 'center', marginBottom: 24,
  },

  secaoTitulo: {
    fontFamily: 'Helvetica-Bold', fontSize: 12, color: C.secaoAzul,
    paddingBottom: 3, borderBottom: `1pt solid ${C.secaoAzul}`,
    marginTop: 18, marginBottom: 10,
  },

  // Linhas com label
  campoLinha: { fontSize: 10, marginBottom: 3, lineHeight: 1.4 },
  campoLabel: { fontFamily: 'Helvetica-Bold' },

  // KPI box
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  kpi: {
    flex: 1, padding: 12, border: `0.5pt solid ${C.border}`, borderRadius: 4,
  },
  kpiLbl: {
    fontSize: 8, color: C.mute, marginBottom: 3,
    textTransform: 'uppercase', letterSpacing: 0.6,
    fontFamily: 'Helvetica-Bold',
  },
  kpiVal: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.tituloAzul },

  // Tabela
  tabela: { border: `0.5pt solid ${C.border}`, borderRadius: 4, overflow: 'hidden' },
  trHead: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderBottom: `0.5pt solid ${C.border}`,
  },
  th: {
    fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.mute,
    paddingVertical: 6, paddingHorizontal: 8,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  tr: {
    flexDirection: 'row',
    borderBottom: `0.3pt solid ${C.border}`,
  },
  td: {
    fontSize: 8.5, paddingVertical: 5, paddingHorizontal: 8, color: C.ink,
  },
  totaisRow: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderTop: `0.5pt solid ${C.border}`,
    paddingVertical: 6,
  },
  totaisTxt: {
    fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.tituloAzul,
    paddingHorizontal: 8,
  },

  observacao: {
    marginTop: 16, padding: 10, borderRadius: 4,
    backgroundColor: '#fdf7eb',
    border: '0.5pt solid #e0c98a',
    fontSize: 9, color: '#7a5520', lineHeight: 1.55,
  },

  rodape: {
    position: 'absolute', bottom: 22, left: 48, right: 48,
    flexDirection: 'row', justifyContent: 'space-between',
    fontSize: 7, color: C.faint,
    paddingTop: 6, borderTop: '0.3pt solid #d0d0d0',
  },
})

// ─── Helpers de formato ──────────────────────────────────────────────

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}
function nfBadge(status: string): { txt: string; cor: string } {
  if (status === 'emitida')    return { txt: 'EMITIDA',    cor: C.sage }
  if (status === 'dispensada') return { txt: 'DISPENSADA', cor: C.mute }
  return { txt: 'PENDENTE', cor: C.amber }
}

function AudereLogo({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 50 50">
      <Rect x={0} y={0} width={50} height={50} rx={8} fill={C.tituloAzul} />
      <G>
        <Path d="M 25 38 C 25 38 14 38 14 27 C 14 16 25 16 25 16"
          stroke="white" strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.55} />
        <Path d="M 25 16 C 25 16 36 16 36 27 C 36 38 25 44 12 42"
          stroke="white" strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.8} />
        <Path d="M 12 42 C 4 40 4 28 4 24 C 4 12 14 6 26 6 C 38 6 46 14 46 26"
          stroke="white" strokeWidth={2.2} strokeLinecap="round" fill="none" />
        <Circle cx={46} cy={26} r={3} fill="white" />
      </G>
    </Svg>
  )
}

// ─── Documento ───────────────────────────────────────────────────────

export function ExportacaoContabilPDF({ d }: { d: ExportacaoMensal }) {
  const totalLinhas = d.linhas.length

  return (
    <Document
      title={`Relatório financeiro — ${d.rotuloMes}`}
      author={d.psicologo.nome}
      subject={`Relatório mensal pro contador · ${d.rotuloMes}`}
      creator="Audere"
    >
      <Page size="A4" style={s.page}>
        {/* Brand */}
        <View style={s.brand}>
          <AudereLogo size={22} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={s.brandWord}>Au</Text>
            <Text style={s.brandBold}>dere</Text>
          </View>
        </View>

        {/* Título */}
        <Text style={s.docTitulo}>RELATÓRIO FINANCEIRO MENSAL</Text>
        <Text style={s.docSubtitulo}>{d.rotuloMes}</Text>

        {/* Identificação */}
        <Text style={s.secaoTitulo}>Identificação</Text>
        <Campo lbl="Profissional" val={`${d.psicologo.nome} — ${d.psicologo.crp}`} />
        <Campo lbl="Email" val={d.psicologo.email} />
        <Campo lbl="Regime tributário" val={d.psicologo.regimeLabel} />
        <Campo lbl="CNAE" val={d.psicologo.cnae} />
        {d.psicologo.municipio && (
          <Campo
            lbl="Município ISS"
            val={`${d.psicologo.municipio} / ${d.psicologo.municipioUf} · ${d.psicologo.issAliquotaPct ?? 0}%`}
          />
        )}
        {(d.psicologo.nomeContador || d.psicologo.emailContador) && (
          <Campo
            lbl="Contador"
            val={[d.psicologo.nomeContador, d.psicologo.emailContador].filter(Boolean).join(' · ')}
          />
        )}

        {/* KPIs */}
        <Text style={s.secaoTitulo}>Resumo do mês</Text>
        <View style={s.kpiRow}>
          <View style={s.kpi}>
            <Text style={s.kpiLbl}>Recebido bruto</Text>
            <Text style={s.kpiVal}>{brl(d.resumo.recebidoBruto)}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLbl}>Taxas Pagar.me</Text>
            <Text style={s.kpiVal}>− {brl(d.resumo.taxasEstimadas)}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLbl}>Líquido estimado</Text>
            <Text style={s.kpiVal}>{brl(d.resumo.liquidoEstimado)}</Text>
          </View>
        </View>

        <View style={s.kpiRow}>
          <View style={s.kpi}>
            <Text style={s.kpiLbl}>ISS estimado</Text>
            <Text style={s.kpiVal}>{brl(d.resumo.issEstimado)}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLbl}>{d.resumo.impostoLabel}</Text>
            <Text style={s.kpiVal}>{brl(d.resumo.impostoEstimado)}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLbl}>Sessões pagas no mês</Text>
            <Text style={s.kpiVal}>{totalLinhas}</Text>
          </View>
        </View>

        {/* Tabela */}
        {d.linhas.length > 0 ? (
          <>
            <Text style={s.secaoTitulo}>Detalhamento das cobranças</Text>
            <View style={s.tabela}>
              <View style={s.trHead} fixed>
                <Text style={[s.th, { width: '12%' }]}>Data</Text>
                <Text style={[s.th, { width: '7%' }]}>Sess.</Text>
                <Text style={[s.th, { width: '26%' }]}>Paciente</Text>
                <Text style={[s.th, { width: '14%' }]}>Método</Text>
                <Text style={[s.th, { width: '12%', textAlign: 'right' }]}>Bruto</Text>
                <Text style={[s.th, { width: '12%', textAlign: 'right' }]}>Líquido</Text>
                <Text style={[s.th, { width: '17%' }]}>NF</Text>
              </View>

              {d.linhas.map((l, i) => {
                const nf = nfBadge(l.nfStatus)
                return (
                  <View key={i} style={s.tr} wrap={false}>
                    <Text style={[s.td, { width: '12%' }]}>{formatDataBr(l.data)}</Text>
                    <Text style={[s.td, { width: '7%' }]}>#{l.sessaoNumero}</Text>
                    <Text style={[s.td, { width: '26%' }]}>{l.pacienteNome}</Text>
                    <Text style={[s.td, { width: '14%' }]}>{rotuloMetodo(l.metodo, l.parcelas)}</Text>
                    <Text style={[s.td, { width: '12%', textAlign: 'right' }]}>{brl(l.valorBruto)}</Text>
                    <Text style={[s.td, { width: '12%', textAlign: 'right' }]}>{brl(l.valorLiquido)}</Text>
                    <Text style={[s.td, { width: '17%', color: nf.cor, fontFamily: 'Helvetica-Bold' }]}>
                      {nf.txt}{l.nfNumero ? ` · ${l.nfNumero}` : ''}
                    </Text>
                  </View>
                )
              })}

              <View style={s.totaisRow}>
                <Text style={[s.totaisTxt, { width: '59%' }]}>TOTAIS</Text>
                <Text style={[s.totaisTxt, { width: '12%', textAlign: 'right' }]}>{brl(d.resumo.recebidoBruto)}</Text>
                <Text style={[s.totaisTxt, { width: '12%', textAlign: 'right' }]}>{brl(d.resumo.liquidoEstimado)}</Text>
                <Text style={[s.totaisTxt, { width: '17%' }]}> </Text>
              </View>
            </View>
          </>
        ) : (
          <View style={{ padding: 18, backgroundColor: C.surface, borderRadius: 4, marginTop: 12 }}>
            <Text style={{ fontSize: 10, color: C.mute }}>
              Sem cobranças pagas neste mês.
            </Text>
          </View>
        )}

        {/* Observação tributária */}
        {d.resumo.impostoObs && (
          <View style={s.observacao}>
            <Text>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>Observação tributária: </Text>
              {d.resumo.impostoObs} As estimativas são pra orientação. O cálculo final é
              responsabilidade do(a) contador(a).
            </Text>
          </View>
        )}

        {/* Rodapé */}
        <View style={s.rodape} fixed>
          <Text>
            Audere · Documento emitido em {new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

function Campo({ lbl, val }: { lbl: string; val: string }) {
  return (
    <Text style={s.campoLinha}>
      <Text style={s.campoLabel}>{lbl}:</Text> {val}
    </Text>
  )
}

function formatDataBr(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

function rotuloMetodo(m: string | null, parcelas: number): string {
  if (m === 'pix')     return 'PIX'
  if (m === 'debito')  return 'Débito'
  if (m === 'credito') return parcelas > 1 ? `Crédito ${parcelas}x` : 'Crédito'
  return '—'
}

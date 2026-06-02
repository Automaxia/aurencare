import 'server-only'
import React from 'react'
import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer'
import type { RelatorioSessaoDados } from './relatorioSessaoExport'

/**
 * Relatório de Sessão — layout fiel ao modelo RELATO2.HTM.
 *
 * Diretrizes visuais:
 *  - Paleta institucional azul (#1F3864 título, #2E74B5 seções)
 *  - Página única com identificação, demanda/objetivos, registro de evolução,
 *    encerramento e bloco de assinatura
 *  - Texto justificado, line-height generoso
 *  - Subseções com título italic-bold
 *  - Omite subseções sem conteúdo (não cria placeholder "—")
 *
 * Em conformidade com Resolução CFP nº 06/2019.
 */

const C = {
  ink: '#222',
  mute: '#595959',
  muteLight: '#888',
  bg: '#fff',
  tituloAzul: '#1F3864',
  secaoAzul:  '#2E74B5',
  rodape: '#9a9a9a',
}

const s = StyleSheet.create({
  page: {
    paddingTop: 56, paddingBottom: 60,
    paddingLeft: 64, paddingRight: 64,
    fontSize: 11, fontFamily: 'Helvetica',
    color: C.ink, lineHeight: 1.5,
    backgroundColor: C.bg,
  },

  // Cabeçalho do documento
  docTitulo: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 18, color: C.tituloAzul,
    textAlign: 'center', letterSpacing: 1.2,
    marginBottom: 4,
  },
  docSubtitulo: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 10, color: C.mute,
    textAlign: 'center', marginBottom: 32,
  },

  // Títulos de seção (com linha azul embaixo)
  secaoTitulo: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 13, color: C.secaoAzul,
    paddingBottom: 4,
    borderBottom: `1.5pt solid ${C.secaoAzul}`,
    marginTop: 24, marginBottom: 12,
  },

  // Subseção
  subTitulo: {
    fontFamily: 'Helvetica-BoldOblique',
    fontSize: 11, color: C.ink,
    marginTop: 14, marginBottom: 4,
  },

  // Campos de identificação
  campoLinha: {
    fontSize: 11, marginBottom: 4, lineHeight: 1.55,
  },
  campoLabel: {
    fontFamily: 'Helvetica-Bold',
  },

  // Corpo de texto justificado
  corpo: {
    fontSize: 11, color: C.ink, lineHeight: 1.65,
    textAlign: 'justify', marginBottom: 8,
  },

  // Assinatura
  assinaturaBloco: {
    marginTop: 50, paddingTop: 10,
    borderTop: `0.5pt solid ${C.muteLight}`,
    fontFamily: 'Helvetica-Oblique',
    fontSize: 10, color: C.mute,
    textAlign: 'center',
  },

  // Rodapé fixo (branding discreto + paginação + hash)
  rodapeFixo: {
    position: 'absolute', bottom: 22, left: 64, right: 64,
    flexDirection: 'row', justifyContent: 'space-between',
    fontSize: 7, color: C.rodape,
    paddingTop: 6, borderTop: '0.3pt solid #d0d0d0',
  },
})

export function RelatorioSessaoPDF({ d }: { d: RelatorioSessaoDados }) {
  const { psicologo, paciente, sessao, objetivosAtivos } = d
  const dataSessao = formatDataCurta(sessao.dataHora)
  const indicadoresTexto = formatIndicadores(sessao.indicadores)
  const objetivosFormatados = formatObjetivosTexto(objetivosAtivos)

  return (
    <Document
      title={`Relatório de sessão — ${paciente.nome}`}
      author={psicologo.nome}
      subject={`Sessão ${sessao.numero}`}
      creator="Auren Care"
    >
      <Page size="A4" style={s.page}>
        {/* ── Cabeçalho ───────────────────────────────────────────── */}
        <Text style={s.docTitulo}>RELATÓRIO DE SESSÃO</Text>
        <Text style={s.docSubtitulo}>Em acordo com o CFP</Text>

        {/* ── Identificação ──────────────────────────────────────── */}
        <Text style={s.secaoTitulo}>Identificação</Text>
        <Campo lbl="Nome"        val={paciente.nome} />
        {paciente.dataNascimento && <Campo lbl="Data de nascimento" val={formatDataCurta(paciente.dataNascimento)} />}
        {paciente.genero          && <Campo lbl="Gênero"            val={paciente.genero} />}
        {paciente.estadoCivil     && <Campo lbl="Estado civil"      val={paciente.estadoCivil} />}
        {paciente.ocupacao        && <Campo lbl="Ocupação"          val={paciente.ocupacao} />}
        {paciente.endereco        && <Campo lbl="Endereço"          val={paciente.endereco} />}
        <Campo lbl="Telefone"     val={formatTel(paciente.telefone)} />
        {paciente.cpf             && <Campo lbl="CPF"               val={paciente.cpf} />}
        {paciente.email           && <Campo lbl="E-mail"            val={paciente.email} />}
        <Campo lbl="Data da sessão" val={`${dataSessao} · ${sessao.duracaoMin}min · ${sessao.modalidade}`} />
        <Campo lbl="Profissional"  val={`${psicologo.nome} — ${psicologo.crp}`} />

        {/* ── 1. Demanda e objetivos ─────────────────────────────── */}
        <Text style={s.secaoTitulo}>1. Demanda e objetivos de trabalho</Text>

        {objetivosFormatados.queixa ? (
          <>
            <Text style={s.subTitulo}>Queixa:</Text>
            <Text style={s.corpo}>{objetivosFormatados.queixa}</Text>
          </>
        ) : (
          <>
            <Text style={s.subTitulo}>Queixa:</Text>
            <Text style={[s.corpo, { color: C.mute, fontStyle: 'italic' }]}>
              Queixa não registrada no sistema. Caso necessário, complementar à mão.
            </Text>
          </>
        )}

        {objetivosFormatados.objetivos.length > 0 && (
          <>
            <Text style={s.subTitulo}>Objetivos:</Text>
            <Text style={s.corpo}>{objetivosFormatados.objetivosTexto}</Text>
          </>
        )}

        {/* ── 2. Registro de evolução ────────────────────────────── */}
        <Text style={s.secaoTitulo}>2. Registro de evolução</Text>

        {sessao.resumo && (
          <>
            <Text style={s.subTitulo}>Resumo:</Text>
            <Text style={s.corpo}>{sessao.resumo}</Text>
          </>
        )}

        {indicadoresTexto && (
          <>
            <Text style={s.subTitulo}>Observações:</Text>
            <Text style={s.corpo}>{indicadoresTexto}</Text>
          </>
        )}

        {sessao.notaClinica && (
          <>
            <Text style={s.subTitulo}>Anotações:</Text>
            <Text style={s.corpo}>{sessao.notaClinica}</Text>
          </>
        )}

        {/* ── 3. Encerramento ────────────────────────────────────── */}
        {sessao.assinada && sessao.assinaturaEm && (
          <>
            <Text style={s.secaoTitulo}>3. Encerramento</Text>
            <Text style={s.corpo}>
              Sessão assinada eletronicamente em {formatDataHora(sessao.assinaturaEm)} por {psicologo.nome} ({psicologo.crp}).
            </Text>
          </>
        )}

        {/* ── Assinatura ─────────────────────────────────────────── */}
        <Text style={s.assinaturaBloco}>
          {dataSessao}
          {'\n\n'}
          ____________________________________________
          {'\n'}
          {psicologo.nome} — {psicologo.crp}
        </Text>

        {/* Rodapé fixo */}
        <View style={s.rodapeFixo} fixed>
          <Text>
            Documento emitido em {formatDataHora(d.geradoEm)} · Auren Care · integridade {d.hashIntegridade.slice(0, 12)}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

// ─── Campo "Nome: valor" inline ─────────────────────────────────────

function Campo({ lbl, val }: { lbl: string; val: string }) {
  return (
    <Text style={s.campoLinha}>
      <Text style={s.campoLabel}>{lbl}:</Text> {val}
    </Text>
  )
}

// ─── Helpers de texto ───────────────────────────────────────────────

function formatObjetivosTexto(objs: RelatorioSessaoDados['objetivosAtivos']): { queixa: string | null; objetivos: typeof objs; objetivosTexto: string } {
  if (objs.length === 0) {
    return { queixa: null, objetivos: [], objetivosTexto: '' }
  }
  // Queixa = junção das descrições dos objetivos ativos (a Relevância R do SMART)
  const queixas = objs.filter(o => o.descricao).map(o => o.descricao!.trim()).filter(Boolean)
  const queixa = queixas.length > 0 ? queixas.join(' ') : null

  // Objetivos formatados em parágrafo
  const linhas = objs.map(o => `• ${o.titulo} (${o.metricaResumo} — progresso ${o.progressoPct}%).`)
  return { queixa, objetivos: objs, objetivosTexto: linhas.join(' ') }
}

function formatIndicadores(ind: any): string | null {
  if (!ind) return null
  const partes: string[] = []
  const humor = ind?.humor
  if (humor?.estado != null) {
    const e = humor.estado
    if (e >= 3)       partes.push('humor relatado como agradável')
    else if (e >= 1)  partes.push('humor relatado como levemente agradável')
    else if (e <= -3) partes.push('humor relatado como desagradável')
    else if (e <= -1) partes.push('humor relatado como levemente desagradável')
    else              partes.push('humor relatado como neutro')
  }
  const ritmo = ind?.ritmo
  if (ritmo?.psicologo != null) {
    partes.push(`ritmo conversacional psicóloga ${ritmo.psicologo}% / paciente ${ritmo.paciente}%`)
  }
  const risco = ind?.risco
  if (risco) {
    const high = ['autolesao', 'ideacao', 'plano'].some(k => risco[k] === 'hi')
    const med  = ['autolesao', 'ideacao', 'plano'].some(k => risco[k] === 'md')
    if (high) partes.push('avaliação de risco em nível alto em ao menos uma dimensão')
    else if (med) partes.push('avaliação de risco em nível médio')
    else partes.push('avaliação de risco em nível baixo')
  }
  if (partes.length === 0) return null
  return partes.join('. ').replace(/(^|\. )([a-z])/g, (_, sep, c) => sep + c.toUpperCase()) + '.'
}

// ─── Formatadores de data/hora ──────────────────────────────────────

function formatDataCurta(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return iso }
}

function formatDataHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function formatTel(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return raw
}

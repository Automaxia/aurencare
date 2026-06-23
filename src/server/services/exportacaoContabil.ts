import 'server-only'
import { db } from '@/server/db/pool'
import { lerPerfilTributario, REGIME_LABELS, type RegimeTributario } from './perfilTributario'
import { lerVisaoContabil } from './visaoContabil'

/**
 * Exportações pro contador — CSV mensal + dados pro PDF resumo.
 *
 * CSV: separado por `;` (padrão Receita Saúde / Carnê-Leão / planilhas BR).
 * Header com metadados em comentários (#) + linha de cabeçalho + dados.
 *
 * PDF: usa coletarDadosMensais + ProntuarioMensalPdf (componente próximo).
 */

export type LinhaExportacao = {
  data: string         // YYYY-MM-DD
  hora: string         // HH:mm
  sessaoNumero: number
  pacienteNome: string
  pacienteCpf: string | null
  pacienteTelefone: string
  valorBruto: number
  metodo: string | null
  parcelas: number
  taxaEstimada: number
  valorLiquido: number
  statusPagamento: string
  nfStatus: string
  nfNumero: string | null
  nfEmitidaEm: string | null
  pagoEm: string | null
}

export type ExportacaoMensal = {
  ano: number
  mes: number             // 1-12
  rotuloMes: string       // "Maio 2026"
  psicologo: {
    nome: string
    crp: string
    email: string
    regime: RegimeTributario | null
    regimeLabel: string
    cnae: string
    municipio: string | null
    municipioUf: string | null
    issAliquotaPct: number | null
    nomeContador: string | null
    emailContador: string | null
  }
  resumo: {
    recebidoBruto: number
    taxasEstimadas: number
    liquidoEstimado: number
    issEstimado: number
    impostoEstimado: number
    impostoLabel: string
    impostoObs: string
  }
  linhas: LinhaExportacao[]
}

export async function coletarExportacaoMensal(
  psicologoId: string,
  ano: number,
  mesIdx0: number,   // 0-11
): Promise<ExportacaoMensal | null> {
  const inicio = new Date(ano, mesIdx0, 1, 0, 0, 0)
  const fim    = new Date(ano, mesIdx0 + 1, 0, 23, 59, 59, 999)
  const anchor = new Date(ano, mesIdx0 + 1, 0)

  const { rows: ps } = await db.query<{ nome: string; crp: string; email: string }>(
    `SELECT nome, crp, email FROM psicologos WHERE id = $1 LIMIT 1`,
    [psicologoId],
  )
  if (ps.length === 0) return null

  const perfil = await lerPerfilTributario(psicologoId)
  const visao = await lerVisaoContabil(psicologoId, anchor.toISOString())

  const { rows: sessoes } = await db.query<{
    id: string; numero: number; data_hora: string;
    valor: any; pagamento_status: string; pagamento_metodo: string | null;
    pagamento_parcelas: number; pago_em: string | null;
    nf_status: string | null; nf_numero: string | null; nf_emitida_em: string | null;
    pac_nome: string; pac_telefone: string; pac_condicoes: any;
  }>(
    `SELECT s.id, s.numero, s.data_hora,
            s.valor, s.pagamento_status, s.pagamento_metodo,
            s.pagamento_parcelas, s.pago_em,
            s.nf_status, s.nf_numero, s.nf_emitida_em,
            p.nome AS pac_nome, p.telefone AS pac_telefone, p.condicoes AS pac_condicoes
       FROM sessoes s JOIN pacientes p ON p.id = s.paciente_id
      WHERE s.psicologo_id = $1
        AND s.data_hora BETWEEN $2 AND $3
        AND s.pagamento_status = 'pago'
      ORDER BY s.data_hora ASC`,
    [psicologoId, inicio.toISOString(), fim.toISOString()],
  )

  const linhas: LinhaExportacao[] = sessoes.map(s => {
    const dt = new Date(s.data_hora)
    const valor = parseFloat(s.valor ?? 0)
    const parcelas = parseInt(String(s.pagamento_parcelas ?? 1), 10) || 1
    const tx = taxaPagarMe(s.pagamento_metodo, parcelas)
    const taxa = Math.round(valor * tx * 100) / 100
    return {
      data: dt.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
      hora: dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
      sessaoNumero: s.numero,
      pacienteNome: s.pac_nome,
      pacienteCpf: (s.pac_condicoes?.cpf as string | null) ?? null,
      pacienteTelefone: s.pac_telefone,
      valorBruto: valor,
      metodo: s.pagamento_metodo,
      parcelas,
      taxaEstimada: taxa,
      valorLiquido: round2(valor - taxa),
      statusPagamento: s.pagamento_status,
      nfStatus: s.nf_status ?? 'pendente',
      nfNumero: s.nf_numero,
      nfEmitidaEm: s.nf_emitida_em,
      pagoEm: s.pago_em,
    }
  })

  return {
    ano,
    mes: mesIdx0 + 1,
    rotuloMes: inicio.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    psicologo: {
      nome: ps[0].nome,
      crp: ps[0].crp,
      email: ps[0].email,
      regime: perfil.regimeTributario,
      regimeLabel: perfil.regimeTributario ? REGIME_LABELS[perfil.regimeTributario] : 'Não configurado',
      cnae: perfil.cnae,
      municipio: perfil.municipio,
      municipioUf: perfil.municipioUf,
      issAliquotaPct: perfil.issAliquotaPct,
      nomeContador: perfil.nomeContador,
      emailContador: perfil.emailContador,
    },
    resumo: {
      recebidoBruto: visao.mesAtual.recebidoBruto,
      taxasEstimadas: visao.mesAtual.taxasEstimadas,
      liquidoEstimado: visao.mesAtual.liquidoEstimado,
      issEstimado: visao.issEstimado,
      impostoEstimado: visao.imposto?.valorEstimado ?? 0,
      impostoLabel: rotuloImposto(visao.imposto?.tipo),
      impostoObs: visao.imposto?.observacao ?? '',
    },
    linhas,
  }
}

// ─── CSV ─────────────────────────────────────────────────────────────

export function montarCsv(d: ExportacaoMensal): string {
  const linhas: string[] = []

  // Cabeçalho com metadados
  linhas.push(`# Audere · Relatório financeiro mensal · ${d.rotuloMes}`)
  linhas.push(`# Profissional: ${d.psicologo.nome} (${d.psicologo.crp})`)
  linhas.push(`# Email: ${d.psicologo.email}`)
  if (d.psicologo.nomeContador || d.psicologo.emailContador) {
    linhas.push(`# Contador: ${[d.psicologo.nomeContador, d.psicologo.emailContador].filter(Boolean).join(' · ')}`)
  }
  linhas.push(`# Regime tributário: ${d.psicologo.regimeLabel}`)
  linhas.push(`# CNAE: ${d.psicologo.cnae}`)
  if (d.psicologo.municipio) {
    linhas.push(`# Município ISS: ${d.psicologo.municipio} / ${d.psicologo.municipioUf} · ${d.psicologo.issAliquotaPct ?? 0}%`)
  }
  linhas.push(`#`)
  linhas.push(`# Recebido bruto:       ${brl(d.resumo.recebidoBruto)}`)
  linhas.push(`# Taxas estimadas:      ${brl(d.resumo.taxasEstimadas)}`)
  linhas.push(`# Líquido estimado:     ${brl(d.resumo.liquidoEstimado)}`)
  linhas.push(`# ISS estimado:         ${brl(d.resumo.issEstimado)}`)
  linhas.push(`# ${d.resumo.impostoLabel}: ${brl(d.resumo.impostoEstimado)}`)
  linhas.push(`# Total de cobranças pagas no mês: ${d.linhas.length}`)
  linhas.push(`#`)
  linhas.push(`# Estimativas pra orientação. Cálculo final é responsabilidade do(a) contador(a).`)
  linhas.push('')

  // Cabeçalho de colunas
  const colunas = [
    'Data', 'Hora', 'Sessao', 'Paciente', 'CPF', 'Telefone',
    'ValorBruto', 'Metodo', 'Parcelas', 'TaxaEstimada', 'ValorLiquido',
    'StatusPagamento', 'NFStatus', 'NFNumero', 'NFEmitidaEm', 'PagoEm',
  ]
  linhas.push(colunas.join(';'))

  // Dados
  for (const l of d.linhas) {
    const cells = [
      l.data,
      l.hora,
      String(l.sessaoNumero),
      csvCampo(l.pacienteNome),
      l.pacienteCpf ?? '',
      l.pacienteTelefone.replace(/\D/g, ''),
      brlValor(l.valorBruto),
      l.metodo ?? '',
      String(l.parcelas),
      brlValor(l.taxaEstimada),
      brlValor(l.valorLiquido),
      l.statusPagamento,
      l.nfStatus,
      l.nfNumero ?? '',
      l.nfEmitidaEm ? l.nfEmitidaEm.slice(0, 10) : '',
      l.pagoEm ? l.pagoEm.slice(0, 10) : '',
    ]
    linhas.push(cells.join(';'))
  }

  // BOM UTF-8 pro Excel abrir corretamente acentos
  return '﻿' + linhas.join('\n')
}

// ─── Helpers ─────────────────────────────────────────────────────────

function taxaPagarMe(metodo: string | null, parcelas: number): number {
  if (metodo === 'pix')     return 0.0099
  if (metodo === 'debito')  return 0.0199
  if (metodo === 'credito') return parcelas > 1 ? 0.0499 : 0.0399
  return 0
}

function round2(n: number): number { return Math.round(n * 100) / 100 }

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}
/** Valor em formato BR (com vírgula) sem prefixo R$, pra CSV. */
function brlValor(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

function csvCampo(s: string): string {
  // Se contém ; ou aspas, encerra entre aspas duplas escapando
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function rotuloImposto(tipo: string | undefined): string {
  if (tipo === 'irpf_mensal')         return 'Carnê-Leão estimado'
  if (tipo === 'das_simples_anexo3')  return 'DAS Simples Anexo III estimado'
  if (tipo === 'das_simples_anexo5')  return 'DAS Simples Anexo V estimado'
  if (tipo === 'das_lucro_presumido') return 'Lucro Presumido estimado'
  return 'Imposto estimado'
}

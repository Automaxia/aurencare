import 'server-only'
import { db } from '@/server/db/pool'
import {
  lerPerfilTributario, LIMITE_ISENCAO_CARNE_LEAO_2026,
  type PerfilTributario, type RegimeTributario,
} from './perfilTributario'

/**
 * Agregação contábil mensal pro psicólogo + estimativas de imposto.
 *
 * IMPORTANTE: todos os cálculos de imposto são ESTIMATIVAS pra orientação.
 * O cálculo definitivo é responsabilidade do contador. Por isso a UI deve
 * sempre exibir disclaimer "Consulte seu contador pra valores finais".
 *
 * Tabelas usadas (vigentes 2026):
 *  - IRPF mensal (Carnê-Leão): isenção R$ 2.824, faixas progressivas
 *  - Simples Nacional Anexo III: faixas 6% a 33%
 *  - Simples Nacional Anexo V:   faixas 15.5% a 30.5%
 *  - ISS: usa alíquota do perfil tributário (2-5% varia por município)
 */

export type ResumoMes = {
  ano: number
  mes: number                // 1-12
  rotulo: string             // "Maio 2026"
  recebidoBruto: number
  taxasEstimadas: number
  liquidoEstimado: number    // após taxas Pagar.me
  recebidoPorMetodo: { pix: number; credito: number; debito: number }
  cobrancasCount: number     // pagas no mês
  cobrancasNfPendente: number
  cobrancasNfEmitida: number
  cobrancasNfDispensada: number
}

export type Imposto = {
  tipo: 'irpf_mensal' | 'das_simples_anexo3' | 'das_simples_anexo5' | 'das_lucro_presumido'
  valorEstimado: number
  aliquotaEfetivaPct: number   // %  ex 6.0
  observacao: string           // texto curto pra UI
}

export type AlertaContabil = {
  nivel: 'info' | 'atencao' | 'critico'
  titulo: string
  detalhe: string
}

export type VisaoContabil = {
  perfil: PerfilTributario
  mesAtual: ResumoMes
  mesAnterior: ResumoMes | null
  /** Variação % do bruto atual vs anterior (positivo = subiu). */
  variacaoBrutoPct: number | null
  /** Receita bruta acumulada nos últimos 12 meses (pro cálculo Simples). */
  receitaBruta12m: number
  /** ISS estimado do mês com base na alíquota do perfil. */
  issEstimado: number
  /** Imposto estimado segundo o regime do perfil. */
  imposto: Imposto | null
  /** Alertas relevantes (limite isenção, faturamento, NF pendentes etc). */
  alertas: AlertaContabil[]
}

// ─── Tabelas de cálculo ────────────────────────────────────────────

/** Tabela progressiva IRPF mensal 2026 (Carnê-Leão). */
const FAIXAS_IRPF_MENSAL_2026 = [
  { ate: 2824.00,   aliq: 0,     deduz: 0 },
  { ate: 3751.05,   aliq: 0.075, deduz: 211.80 },
  { ate: 4664.68,   aliq: 0.15,  deduz: 493.59 },
  { ate: 5824.90,   aliq: 0.225, deduz: 843.94 },
  { ate: Infinity,  aliq: 0.275, deduz: 1135.18 },
]

/** Simples Nacional — Anexo III (psicologia com Fator R ≥ 28%). */
const SIMPLES_ANEXO_3 = [
  { ate: 180000,   aliq: 0.060, deduz: 0 },
  { ate: 360000,   aliq: 0.112, deduz: 9360 },
  { ate: 720000,   aliq: 0.135, deduz: 17640 },
  { ate: 1800000,  aliq: 0.160, deduz: 35640 },
  { ate: 3600000,  aliq: 0.210, deduz: 125640 },
  { ate: 4800000,  aliq: 0.330, deduz: 648000 },
]

/** Simples Nacional — Anexo V (sem Fator R). */
const SIMPLES_ANEXO_5 = [
  { ate: 180000,   aliq: 0.155, deduz: 0 },
  { ate: 360000,   aliq: 0.180, deduz: 4500 },
  { ate: 720000,   aliq: 0.195, deduz: 9900 },
  { ate: 1800000,  aliq: 0.205, deduz: 17100 },
  { ate: 3600000,  aliq: 0.230, deduz: 62100 },
  { ate: 4800000,  aliq: 0.305, deduz: 540000 },
]

const LIMITE_SIMPLES_ANUAL = 4_800_000   // R$ 4.8M/ano

// ─── Cálculo principal ─────────────────────────────────────────────

export async function lerVisaoContabil(psicologoId: string, anchorIso?: string): Promise<VisaoContabil> {
  const perfil = await lerPerfilTributario(psicologoId)
  const anchor = new Date(anchorIso ?? new Date().toISOString())

  // Resumos: mês atual + 12 meses pra trás
  const resumos: ResumoMes[] = []
  for (let off = 0; off < 13; off++) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - off, 1)
    resumos.push(await resumirMes(psicologoId, d.getFullYear(), d.getMonth()))
  }
  const mesAtual = resumos[0]
  const mesAnterior = resumos[1] ?? null

  // Variação %
  const variacaoBrutoPct = mesAnterior && mesAnterior.recebidoBruto > 0
    ? Math.round(((mesAtual.recebidoBruto / mesAnterior.recebidoBruto) - 1) * 100)
    : null

  // Receita 12m (mesAtual + 11 anteriores)
  const receitaBruta12m = resumos.slice(0, 12).reduce((a, r) => a + r.recebidoBruto, 0)

  // ISS estimado (sobre recebido bruto do mês)
  const issAliq = perfil.issAliquotaPct ?? 0
  const issEstimado = round2(mesAtual.recebidoBruto * issAliq / 100)

  // Imposto principal
  const imposto = calcularImposto(perfil.regimeTributario, mesAtual.recebidoBruto, receitaBruta12m)

  // Alertas
  const alertas = computarAlertas(perfil, mesAtual, receitaBruta12m, imposto)

  return {
    perfil,
    mesAtual,
    mesAnterior,
    variacaoBrutoPct,
    receitaBruta12m,
    issEstimado,
    imposto,
    alertas,
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

async function resumirMes(psicologoId: string, ano: number, mesIdx0: number): Promise<ResumoMes> {
  const inicio = new Date(ano, mesIdx0, 1)
  const fim = new Date(ano, mesIdx0 + 1, 0, 23, 59, 59, 999)

  const { rows } = await db.query<{
    valor: any; pagamento_status: string; pagamento_metodo: string | null;
    pagamento_parcelas: number; nf_status: string | null;
  }>(
    `SELECT valor, pagamento_status, pagamento_metodo, pagamento_parcelas, nf_status
       FROM sessoes
      WHERE psicologo_id = $1
        AND data_hora BETWEEN $2 AND $3`,
    [psicologoId, inicio.toISOString(), fim.toISOString()],
  )

  const pagas = rows.filter(r => r.pagamento_status === 'pago')
  const recebidoBruto = pagas.reduce((a, r) => a + parseFloat(r.valor ?? 0), 0)

  const taxasEstimadas = pagas.reduce((a, r) => {
    const valor = parseFloat(r.valor ?? 0)
    const parcelas = parseInt(String(r.pagamento_parcelas ?? 1), 10) || 1
    return a + valor * taxaPagarMe(r.pagamento_metodo, parcelas)
  }, 0)

  return {
    ano, mes: mesIdx0 + 1,
    rotulo: inicio.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    recebidoBruto: round2(recebidoBruto),
    taxasEstimadas: round2(taxasEstimadas),
    liquidoEstimado: round2(recebidoBruto - taxasEstimadas),
    recebidoPorMetodo: {
      pix:     round2(pagas.filter(r => r.pagamento_metodo === 'pix').reduce((a, r) => a + parseFloat(r.valor ?? 0), 0)),
      credito: round2(pagas.filter(r => r.pagamento_metodo === 'credito').reduce((a, r) => a + parseFloat(r.valor ?? 0), 0)),
      debito:  round2(pagas.filter(r => r.pagamento_metodo === 'debito').reduce((a, r) => a + parseFloat(r.valor ?? 0), 0)),
    },
    cobrancasCount: pagas.length,
    cobrancasNfPendente:   pagas.filter(r => !r.nf_status || r.nf_status === 'pendente').length,
    cobrancasNfEmitida:    pagas.filter(r => r.nf_status === 'emitida').length,
    cobrancasNfDispensada: pagas.filter(r => r.nf_status === 'dispensada').length,
  }
}

function taxaPagarMe(metodo: string | null, parcelas: number): number {
  if (metodo === 'pix')     return 0.0099
  if (metodo === 'debito')  return 0.0199
  if (metodo === 'credito') return parcelas > 1 ? 0.0499 : 0.0399
  return 0
}

function calcularImposto(
  regime: RegimeTributario | null,
  recebidoBrutoMes: number,
  receitaBruta12m: number,
): Imposto | null {
  if (!regime || recebidoBrutoMes === 0) return null

  if (regime === 'autonomo_pf') {
    // Tabela progressiva IRPF mensal (Carnê-Leão)
    const faixa = FAIXAS_IRPF_MENSAL_2026.find(f => recebidoBrutoMes <= f.ate)!
    const valor = Math.max(0, recebidoBrutoMes * faixa.aliq - faixa.deduz)
    const aliquotaEfetiva = recebidoBrutoMes > 0 ? (valor / recebidoBrutoMes) * 100 : 0
    return {
      tipo: 'irpf_mensal',
      valorEstimado: round2(valor),
      aliquotaEfetivaPct: round2(aliquotaEfetiva),
      observacao: recebidoBrutoMes <= LIMITE_ISENCAO_CARNE_LEAO_2026
        ? `Abaixo do limite mensal de isenção (R$ ${LIMITE_ISENCAO_CARNE_LEAO_2026.toFixed(2).replace('.', ',')}).`
        : 'IRPF mensal pelo Carnê-Leão. Soma INSS, dedução de dependentes e livro caixa fora dessa estimativa.',
    }
  }

  if (regime === 'pj_simples_anexo3' || regime === 'pj_simples_anexo5') {
    // Alíquota efetiva: (rbt12m × alíq − dedução) / rbt12m
    const tabela = regime === 'pj_simples_anexo3' ? SIMPLES_ANEXO_3 : SIMPLES_ANEXO_5
    const base = receitaBruta12m > 0 ? receitaBruta12m : recebidoBrutoMes * 12
    const faixa = tabela.find(f => base <= f.ate) ?? tabela[tabela.length - 1]
    const aliquotaEfetiva = base > 0 ? Math.max(0, (base * faixa.aliq - faixa.deduz) / base) : faixa.aliq
    const valor = recebidoBrutoMes * aliquotaEfetiva
    return {
      tipo: regime === 'pj_simples_anexo3' ? 'das_simples_anexo3' : 'das_simples_anexo5',
      valorEstimado: round2(valor),
      aliquotaEfetivaPct: round2(aliquotaEfetiva * 100),
      observacao: regime === 'pj_simples_anexo3'
        ? 'DAS Simples Anexo III (Fator R ≥ 28% da folha). Alíquota efetiva calculada pelos últimos 12 meses.'
        : 'DAS Simples Anexo V. Considerar migração pro Anexo III via Fator R, se aplicável.',
    }
  }

  if (regime === 'pj_lucro_presumido') {
    // Lucro Presumido: cálculo simplificado.
    // Presunção 32% sobre serviços + alíquota total ~16.33% (IRPJ + CSLL + PIS + COFINS + ISS).
    // Pra MVP só sinalizo, sem cálculo definitivo.
    return {
      tipo: 'das_lucro_presumido',
      valorEstimado: round2(recebidoBrutoMes * 0.1633),
      aliquotaEfetivaPct: 16.33,
      observacao: 'Lucro Presumido — estimativa simplificada de IRPJ + CSLL + PIS + COFINS + ISS. Cálculo final com contador.',
    }
  }

  return null
}

function computarAlertas(
  perfil: PerfilTributario,
  mes: ResumoMes,
  receita12m: number,
  imposto: Imposto | null,
): AlertaContabil[] {
  const out: AlertaContabil[] = []

  // 1) Perfil tributário não definido
  if (!perfil.regimeTributario) {
    out.push({
      nivel: 'atencao',
      titulo: 'Defina seu regime tributário',
      detalhe: 'Sem o regime configurado, as estimativas de imposto ficam genéricas. Configure em Perfil → Recebimentos.',
    })
  }

  // 2) Limite de isenção do autônomo PF
  if (perfil.regimeTributario === 'autonomo_pf') {
    if (mes.recebidoBruto > LIMITE_ISENCAO_CARNE_LEAO_2026) {
      out.push({
        nivel: 'atencao',
        titulo: `Receita acima do limite de isenção mensal`,
        detalhe: `Você ultrapassou os R$ ${LIMITE_ISENCAO_CARNE_LEAO_2026.toFixed(2).replace('.', ',')} de receita tributável. Carnê-Leão é obrigatório neste mês.`,
      })
    }
  }

  // 3) Faturamento PJ Simples próximo do teto anual (4.8M)
  if (perfil.regimeTributario === 'pj_simples_anexo3' || perfil.regimeTributario === 'pj_simples_anexo5') {
    if (receita12m > LIMITE_SIMPLES_ANUAL * 0.8) {
      out.push({
        nivel: receita12m > LIMITE_SIMPLES_ANUAL ? 'critico' : 'atencao',
        titulo: receita12m > LIMITE_SIMPLES_ANUAL
          ? 'Faturamento ultrapassou o teto do Simples'
          : 'Faturamento próximo do teto do Simples',
        detalhe: `Acumulado 12m: R$ ${formatBR(receita12m)}. Teto: R$ ${formatBR(LIMITE_SIMPLES_ANUAL)}. Acima disso, migração obrigatória pra Lucro Presumido.`,
      })
    }
  }

  // 4) NF pendente no mês
  if (mes.cobrancasNfPendente > 0) {
    out.push({
      nivel: 'info',
      titulo: `${mes.cobrancasNfPendente} ${mes.cobrancasNfPendente === 1 ? 'cobrança' : 'cobranças'} sem NF emitida`,
      detalhe: 'Emita ou marque como dispensada nas próximas exportações pro contador.',
    })
  }

  // 5) Município/ISS não configurado e há receita
  if (mes.recebidoBruto > 0 && !perfil.municipio) {
    out.push({
      nivel: 'info',
      titulo: 'Município de ISS não configurado',
      detalhe: 'Sem município/UF, o cálculo de ISS fica zero. Configure em Perfil → Recebimentos.',
    })
  }

  return out
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function formatBR(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

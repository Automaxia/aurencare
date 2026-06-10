import 'server-only'
import { db } from '@/server/db/pool'
import { lerGrafo } from './temas'

/**
 * Memória Clínica + Continuidade Longitudinal (Fase 2 do redesign do paciente).
 *
 * 100% DETERMINÍSTICO — sem IA. Usa quais sessões cada tema apareceu
 * (`sessoes_ids` do grafo) + a ordem cronológica das sessões assinadas + idade
 * dos objetivos. Linguagem observacional ("reapareceu", "emergindo", "recuando"),
 * nunca diagnóstica. Barato, auditável, não alucina.
 */

export type FatoMemoria = { texto: string; destaque?: boolean; href: string }
export type Continuidade = {
  emergindo: string[]
  recorrente: string[]
  recuando: string[]
  objetivos: { titulo: string; estado: 'avancando' | 'estagnado' }[]
}
export type MemoriaClinicaDados = {
  fatos: FatoMemoria[]
  continuidade: Continuidade
  temasPredominantes: string[]
  totalSessoes: number
}

const cap = (s: string) => s ? s[0].toUpperCase() + s.slice(1) : s

export async function gerarMemoriaClinica(pacienteId: string): Promise<MemoriaClinicaDados> {
  const [sessoesRes, grafo, objRes] = await Promise.all([
    db.query<{ id: string }>(
      `SELECT id FROM sessoes WHERE paciente_id = $1 AND assinada = TRUE ORDER BY data_hora ASC`, [pacienteId]),
    lerGrafo(pacienteId),
    db.query<{ titulo: string; progresso: number; created_at: string }>(
      `SELECT titulo, progresso, created_at FROM objetivos WHERE paciente_id = $1 AND status = 'ativo' ORDER BY created_at ASC`, [pacienteId]),
  ])

  const sessoes = sessoesRes.rows
  const N = sessoes.length
  const R = Math.min(3, Math.max(1, Math.ceil(N / 4)))   // janela "recente"
  const temTendencia = N >= 4                            // sinais ↑↓ só com histórico

  const hrefTemas = `/pacientes/${pacienteId}/temas`
  const hrefObj   = `/pacientes/${pacienteId}/objetivos`

  // Para cada tema, presença booleana ordenada pelas sessões.
  const temas = grafo.nodes.map(n => {
    const ids = new Set(n.sessoesIds)
    const presente = sessoes.map(s => ids.has(s.id))
    const count = presente.filter(Boolean).length
    const recentes = presente.slice(N - R).filter(Boolean).length
    const anteriores = presente.slice(0, Math.max(0, N - R)).filter(Boolean).length
    let streak = 0
    for (let i = N - 1; i >= 0 && presente[i]; i--) streak++
    const gapAntes = streak < N && presente[N - 1 - streak] === false
    return { palavra: n.palavra, count, recentes, anteriores, streak, gapAntes }
  }).filter(t => t.count > 0)

  // ── FATOS (Memória Clínica) ──
  const fatos: FatoMemoria[] = []
  // Reaparições (destaque): voltou nas últimas N sessões após uma ausência.
  for (const t of temas) {
    if (t.streak >= 2 && t.gapAntes && t.streak < t.count)
      fatos.push({ texto: `${cap(t.palavra)} reapareceu nas últimas ${t.streak} sessões`, destaque: true, href: hrefTemas })
  }
  // Mais frequentes ("Ansiedade · 8 sessões").
  for (const t of [...temas].sort((a, b) => b.count - a.count).slice(0, 4)) {
    if (t.count >= 2) fatos.push({ texto: `${cap(t.palavra)} · ${t.count} sessões`, href: hrefTemas })
  }
  // Objetivo mais antigo ativo ("Autoestima · ativo há 45 dias").
  if (objRes.rows[0]) {
    const dias = Math.floor((Date.now() - +new Date(objRes.rows[0].created_at)) / 86_400_000)
    if (dias >= 7) fatos.push({ texto: `${cap(objRes.rows[0].titulo)} · objetivo ativo há ${dias} dias`, href: hrefObj })
  }
  // Dedupe por texto + cap.
  const vistos = new Set<string>()
  const fatosUnicos = fatos.filter(f => (vistos.has(f.texto) ? false : (vistos.add(f.texto), true))).slice(0, 6)

  // ── CONTINUIDADE ──
  const emergindo: string[] = [], recorrente: string[] = [], recuando: string[] = []
  if (temTendencia) {
    for (const t of temas) {
      if (t.recentes > 0 && t.anteriores === 0) emergindo.push(cap(t.palavra))
      else if (t.recentes === 0 && t.anteriores > 0) recuando.push(cap(t.palavra))
      else if (t.count >= 3 && t.recentes > 0) recorrente.push(cap(t.palavra))
    }
  }
  // Objetivos: só classifica os casos CLAROS (não inventa "avançando" pra dúvida).
  type ObjEstado = { titulo: string; estado: 'avancando' | 'estagnado' }
  const objetivos = objRes.rows.flatMap((o): ObjEstado[] => {
    const dias = Math.floor((Date.now() - +new Date(o.created_at)) / 86_400_000)
    if (o.progresso >= 50) return [{ titulo: cap(o.titulo), estado: 'avancando' }]
    if (dias > 30 && o.progresso < 20) return [{ titulo: cap(o.titulo), estado: 'estagnado' }]
    return []
  })

  return {
    fatos: fatosUnicos,
    continuidade: { emergindo: emergindo.slice(0, 4), recorrente: recorrente.slice(0, 4), recuando: recuando.slice(0, 4), objetivos },
    temasPredominantes: grafo.nodes.slice(0, 6).map(n => n.palavra),
    totalSessoes: N,
  }
}

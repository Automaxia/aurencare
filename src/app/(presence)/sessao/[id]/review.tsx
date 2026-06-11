'use client'

import { isValidElement, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CfpBadge } from '@/components/brand/CfpBadge'
import type { Sessao } from '@/server/services/sessoes'

const STATUS_LABEL: Record<string, string> = {
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  no_show: 'Sem comparecimento',
}

const MARK_LABEL: Record<string, string> = {
  insight: 'Insight relevante',
  comportamento: 'Comportamento problema',
  avanco: 'Avanço terapêutico',
}
const MARK_COLOR: Record<string, 'accent' | 'rose' | 'sage'> = {
  insight: 'accent', comportamento: 'rose', avanco: 'sage',
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 11, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6,
}
const ta: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
  fontSize: 13, padding: '10px 12px', resize: 'vertical', lineHeight: 1.5,
}

export function SessionReview({ sessao }: { sessao: Sessao }) {
  const [insight, setInsight] = useState<string | null>(null)
  const [loadingInsight, setLoadingInsight] = useState(false)
  const [insightError, setInsightError] = useState<string | null>(null)

  const ind = sessao.indicadores ?? {}
  const turnos = parseTranscriptionToTurns(sessao.transcricao ?? '')

  // Assinatura inline — resolve a pendência "Registrar" (sessão concluída e não
  // assinada). Antes a revisão era só leitura e não havia como resolver.
  const router = useRouter()
  const [resumoEdit, setResumoEdit] = useState(sessao.resumoIa ?? '')
  const [notaEdit, setNotaEdit] = useState(sessao.notaClinica ?? '')
  const [assinando, setAssinando] = useState(false)
  const [assinadoAgora, setAssinadoAgora] = useState(false)
  const [assinarErro, setAssinarErro] = useState<string | null>(null)
  const assinada = sessao.assinada || assinadoAgora
  const podeAssinar = sessao.status === 'concluida' && !assinada

  async function assinarRegistro() {
    if (!resumoEdit.trim()) { setAssinarErro('Escreva um resumo antes de assinar.'); return }
    setAssinando(true); setAssinarErro(null)
    try {
      const res = await fetch(`/api/sessao/${sessao.id}/assinar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumoFinal: resumoEdit, notaClinica: notaEdit }),
      })
      const json = await res.json().catch(() => ({} as any))
      if (res.ok) { setAssinadoAgora(true); router.refresh() }
      else if (json.error === 'termos_proibidos') setAssinarErro('O texto contém termos clínicos/diagnósticos não permitidos. Reformule antes de assinar.')
      else if (json.error === 'resumo_vazio') setAssinarErro('Escreva um resumo antes de assinar.')
      else setAssinarErro('Falha ao assinar. Tente novamente.')
    } catch {
      setAssinarErro('Falha ao assinar. Tente novamente.')
    } finally {
      setAssinando(false)
    }
  }

  async function carregarInsight() {
    setLoadingInsight(true); setInsightError(null)
    try {
      const res = await fetch(`/api/sessao/${sessao.id}/ia/insight`)
      const json = await res.json()
      setInsight(json?.text ?? null)
    } catch {
      setInsightError('Falha ao gerar análise.')
    } finally {
      setLoadingInsight(false)
    }
  }

  return (
    <>
      <div className="pbar">
        <div>
          <span className="pb-name">{sessao.pacienteNome}</span>
          <span className="pb-meta">
            · Sessão #{sessao.numero} · {STATUS_LABEL[sessao.status] ?? sessao.status} · {new Date(sessao.dataHora).toLocaleString('pt-BR')}
          </span>
        </div>
        <div className="pb-actions">
          {assinada
            ? <span style={{ fontSize: 12, color: 'var(--sage)' }}>✓ Assinada</span>
            : sessao.status === 'concluida' && <span style={{ fontSize: 12, color: 'var(--amber)' }}>⚠ Registro pendente</span>}
          <Link href={`/pacientes/${sessao.pacienteId}/evolucao`} className="btn ghost">Ver evolução</Link>
          <Link href={`/pacientes/${sessao.pacienteId}`} className="btn ghost">← Paciente</Link>
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, maxWidth: 1240, margin: '0 auto', width: '100%' }}>
        {/* Coluna esquerda — transcrição com marcações */}
        <div>
          {podeAssinar ? (
            <Section title="Registrar sessão">
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 12, lineHeight: 1.5 }}>
                Esta sessão está <strong style={{ color: 'var(--amber)' }}>pendente de registro</strong>.
                Revise o resumo e <strong>assine</strong> para concluir — é isto que resolve a
                notificação “Registrar — {sessao.pacienteNome}”.
              </div>
              <label style={lbl}>Resumo (rascunho · revise antes de assinar)</label>
              <textarea
                value={resumoEdit} onChange={e => setResumoEdit(e.target.value)} rows={6}
                placeholder="Resumo da sessão em linguagem de observação (sem diagnóstico)…"
                style={ta}
              />
              <label style={{ ...lbl, marginTop: 12 }}>Nota clínica privada (opcional)</label>
              <textarea value={notaEdit} onChange={e => setNotaEdit(e.target.value)} rows={3} style={ta} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                <CfpBadge />
                <div style={{ flex: 1 }} />
                <button className="btn primary" onClick={assinarRegistro} disabled={assinando || !resumoEdit.trim()}>
                  {assinando ? 'Assinando…' : 'Assinar registro'}
                </button>
              </div>
              {assinarErro && <div style={{ color: 'var(--rose)', fontSize: 12, marginTop: 8 }}>{assinarErro}</div>}
            </Section>
          ) : (
            <Section title="Resumo (assinado)">
              {(assinadoAgora ? resumoEdit : sessao.resumoIa) ? (
                <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                  {assinadoAgora ? resumoEdit : sessao.resumoIa}
                </p>
              ) : <Empty>Sessão sem resumo.</Empty>}
              {(assinadoAgora || sessao.assinaturaTimestamp) && (
                <div style={{ fontSize: 11, color: 'var(--sage)', marginTop: 8 }}>
                  {assinadoAgora
                    ? '✓ Assinada agora — pendência resolvida.'
                    : `✓ Assinada em ${new Date(sessao.assinaturaTimestamp!).toLocaleString('pt-BR')}`}
                </div>
              )}
            </Section>
          )}

          {sessao.notaClinica && (
            <Section title="Nota clínica privada">
              <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{sessao.notaClinica}</p>
            </Section>
          )}

          <Section title="Transcrição">
            {turnos.length === 0 ? (
              <Empty>Sem transcrição registrada.</Empty>
            ) : (
              <div className="talk-card" style={{ height: 'auto', maxHeight: 420 }}>
                {turnos.map((t, i) => (
                  <div key={i} className="turn" data-mark={t.mark ?? undefined}>
                    <span className="who" data-who={t.who}>{t.who === 'psicologo' ? 'P' : 'C'}:</span>{' '}
                    {t.texto}
                    {t.mark && (
                      <span className="turn-chip" style={{ background: `var(--${MARK_COLOR[t.mark]}-lo)`, color: `var(--${MARK_COLOR[t.mark]})` }}>
                        {MARK_LABEL[t.mark]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Coluna direita — indicadores + insight IA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="widget-title">Indicadores</div>
            <Row label="Pagamento" value={String(sessao.pagamentoStatus) === 'isento' ? 'sessão sem cobrança' : sessao.pagamentoStatus} />
            {sessao.pagamentoMetodo && <Row label="Método" value={sessao.pagamentoMetodo} />}
            <Row label="Duração" value={`${sessao.duracaoMin} min`} />
            <Row label="Modalidade" value={sessao.modalidade} />
            {ind?.ritmo && (
              <>
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)' }}>Ritmo da conversa</div>
                <div className="rh-row">
                  <span className="who">Psicóloga</span>
                  <div className="rh-bar psic"><span style={{ width: `${ind.ritmo.psicologo}%` }} /></div>
                  <span className="rh-pct">{ind.ritmo.psicologo}%</span>
                </div>
                <div className="rh-row">
                  <span className="who">Paciente</span>
                  <div className="rh-bar pac"><span style={{ width: `${ind.ritmo.paciente}%` }} /></div>
                  <span className="rh-pct">{ind.ritmo.paciente}%</span>
                </div>
              </>
            )}
            {ind?.humor && (
              <>
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)' }}>Humor</div>
                {typeof ind.humor.estado === 'number' && (
                  <Row label="Estado (−5 a +5)" value={`${ind.humor.estado > 0 ? '+' : ''}${ind.humor.estado} · ${emoLabel(ind.humor.estado)}`} />
                )}
                <Row label="Predominante" value={momentoLabel(ind.humor.predominante)} />
                <Row label="Início" value={momentoLabel(ind.humor.inicio)} />
                <Row label="Fim" value={momentoLabel(ind.humor.fim)} />
              </>
            )}
            {ind?.risco && (
              <>
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)' }}>Avaliação de risco</div>
                <Row label="Autolesão" value={riskLabel(ind.risco.autolesao)} />
                <Row label="Ideação" value={riskLabel(ind.risco.ideacao)} />
                <Row label="Plano" value={riskLabel(ind.risco.plano)} />
              </>
            )}
          </div>

          <div className="card" style={{ background: 'var(--accent-lo)', borderColor: 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#4a3299', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 500 }}>
                Análise da sessão
              </span>
              <CfpBadge />
            </div>
            {insight ? (
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.6 }}>{insight}</p>
            ) : (
              <button className="btn" onClick={carregarInsight} disabled={loadingInsight} style={{ width: '100%', background: 'white' }}>
                {loadingInsight ? 'Gerando análise…' : '✨ Gerar análise contextual'}
              </button>
            )}
            {insightError && <div style={{ color: 'var(--rose)', fontSize: 12, marginTop: 8 }}>{insightError}</div>}
          </div>
        </div>
      </div>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 16 }}>
      <div className="widget-title">{title}</div>
      <div className="card">{children}</div>
    </section>
  )
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: 'var(--muted)' }}>{children}</div>
}
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  // Rede de segurança: nunca renderiza um objeto cru como filho do React (isso
  // estoura "Objects are not valid as a React child"). Coage pra string.
  const safe = value !== null && typeof value === 'object' && !isValidElement(value)
    ? JSON.stringify(value)
    : value
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ color: 'var(--ink-soft)' }}>{safe}</span>
    </div>
  )
}
function riskLabel(v?: string) {
  return ({ lo: 'Baixo', md: 'Médio', hi: 'Alto' } as Record<string, string>)[v ?? 'lo'] ?? '—'
}

const EMO_LABELS: Record<number, string> = {
  [-5]: 'Extremamente desagradável', [-4]: 'Muito desagradável', [-3]: 'Desagradável',
  [-2]: 'Levemente desagradável', [-1]: 'Pouco desagradável', 0: 'Neutro',
  1: 'Pouco agradável', 2: 'Levemente agradável', 3: 'Agradável',
  4: 'Muito agradável', 5: 'Extremamente agradável',
}
function emoLabel(v: number): string {
  return EMO_LABELS[v] ?? 'Neutro'
}
/** Momento de humor pode ser objeto {texto, intensidade} (atual) ou primitivo (legado). */
function momentoLabel(m: any): string {
  if (m == null) return '—'
  if (typeof m !== 'object') return String(m)
  const texto = (m.texto ?? '').toString().trim()
  const inten = typeof m.intensidade === 'number' ? `intensidade ${m.intensidade}` : ''
  if (texto && inten) return `${texto} · ${inten}`
  return texto || inten || '—'
}

/**
 * Re-parse simples da transcrição salva ("P: ...\nC: ...") em turnos.
 * Marcações foram persistidas em indicadores quando salvas — mas não vinculadas
 * por linha. Para versão completa, persistir como JSON estruturado em coluna própria.
 */
function parseTranscriptionToTurns(raw: string): Array<{ who: 'psicologo' | 'paciente'; texto: string; mark: string | null }> {
  if (!raw) return []
  return raw.split('\n').filter(Boolean).map(line => {
    const m = line.match(/^(P|C):\s*(.+)$/)
    if (m) return { who: m[1] === 'P' ? 'psicologo' as const : 'paciente' as const, texto: m[2], mark: null }
    return { who: 'paciente' as const, texto: line, mark: null }
  })
}

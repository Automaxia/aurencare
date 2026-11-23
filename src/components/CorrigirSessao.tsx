'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateBR, formatDateTimeBR } from '@/lib/formatters'
import { termoCorrecao, type AcaoCorrecao } from '@/lib/termoCorrecaoSessao'

type Contexto = {
  psicologoNome: string
  crp: string
  sessao: { numero: number; dataHora: string; pacienteId: string; pacienteNome: string; pagamentoStatus: string }
  destinos: Array<{ id: string; nome: string; sessoes: Array<{ id: string; numero: number; dataHora: string; status: string }> }>
}

/**
 * "Corrigir sessão" — para sessão COM registro clínico (a vazia usa ExcluirSessao).
 * Etapa 1: escolhe a ação (transferir pra outro paciente / excluir) + motivo.
 * Etapa 2: lê o termo, marca o aceite e digita o nome do paciente afetado
 *   (transferir: o paciente que recebe a sessão; excluir: o paciente da sessão).
 * Tudo é revalidado e registrado em log no servidor (services/correcaoSessao.ts).
 */
export function CorrigirSessao({ sessaoId }: { sessaoId: string }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [ctx, setCtx] = useState<Contexto | null>(null)
  const [erroCarga, setErroCarga] = useState(false)
  const [etapa, setEtapa] = useState<1 | 2>(1)
  const [acao, setAcao] = useState<AcaoCorrecao>('transferir_registro')
  const [destinoPaciente, setDestinoPaciente] = useState('')
  const [destinoSessao, setDestinoSessao] = useState('')   // '' = criar nova
  const [motivo, setMotivo] = useState('')
  const [aceite, setAceite] = useState(false)
  const [confirmacao, setConfirmacao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto || ctx) return
    fetch(`/api/sessao/${sessaoId}/correcao`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setCtx)
      .catch(() => setErroCarga(true))
  }, [aberto, ctx, sessaoId])

  function fechar() {
    if (enviando) return
    setAberto(false); setEtapa(1); setAceite(false); setConfirmacao(''); setErro(null)
  }

  const destino = ctx?.destinos.find(d => d.id === destinoPaciente)
  const etapa1Ok = motivo.trim().length >= 10 && (acao === 'excluir' || !!destinoPaciente)
  const norm = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
  const nomeConfirmacao = acao === 'transferir_registro' ? destino?.nome ?? '' : ctx?.sessao.pacienteNome ?? ''
  const confirmacaoOk = !!ctx && !!nomeConfirmacao && norm(confirmacao) === norm(nomeConfirmacao)
  const termo = ctx ? termoCorrecao(acao, {
    psicologoNome: ctx.psicologoNome, crp: ctx.crp,
    pacienteOrigem: ctx.sessao.pacienteNome, pacienteDestino: destino?.nome,
    sessaoNumero: ctx.sessao.numero, sessaoData: formatDateBR(ctx.sessao.dataHora),
  }) : ''

  async function executar() {
    if (!ctx || !aceite || !confirmacaoOk) return
    setEnviando(true); setErro(null)
    const r = await fetch(`/api/sessao/${sessaoId}/correcao`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        acao, motivo, confirmacao, aceiteTermo: true,
        destinoPacienteId: acao === 'transferir_registro' ? destinoPaciente : undefined,
        destinoSessaoId: acao === 'transferir_registro' && destinoSessao ? destinoSessao : undefined,
      }),
    }).catch(() => null)
    const j = r ? await r.json().catch(() => ({} as any)) : {}
    setEnviando(false)
    if (!r || !r.ok || !j.ok) { setErro(j.erro ?? 'Não foi possível concluir. Nada foi alterado.'); return }
    if (acao === 'transferir_registro' && j.sessaoDestinoId) router.push(`/sessao/${j.sessaoDestinoId}`)
    else router.push(`/pacientes/${ctx.sessao.pacienteId}`)
    router.refresh()
  }

  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '14px 0 6px' }
  const campo: React.CSSProperties = { width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 13, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)' }

  return (
    <>
      <button type="button" className="btn ghost" onClick={() => setAberto(true)}
        title="Trocar o paciente desta sessão ou excluí-la (com termo de responsabilidade)">
        Corrigir sessão
      </button>

      {aberto && (
        <div onClick={fechar}
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,38,.55)', display: 'grid', placeItems: 'center', zIndex: 70, padding: 16, backdropFilter: 'blur(4px)' }}>
          <div className="card" onClick={e => e.stopPropagation()}
            style={{ maxWidth: 560, width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>Corrigir sessão</h2>
                {ctx && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                    {ctx.sessao.pacienteNome} · Sessão {ctx.sessao.numero} · {formatDateTimeBR(ctx.sessao.dataHora)} · etapa {etapa} de 2
                  </div>
                )}
              </div>
              <button className="btn ghost sm" onClick={fechar} aria-label="Fechar">✕</button>
            </div>

            {erroCarga && <p style={{ color: 'var(--rose)', fontSize: 13 }}>Não consegui carregar os dados. Tente de novo.</p>}
            {!ctx && !erroCarga && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Carregando…</p>}

            {ctx && etapa === 1 && (
              <>
                <span style={lbl}>O que precisa ser corrigido?</span>
                <label style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 8, cursor: 'pointer' }}>
                  <input type="radio" checked={acao === 'transferir_registro'} onChange={() => setAcao('transferir_registro')} />
                  <span><strong>Paciente errado</strong> — mover o registro (transcrição, resumo, laudo, notas, humor) para outro paciente. Agenda e pagamento desta sessão não mudam.</span>
                </label>
                <label style={{ display: 'flex', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="radio" checked={acao === 'excluir'} onChange={() => setAcao('excluir')} />
                  <span><strong>Excluir sessão</strong> — some do prontuário e dos indicadores; uma cópia fica guardada em arquivo restrito pelo prazo legal.</span>
                </label>

                {acao === 'transferir_registro' && (
                  <>
                    <span style={lbl}>Paciente correto</span>
                    <select style={campo} value={destinoPaciente} onChange={e => { setDestinoPaciente(e.target.value); setDestinoSessao('') }}>
                      <option value="">Escolha…</option>
                      {ctx.destinos.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                    </select>
                    {destino && (
                      <>
                        <span style={lbl}>Em qual sessão de {destino.nome}?</span>
                        <select style={campo} value={destinoSessao} onChange={e => setDestinoSessao(e.target.value)}>
                          <option value="">Criar uma sessão nova em {formatDateTimeBR(ctx.sessao.dataHora)} (sem cobrança)</option>
                          {destino.sessoes.map(s => (
                            <option key={s.id} value={s.id}>Sessão {s.numero} · {formatDateTimeBR(s.dataHora)}</option>
                          ))}
                        </select>
                        <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '6px 0 0' }}>
                          Aparecem só as sessões sem registro de até 30 dias antes ou depois. O registro chega como rascunho: revise o resumo (ele cita o nome de {ctx.sessao.pacienteNome}) e assine de novo.
                        </p>
                      </>
                    )}
                  </>
                )}
                {acao === 'excluir' && ctx.sessao.pagamentoStatus === 'pago' && (
                  <p style={{ fontSize: 12, color: 'var(--rose)', marginTop: 10 }}>
                    Esta sessão está paga. Para excluir, cancele/reembolse no Financeiro antes — ou, se foi registrada no paciente errado, use “Paciente errado”.
                  </p>
                )}

                <span style={lbl}>Motivo (fica no registro da correção)</span>
                <textarea style={{ ...campo, minHeight: 70, resize: 'vertical' }} value={motivo} onChange={e => setMotivo(e.target.value)}
                  placeholder="Ex.: iniciei a sessão da paciente errada por engano; o atendimento foi da Luiza." />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
                  <button className="btn ghost" onClick={fechar}>Cancelar</button>
                  <button className="btn primary" disabled={!etapa1Ok} onClick={() => setEtapa(2)}>Continuar</button>
                </div>
              </>
            )}

            {ctx && etapa === 2 && (
              <>
                <span style={lbl}>Termo de responsabilidade</span>
                <div style={{ fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'var(--surface)', borderRadius: 8, padding: 12, color: 'var(--ink-soft)' }}>
                  {termo}
                </div>
                <label style={{ display: 'flex', gap: 8, fontSize: 13, marginTop: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={aceite} onChange={e => setAceite(e.target.checked)} />
                  <span>Li e aceito o termo acima.</span>
                </label>
                <span style={lbl}>
                  {acao === 'transferir_registro'
                    ? 'Para confirmar, digite o nome do paciente que vai receber esta sessão: '
                    : 'Para confirmar, digite o nome do paciente desta sessão: '}
                  <strong style={{ textTransform: 'none' }}>{nomeConfirmacao}</strong>
                </span>
                <input style={campo} value={confirmacao} onChange={e => setConfirmacao(e.target.value)} autoComplete="off" />

                {erro && <p style={{ color: 'var(--rose)', fontSize: 12.5, marginTop: 10 }}>{erro}</p>}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 18 }}>
                  <button className="btn ghost" onClick={() => setEtapa(1)} disabled={enviando}>← Voltar</button>
                  <button className="btn primary" disabled={!aceite || !confirmacaoOk || enviando} onClick={executar}
                    style={acao === 'excluir' ? { background: 'var(--rose)' } : undefined}>
                    {enviando ? 'Aplicando…' : acao === 'excluir' ? 'Excluir sessão' : 'Transferir registro'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

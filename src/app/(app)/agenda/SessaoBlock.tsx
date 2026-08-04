'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  reagendarSessaoAction,
  cancelarSessaoAction, marcarNoShowAction, destravarSessaoAction,
} from './actions'
import { horarioBrasiliaParaISO, TZ } from '@/lib/formatters'
import { podeExcluirSessao, sessaoVazia, temAnotacaoViva } from '@/lib/sessaoExclusao'
import { ExcluirSessao } from '@/components/ExcluirSessao'

const STATUS_LABEL: Record<string, string> = {
  agendada: 'Agendada', aguardando_metodo: 'Aguardando método de pagamento',
  aguardando_pagamento: 'Aguardando pagamento', confirmada: 'Confirmada',
  em_curso: 'Em andamento', concluida: 'Concluída', cancelada: 'Cancelada', no_show: 'Sem comparecimento',
}
const PAG_LABEL: Record<string, string> = {
  pago: 'Pago', pendente: 'Pendente', isento: 'Sem cobrança', reembolsado: 'Reembolsado', falhou: 'Falhou', contestado: 'Contestado',
}

// Decompõe o instante em data/hora NO FUSO DE BRASÍLIA, pros inputs date/time —
// independente do fuso do navegador (en-CA → YYYY-MM-DD; en-GB h23 → HH:mm).
function partesLocais(iso: string): { data: string; hora: string } {
  const d = new Date(iso)
  return {
    data: d.toLocaleDateString('en-CA', { timeZone: TZ }),
    hora: d.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }),
  }
}

export function SessaoBlock({ sessao, className, style, children }: {
  sessao: any; className?: string; style?: React.CSSProperties; children: React.ReactNode
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const ini = partesLocais(sessao.dataHora)
  const [data, setData] = useState(ini.data)
  const [hora, setHora] = useState(ini.hora)
  const [duracao, setDuracao] = useState<number>(sessao.duracaoMin ?? 50)
  const [modalidade, setModalidade] = useState<string>(sessao.modalidade ?? 'online')
  const [escopo, setEscopo] = useState<'uma' | 'seguintes'>('uma')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Cancelar / sem comparecimento / destravar. `confirmandoAcao` guarda qual das
  // ações irreversíveis está esperando o "tem certeza".
  const [confirmandoAcao, setConfirmandoAcao] = useState<'cancelar' | 'destravar' | null>(null)
  const [processando, setProcessando] = useState(false)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [okAcao, setOkAcao] = useState<string | null>(null)

  const emCurso = sessao.status === 'em_curso'
  const finalizada = sessao.assinada || sessao.status === 'concluida'
  const ehNoShow = sessao.status === 'no_show'
  const passada = new Date(sessao.dataHora).getTime() < Date.now()
  // Cancelar/no-show só fazem sentido enquanto a sessão não virou prontuário.
  const podeCancelar = !finalizada && !emCurso && sessao.status !== 'cancelada'
  const podeNoShow = !finalizada && !emCurso && sessao.status !== 'cancelada' && (passada || ehNoShow)

  // A agenda tem a sessão inteira em mãos, então dá pra decidir aqui mesmo —
  // a regra vem de `@/lib/sessaoExclusao` e o servidor revalida tudo de novo.
  const podeExcluir = podeExcluirSessao({
    status: sessao.status,
    temRegistro: !sessaoVazia(sessao),
    pagamentoStatus: sessao.pagamentoStatus,
    temCobrancaAberta: !!sessao.pagarmeOrderId && sessao.pagamentoStatus === 'pendente',
  })

  function abrir() {
    const p = partesLocais(sessao.dataHora)
    setData(p.data); setHora(p.hora); setDuracao(sessao.duracaoMin ?? 50); setModalidade(sessao.modalidade ?? 'online')
    setEscopo('uma')
    setErro(null)
    setConfirmandoAcao(null); setErroAcao(null); setOkAcao(null)
    setAberto(true)
  }

  async function salvar() {
    setErro(null)
    const iso = horarioBrasiliaParaISO(data, hora)
    if (!iso) { setErro('Data/hora inválida.'); return }
    setSalvando(true)
    const r = await reagendarSessaoAction(sessao.id, { dataHora: iso, duracaoMin: duracao, modalidade }, sessao.seriePosicao ? escopo : 'uma')
    setSalvando(false)
    if (!r.ok) { setErro(r.error ?? 'Não foi possível salvar.'); return }
    setAberto(false); router.refresh()
  }

  async function cancelar() {
    setErroAcao(null); setProcessando(true)
    const r = await cancelarSessaoAction(sessao.id)
    setProcessando(false); setConfirmandoAcao(null)
    if (!r.ok) { setErroAcao(r.error ?? 'Não foi possível cancelar.'); return }
    setOkAcao(r.reembolsada
      ? 'Sessão cancelada e reembolso solicitado. O paciente foi avisado.'
      : 'Sessão cancelada. O paciente foi avisado (sem reembolso — menos de 24h ou sem pagamento).')
    router.refresh()
  }

  async function alternarNoShow() {
    setErroAcao(null); setProcessando(true)
    const r = await marcarNoShowAction(sessao.id, !ehNoShow)
    setProcessando(false)
    if (!r.ok) { setErroAcao(r.error ?? 'Não foi possível marcar.'); return }
    setOkAcao(ehNoShow ? 'Marcação removida.' : 'Marcada como sem comparecimento.')
    router.refresh()
  }

  async function destravar() {
    setErroAcao(null); setProcessando(true)
    const r = await destravarSessaoAction(sessao.id)
    setProcessando(false); setConfirmandoAcao(null)
    if (!r.ok) { setErroAcao(r.error ?? 'Não foi possível destravar.'); return }
    setOkAcao('Sessão destravada — voltou pra agenda e pode ser remarcada.')
    router.refresh()
  }

  const dtLabel = new Date(sessao.dataHora).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ })

  return (
    <>
      <div
        className={className}
        style={{ ...style, cursor: 'pointer' }}
        onClick={abrir}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir() } }}
      >
        {children}
      </div>

      {aberto && (
        <div role="dialog" aria-modal="true" onClick={() => !salvando && setAberto(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(20,16,38,.5)', backdropFilter: 'blur(3px)',
          display: 'grid', placeItems: 'center', zIndex: 70, padding: 16,
        }}>
          <div className="card" onClick={e => e.stopPropagation()} style={{ width: 'min(420px, 94vw)', padding: 22, maxHeight: '92vh', overflowY: 'auto' }}>
            <h3 className="sigilo" style={{ margin: '0 0 2px' }}>{sessao.pacienteNome}</h3>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 16px' }}>
              Sessão {sessao.numero} · {dtLabel}
            </p>

            {/* Infos */}
            <div style={{ display: 'grid', gap: 6, marginBottom: 16, fontSize: 12.5 }}>
              <Info k="Status" v={STATUS_LABEL[sessao.status] ?? sessao.status} />
              <Info k="Pagamento" v={`${PAG_LABEL[sessao.pagamentoStatus] ?? sessao.pagamentoStatus}${sessao.valor > 0 ? ` · R$ ${Number(sessao.valor).toFixed(2)}` : ''}`} />
              {sessao.seriePosicao && <Info k="Série" v={`Sessão ${sessao.seriePosicao.posicao} de ${sessao.seriePosicao.total}`} />}
            </div>

            {/* Editar data/hora */}
            <div className="sec-lbl" style={{ marginBottom: 8 }}>Alterar data / horário</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={cap}>Data</span>
                <input type="date" value={data} onChange={e => setData(e.target.value)} style={inp} />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={cap}>Hora</span>
                <input type="time" value={hora} onChange={e => setHora(e.target.value)} style={inp} />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={cap}>Duração (min)</span>
                <input type="number" min={10} max={240} step={5} value={duracao} onChange={e => setDuracao(+e.target.value)} style={inp} />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={cap}>Modalidade</span>
                <select value={modalidade} onChange={e => setModalidade(e.target.value)} style={inp}>
                  <option value="online">Online</option>
                  <option value="presencial">Presencial</option>
                </select>
              </label>
            </div>

            {/* Escopo — só faz sentido em sessão de série */}
            {sessao.seriePosicao && (
              <div style={{ marginBottom: 12 }}>
                <div className="sec-lbl" style={{ marginBottom: 6 }}>Aplicar a</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setEscopo('uma')} style={{
                    flex: 1, padding: '9px 10px', borderRadius: 8, fontSize: 12.5, cursor: 'pointer',
                    border: '1px solid ' + (escopo === 'uma' ? 'var(--accent)' : 'var(--border)'),
                    background: escopo === 'uma' ? 'var(--accent-lo)' : 'transparent',
                    color: escopo === 'uma' ? 'var(--accent)' : 'var(--ink-soft)',
                    fontWeight: escopo === 'uma' ? 600 : 400,
                  }}>Só esta sessão</button>
                  <button type="button" onClick={() => setEscopo('seguintes')} style={{
                    flex: 1, padding: '9px 10px', borderRadius: 8, fontSize: 12.5, cursor: 'pointer',
                    border: '1px solid ' + (escopo === 'seguintes' ? 'var(--accent)' : 'var(--border)'),
                    background: escopo === 'seguintes' ? 'var(--accent-lo)' : 'transparent',
                    color: escopo === 'seguintes' ? 'var(--accent)' : 'var(--ink-soft)',
                    fontWeight: escopo === 'seguintes' ? 600 : 400,
                  }}>Esta e as seguintes</button>
                </div>
                {escopo === 'seguintes' && (
                  <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '8px 0 0', lineHeight: 1.45 }}>
                    As próximas sessões desta série acompanham o novo dia/horário, no mesmo intervalo. Sessões já realizadas não mudam. O paciente recebe um aviso único no WhatsApp.
                  </p>
                )}
              </div>
            )}

            {erro && <div style={{ color: 'var(--rose)', fontSize: 12, marginBottom: 8 }}>{erro}</div>}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button onClick={() => router.push(`/sessao/${sessao.id}`)} className="btn primary" style={{ background: 'var(--sage)' }}>
                Ir para a sessão →
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setAberto(false)} disabled={salvando} className="btn ghost">Fechar</button>
                <button onClick={salvar} disabled={salvando} className="btn primary">{salvando ? 'Salvando…' : 'Salvar'}</button>
              </div>
            </div>

            {/* Sessão travada em "em andamento": aba fechada ou queda no meio.
                O cron resolve em 6h; aqui ela resolve na hora. */}
            {emCurso && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div className="sec-lbl" style={{ marginBottom: 6 }}>Sessão em andamento</div>
                {confirmandoAcao !== 'destravar' ? (
                  <>
                    <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '0 0 8px', lineHeight: 1.45 }}>
                      Se esta sessão não está mesmo acontecendo, destrave: ela volta pra agenda,
                      pode ser remarcada e a cota de IA é estornada. Nada é enviado ao paciente.
                    </p>
                    <button onClick={() => { setErroAcao(null); setConfirmandoAcao('destravar') }} disabled={processando}
                      className="btn ghost" style={{ fontSize: 12.5 }}>
                      Destravar sessão
                    </button>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
                      Destravar? O que tiver sido transcrito é descartado.
                    </span>
                    <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                      <button onClick={() => setConfirmandoAcao(null)} disabled={processando} className="btn ghost" style={{ fontSize: 12.5 }}>Não</button>
                      <button onClick={destravar} disabled={processando} className="btn primary" style={{ fontSize: 12.5 }}>
                        {processando ? 'Destravando…' : 'Sim, destravar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(podeCancelar || podeNoShow) && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div className="sec-lbl" style={{ marginBottom: 8 }}>A sessão não vai acontecer</div>
                {confirmandoAcao !== 'cancelar' ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {podeCancelar && (
                      <button onClick={() => { setErroAcao(null); setConfirmandoAcao('cancelar') }} disabled={processando}
                        className="btn ghost" style={{ fontSize: 12.5, color: 'var(--rose)' }}>
                        Cancelar sessão
                      </button>
                    )}
                    {podeNoShow && (
                      <button onClick={alternarNoShow} disabled={processando}
                        className="btn ghost" style={{ fontSize: 12.5 }}>
                        {processando ? 'Salvando…' : ehNoShow ? 'Desfazer sem comparecimento' : 'Sem comparecimento'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.45 }}>
                      Cancelar avisa o paciente no WhatsApp e no email.
                      {sessao.pagamentoStatus === 'pago' && ' Se faltam mais de 24h, o valor é reembolsado.'}
                    </span>
                    <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                      <button onClick={() => setConfirmandoAcao(null)} disabled={processando} className="btn ghost" style={{ fontSize: 12.5 }}>Voltar</button>
                      <button onClick={cancelar} disabled={processando} className="btn primary" style={{ background: 'var(--rose)', fontSize: 12.5 }}>
                        {processando ? 'Cancelando…' : 'Sim, cancelar'}
                      </button>
                    </div>
                  </div>
                )}
                <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '8px 0 0', lineHeight: 1.45 }}>
                  <strong>Cancelar</strong> desmarca e avisa o paciente. <strong>Sem comparecimento</strong> é só
                  anotação de agenda — entra nos indicadores, sem mensagem nenhuma.
                </p>
              </div>
            )}

            {erroAcao && <div style={{ color: 'var(--rose)', fontSize: 12, marginTop: 8 }}>{erroAcao}</div>}
            {okAcao && <div style={{ color: 'var(--sage)', fontSize: 12, marginTop: 8 }}>{okAcao}</div>}

            {podeExcluir && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <ExcluirSessao
                  sessaoId={sessao.id}
                  status={sessao.status}
                  temAnotacaoViva={temAnotacaoViva(sessao.indicadores)}
                  variante="bloco"
                  aoExcluir={() => setAberto(false)}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'var(--muted)' }}>{k}</span>
      <span style={{ color: 'var(--ink-soft)', textAlign: 'right' }}>{v}</span>
    </div>
  )
}

const cap: React.CSSProperties = { fontSize: 11, color: 'var(--muted)' }
const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'white', fontSize: 14, fontFamily: 'inherit', color: 'var(--ink)', outline: 'none',
}

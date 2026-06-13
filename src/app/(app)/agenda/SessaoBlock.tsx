'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { reagendarSessaoAction, excluirSessaoAction } from './actions'
import { horarioBrasiliaParaISO, TZ } from '@/lib/formatters'

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
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erroExcluir, setErroExcluir] = useState<string | null>(null)

  // Só sessões que ainda não aconteceram E sem cobrança ativa/paga podem ser
  // excluídas (prontuário não se apaga; cobrança ativa não pode ser orfanizada).
  // O servidor revalida tudo isso de novo.
  const semCobrancaAtiva = sessao.pagamentoStatus !== 'pago' && !(sessao.pagarmeOrderId && sessao.pagamentoStatus === 'pendente')
  const podeExcluir = !sessao.assinada && sessao.status !== 'concluida' && sessao.status !== 'em_curso' && semCobrancaAtiva

  function abrir() {
    const p = partesLocais(sessao.dataHora)
    setData(p.data); setHora(p.hora); setDuracao(sessao.duracaoMin ?? 50); setModalidade(sessao.modalidade ?? 'online')
    setErro(null); setConfirmando(false); setErroExcluir(null); setAberto(true)
  }

  async function salvar() {
    setErro(null)
    const iso = horarioBrasiliaParaISO(data, hora)
    if (!iso) { setErro('Data/hora inválida.'); return }
    setSalvando(true)
    const r = await reagendarSessaoAction(sessao.id, { dataHora: iso, duracaoMin: duracao, modalidade })
    setSalvando(false)
    if (!r.ok) { setErro(r.error ?? 'Não foi possível salvar.'); return }
    setAberto(false); router.refresh()
  }

  async function excluir() {
    setErroExcluir(null); setExcluindo(true)
    const r = await excluirSessaoAction(sessao.id)
    setExcluindo(false)
    if (!r.ok) { setErroExcluir(r.error ?? 'Não foi possível excluir.'); setConfirmando(false); return }
    setAberto(false); router.refresh()
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
            <h3 style={{ margin: '0 0 2px' }}>{sessao.pacienteNome}</h3>
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

            {podeExcluir && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                {!confirmando ? (
                  <button onClick={() => { setErroExcluir(null); setConfirmando(true) }} disabled={salvando}
                    className="btn ghost" style={{ color: 'var(--rose)', fontSize: 12.5, padding: '5px 10px' }}>
                    🗑 Excluir sessão
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Excluir de vez? Não dá pra desfazer.</span>
                    <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                      <button onClick={() => setConfirmando(false)} disabled={excluindo} className="btn ghost" style={{ fontSize: 12.5 }}>Não</button>
                      <button onClick={excluir} disabled={excluindo} className="btn primary" style={{ background: 'var(--rose)', fontSize: 12.5 }}>
                        {excluindo ? 'Excluindo…' : 'Sim, excluir'}
                      </button>
                    </div>
                  </div>
                )}
                {erroExcluir && <div style={{ color: 'var(--rose)', fontSize: 12, marginTop: 8 }}>{erroExcluir}</div>}
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

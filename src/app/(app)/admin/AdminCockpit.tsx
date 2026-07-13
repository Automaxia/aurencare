'use client'

import { Fragment, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/feedback/Toast'
import type { UsuarioAdmin } from '@/server/services/admin'
import type { LoginEvento } from '@/server/services/usoPsicologo'
import { suspenderUsuarioAction, definirRoleAction, excluirUsuarioAction, historicoLoginsAction } from './actions'
import { formatPhone } from '@/lib/formatters'

const STATUS_CHIP: Record<string, { txt: string; bg: string; fg: string }> = {
  ativo:     { txt: 'Ativo',     bg: 'rgba(90,158,138,.14)', fg: '#2a6456' },
  suspenso:  { txt: 'Suspenso',  bg: 'rgba(196,96,122,.14)', fg: 'var(--rose)' },
  inativo:   { txt: 'Inativo',   bg: 'var(--surface)',       fg: 'var(--muted)' },
  bloqueado: { txt: 'Bloqueado', bg: 'rgba(196,96,122,.14)', fg: 'var(--rose)' },
}

function relativo(iso: string | null): string {
  if (!iso) return '—'
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const dias = Math.floor(h / 24)
  if (dias < 30) return `há ${dias}d`
  const meses = Math.floor(dias / 30)
  return `há ${meses} ${meses > 1 ? 'meses' : 'mês'}`
}
const dataCompleta = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR') : '')

export function AdminCockpit({ usuarios, adminId }: { usuarios: UsuarioAdmin[]; adminId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const [expandido, setExpandido] = useState<string | null>(null)
  const [historico, setHistorico] = useState<Record<string, LoginEvento[] | 'loading'>>({})

  const [excluir, setExcluir] = useState<UsuarioAdmin | null>(null)
  const [emailConfirma, setEmailConfirma] = useState('')
  const [excluindo, setExcluindo] = useState(false)

  function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>, sucesso: string) {
    setPendingId(id)
    startTransition(async () => {
      const r = await fn()
      setPendingId(null)
      if (r.ok) { toast(sucesso); router.refresh() }
      else { toast(r.error ?? 'Falha na operação', 'error') }
    })
  }

  function suspender(u: UsuarioAdmin) {
    const reativar = u.status !== 'ativo'
    if (!reativar && !confirm(`Suspender ${u.nome}? A pessoa não conseguirá entrar até ser reativada.`)) return
    run(u.id, () => suspenderUsuarioAction(u.id, reativar ? 'ativo' : 'suspenso'),
      reativar ? 'Conta reativada' : 'Conta suspensa')
  }

  function alternarRole(u: UsuarioAdmin) {
    const novo = u.role === 'admin' ? 'psicologo' : 'admin'
    if (!confirm(novo === 'admin' ? `Tornar ${u.nome} administrador?` : `Remover admin de ${u.nome}?`)) return
    run(u.id, () => definirRoleAction(u.id, novo), 'Papel atualizado')
  }

  function toggleExpand(u: UsuarioAdmin) {
    if (expandido === u.id) { setExpandido(null); return }
    setExpandido(u.id)
    if (!historico[u.id]) {
      setHistorico(h => ({ ...h, [u.id]: 'loading' }))
      historicoLoginsAction(u.id)
        .then(evts => setHistorico(h => ({ ...h, [u.id]: evts })))
        .catch(() => setHistorico(h => ({ ...h, [u.id]: [] })))
    }
  }

  function confirmarExclusao() {
    if (!excluir) return
    setExcluindo(true)
    const alvo = excluir
    startTransition(async () => {
      const r = await excluirUsuarioAction(alvo.id, emailConfirma)
      setExcluindo(false)
      if (r.ok) {
        toast(`${alvo.nome} excluído`)
        setExcluir(null); setEmailConfirma('')
        router.refresh()
      } else {
        toast(r.error ?? 'Não foi possível excluir', 'error')
      }
    })
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              <th style={{ ...th, width: 24 }}></th>
              <th style={th}>Usuário</th>
              <th style={th}>Papel</th>
              <th style={th}>Status</th>
              <th style={{ ...th, textAlign: 'right' }}>Pac.</th>
              <th style={{ ...th, textAlign: 'right' }}>Sess.</th>
              <th style={{ ...th, textAlign: 'right' }}>Último login</th>
              <th style={{ ...th, textAlign: 'right' }}>Logins</th>
              <th style={{ ...th, textAlign: 'right' }}>Visto por último</th>
              <th style={{ ...th, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => {
              const chip = STATUS_CHIP[u.status] ?? STATUS_CHIP.inativo
              const eu = u.id === adminId
              const busy = pendingId === u.id
              const aberto = expandido === u.id
              const hist = historico[u.id]
              return (
                <Fragment key={u.id}>
                  <tr style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <button onClick={() => toggleExpand(u)} className="btn ghost sm" title="Histórico de acessos"
                        style={{ padding: '2px 6px', color: 'var(--muted)' }}>{aberto ? '▾' : '▸'}</button>
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight: 500, color: 'var(--ink-soft)' }}>
                        {u.nome} {eu && <span style={{ fontSize: 10, color: 'var(--faint)' }}>(você)</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        <a href={`mailto:${u.email}`} style={{ color: 'inherit', textDecoration: 'none' }} title="Enviar e-mail">{u.email}</a>
                        {u.telefone
                          ? <><span style={{ color: 'var(--faint)' }}>·</span><a href={`tel:${u.telefone.replace(/\D/g, '')}`} style={{ color: 'inherit', textDecoration: 'none' }} title="Ligar / WhatsApp">{formatPhone(u.telefone)}</a></>
                          : <><span style={{ color: 'var(--faint)' }}>·</span><span style={{ color: 'var(--faint)' }}>sem telefone</span></>}
                        <span style={{ color: 'var(--faint)' }}>·</span><span>{u.crp}</span>
                      </div>
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: u.role === 'admin' ? 'var(--accent)' : 'var(--muted)' }}>
                        {u.role === 'admin' ? 'Admin' : 'Psicólogo'}
                      </span>
                    </td>
                    <td style={td}>
                      <span style={{ padding: '3px 9px', borderRadius: 999, background: chip.bg, color: chip.fg, fontSize: 11, fontWeight: 500 }}>{chip.txt}</span>
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{u.pacientes}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{u.sessoes}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--muted)', whiteSpace: 'nowrap' }} title={dataCompleta(u.ultimoLoginEm)}>{relativo(u.ultimoLoginEm)}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: u.loginCount > 0 ? 'var(--ink-soft)' : 'var(--faint)' }}>{u.loginCount}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--muted)', whiteSpace: 'nowrap' }} title={dataCompleta(u.ultimoAcessoEm)}>{relativo(u.ultimoAcessoEm)}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn ghost sm" disabled={eu || busy} onClick={() => alternarRole(u)} style={{ marginRight: 6 }}>
                        {u.role === 'admin' ? '↓ Psicólogo' : '↑ Admin'}
                      </button>
                      <button
                        className={`btn sm${u.status === 'ativo' ? '' : ' primary'}`}
                        disabled={eu || busy}
                        onClick={() => suspender(u)}
                        style={{ marginRight: 6, ...(u.status === 'ativo' ? { color: 'var(--rose)' } : {}) }}
                      >
                        {busy ? '…' : u.status === 'ativo' ? 'Suspender' : 'Reativar'}
                      </button>
                      <button className="btn ghost sm" disabled={eu || busy} onClick={() => { setExcluir(u); setEmailConfirma('') }}
                        title="Excluir permanentemente" style={{ color: 'var(--rose)' }}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                  {aberto && (
                    <tr style={{ background: 'var(--surface)' }}>
                      <td></td>
                      <td colSpan={9} style={{ padding: '10px 14px 14px' }}>
                        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                          Últimos acessos
                        </div>
                        {hist === 'loading' && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Carregando…</div>}
                        {hist === undefined && <div style={{ fontSize: 12, color: 'var(--muted)' }}>—</div>}
                        {Array.isArray(hist) && hist.length === 0 && (
                          <div style={{ fontSize: 12, color: 'var(--faint)' }}>Nenhum login registrado ainda.</div>
                        )}
                        {Array.isArray(hist) && hist.length > 0 && (
                          <div style={{ display: 'grid', gap: 3 }}>
                            {hist.map((e, i) => (
                              <div key={i} style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--ink-soft)', fontVariantNumeric: 'tabular-nums' }}>
                                <span style={{ minWidth: 150 }}>{new Date(e.em).toLocaleString('pt-BR')}</span>
                                <span style={{ color: 'var(--muted)', minWidth: 110 }}>{e.ip ?? '—'}</span>
                                <span style={{ color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.userAgent ?? ''}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {usuarios.length === 0 && (
        <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Nenhum usuário.</div>
      )}

      {excluir && (
        <div role="dialog" aria-modal="true" onClick={() => !excluindo && setExcluir(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(20,16,38,.5)', backdropFilter: 'blur(3px)',
          display: 'grid', placeItems: 'center', zIndex: 80, padding: 16,
        }}>
          <div className="card" onClick={e => e.stopPropagation()} style={{ width: 'min(440px, 94vw)', padding: 22 }}>
            <h3 style={{ margin: '0 0 6px', color: 'var(--rose)' }}>Excluir {excluir.nome}?</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5, margin: '0 0 12px' }}>
              Isso apaga <strong>permanentemente</strong> a conta e, em cascata,{' '}
              <strong>{excluir.pacientes} paciente{excluir.pacientes !== 1 ? 's' : ''}</strong> e{' '}
              <strong>{excluir.sessoes} {excluir.sessoes === 1 ? 'sessão' : 'sessões'}</strong> (transcrições, prontuários, tudo).
              Não dá pra desfazer.
            </p>
            <label style={{ display: 'grid', gap: 4, marginBottom: 14 }}>
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Digite <code style={{ color: 'var(--ink)' }}>{excluir.email}</code> para confirmar</span>
              <input
                autoFocus value={emailConfirma} onChange={e => setEmailConfirma(e.target.value)}
                placeholder={excluir.email}
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'white', fontSize: 14, fontFamily: 'inherit', color: 'var(--ink)', outline: 'none' }}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setExcluir(null)} disabled={excluindo} className="btn ghost">Cancelar</button>
              <button
                onClick={confirmarExclusao}
                disabled={excluindo || emailConfirma.trim().toLowerCase() !== excluir.email.toLowerCase()}
                className="btn primary" style={{ background: 'var(--rose)' }}
              >
                {excluindo ? 'Excluindo…' : 'Excluir de vez'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: '12px 14px', fontWeight: 500 }
const td: React.CSSProperties = { padding: '12px 14px', verticalAlign: 'middle' }

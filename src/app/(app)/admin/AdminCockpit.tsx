'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/feedback/Toast'
import type { UsuarioAdmin } from '@/server/services/admin'
import { suspenderUsuarioAction, definirRoleAction } from './actions'

const STATUS_CHIP: Record<string, { txt: string; bg: string; fg: string }> = {
  ativo:     { txt: 'Ativo',     bg: 'rgba(90,158,138,.14)', fg: '#2a6456' },
  suspenso:  { txt: 'Suspenso',  bg: 'rgba(196,96,122,.14)', fg: 'var(--rose)' },
  inativo:   { txt: 'Inativo',   bg: 'var(--surface)',       fg: 'var(--muted)' },
  bloqueado: { txt: 'Bloqueado', bg: 'rgba(196,96,122,.14)', fg: 'var(--rose)' },
}

export function AdminCockpit({ usuarios, adminId }: { usuarios: UsuarioAdmin[]; adminId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

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

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              <th style={th}>Usuário</th>
              <th style={th}>Papel</th>
              <th style={th}>Status</th>
              <th style={th}>Plano</th>
              <th style={{ ...th, textAlign: 'right' }}>Pacientes</th>
              <th style={{ ...th, textAlign: 'right' }}>Sessões</th>
              <th style={{ ...th, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => {
              const chip = STATUS_CHIP[u.status] ?? STATUS_CHIP.inativo
              const eu = u.id === adminId
              const busy = pendingId === u.id
              return (
                <tr key={u.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}>
                    <div style={{ fontWeight: 500, color: 'var(--ink-soft)' }}>
                      {u.nome} {eu && <span style={{ fontSize: 10, color: 'var(--faint)' }}>(você)</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{u.email} · {u.crp}</div>
                  </td>
                  <td style={td}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: u.role === 'admin' ? 'var(--accent)' : 'var(--muted)' }}>
                      {u.role === 'admin' ? 'Admin' : 'Psicólogo'}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{ padding: '3px 9px', borderRadius: 999, background: chip.bg, color: chip.fg, fontSize: 11, fontWeight: 500 }}>{chip.txt}</span>
                  </td>
                  <td style={{ ...td, color: 'var(--muted)' }}>{u.plano ?? '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{u.pacientes}</td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{u.sessoes}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn ghost sm" disabled={eu || busy} onClick={() => alternarRole(u)} style={{ marginRight: 6 }}>
                      {u.role === 'admin' ? '↓ Psicólogo' : '↑ Admin'}
                    </button>
                    <button
                      className={`btn sm${u.status === 'ativo' ? '' : ' primary'}`}
                      disabled={eu || busy}
                      onClick={() => suspender(u)}
                      style={u.status === 'ativo' ? { color: 'var(--rose)' } : undefined}
                    >
                      {busy ? '…' : u.status === 'ativo' ? 'Suspender' : 'Reativar'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {usuarios.length === 0 && (
        <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Nenhum usuário.</div>
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: '12px 14px', fontWeight: 500 }
const td: React.CSSProperties = { padding: '12px 14px', verticalAlign: 'middle' }

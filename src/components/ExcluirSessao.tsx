'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { excluirSessaoAction } from '@/app/(app)/agenda/actions'

type Props = {
  sessaoId: string
  /** Status da sessão — muda só a copy (concluída ganha explicação do efeito). */
  status: string
  /** Nota rápida ou risco marcado ao vivo: some junto, então a confirmação avisa. */
  temAnotacaoViva?: boolean
  /** `inline` = só o ícone (listas). `bloco` = botão com rótulo (modal da agenda). */
  variante?: 'inline' | 'bloco'
  /** Chamado depois de excluir — pra fechar o modal que envolve o botão. */
  aoExcluir?: () => void
}

/**
 * Botão de excluir sessão vazia. Vive na agenda, na tabela de Saúde da Prática e
 * no histórico do paciente — por isso é componente, não markup repetido.
 *
 * Quem renderiza decide SE aparece (via `podeExcluirSessao` de
 * `@/lib/sessaoExclusao`, calculado no servidor); aqui só cuida da confirmação.
 */
export function ExcluirSessao({
  sessaoId, status, temAnotacaoViva = false, variante = 'inline', aoExcluir,
}: Props) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function excluir() {
    setErro(null); setExcluindo(true)
    const r = await excluirSessaoAction(sessaoId)
    setExcluindo(false)
    if (!r.ok) { setErro(r.error ?? 'Não foi possível excluir.'); setConfirmando(false); return }
    setConfirmando(false)
    aoExcluir?.()
    router.refresh()
  }

  if (!confirmando) {
    return (
      <div style={{ display: 'grid', gap: 6, justifyItems: variante === 'inline' ? 'end' : 'start' }}>
        {variante === 'bloco' && status === 'concluida' && (
          <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: 0, lineHeight: 1.45 }}>
            Esta sessão foi encerrada sem registrar nada. Excluir tira ela da pendência
            de registro do paciente e dos indicadores da prática.
          </p>
        )}
        <button
          type="button"
          onClick={e => { e.preventDefault(); e.stopPropagation(); setErro(null); setConfirmando(true) }}
          className="btn ghost"
          title="Excluir sessão vazia"
          aria-label="Excluir sessão"
          style={{
            color: 'var(--rose)', fontSize: 12.5, padding: variante === 'inline' ? '4px 7px' : '5px 10px',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          <Trash2 size={14} />{variante === 'bloco' && ' Excluir sessão'}
        </button>
        {erro && <span style={{ color: 'var(--rose)', fontSize: 11.5 }}>{erro}</span>}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {/* maxWidth pra confirmação dentro de célula de tabela não esticar a coluna. */}
      <span style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.4, maxWidth: 280 }}>
        {temAnotacaoViva
          ? 'Não há registro clínico, mas há anotação feita ao vivo (nota rápida ou risco) — ela some junto. Excluir de vez?'
          : 'Excluir de vez? Não dá pra desfazer.'}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={e => { e.preventDefault(); setConfirmando(false) }}
          disabled={excluindo} className="btn ghost" style={{ fontSize: 12.5 }}>Não</button>
        <button type="button" onClick={e => { e.preventDefault(); excluir() }}
          disabled={excluindo} className="btn primary" style={{ background: 'var(--rose)', fontSize: 12.5 }}>
          {excluindo ? 'Excluindo…' : 'Sim, excluir'}
        </button>
      </div>
    </div>
  )
}

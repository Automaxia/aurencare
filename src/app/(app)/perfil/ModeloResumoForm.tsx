'use client'

import { useState } from 'react'
import Link from 'next/link'
import { salvarModeloResumoAction } from './actions'
import { SavedBadge } from '@/components/brand/Feedback'
import { MODELO_RESUMO_EXEMPLO, MODELO_RESUMO_MAX, MODELO_RESUMO_MIN } from '@/lib/modeloResumo'
import { formatDateTimeBR } from '@/lib/formatters'

/**
 * Modelo de resumo personalizado (Pro). Texto livre: o psicólogo descreve as
 * seções, a extensão e o estilo do registro que a Audere gera ao encerrar a
 * sessão. Vazio = modelo padrão da Audere.
 */
export function ModeloResumoForm({ initial, atualizadoEm, liberado }: {
  initial: string
  atualizadoEm: string | null
  liberado: boolean
}) {
  const [texto, setTexto] = useState(initial)
  const [salvo, setSalvo] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sujo = texto.trim() !== salvo.trim()
  const usando = salvo.trim() ? 'personalizado' : 'padrão da Audere'

  async function salvar(valor: string) {
    setLoading(true); setError(null); setSaved(false)
    try {
      const r = await salvarModeloResumoAction(valor.trim() || null)
      if (r.ok) {
        setSalvo(valor.trim()); setTexto(valor.trim())
        setSaved(true); setTimeout(() => setSaved(false), 2500)
      } else setError(r.erro)
    } catch {
      setError('Falha ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ display: 'grid', gap: 12, maxWidth: 720, marginTop: 18 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Modelo de resumo da sessão
          </span>
          <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 999, background: 'rgba(106,78,200,.10)', color: '#391d96', fontWeight: 500 }}>Pro</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 4, lineHeight: 1.5 }}>
          Descreva como você quer o registro que a Audere prepara ao encerrar a sessão: quais seções, em que ordem,
          com que extensão e estilo. As regras do CFP (sem diagnóstico, só o que ocorreu na sessão, rascunho para
          sua assinatura) valem sempre. O laudo formal segue o formato CFP.
        </div>
      </div>

      {!liberado ? (
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', background: 'var(--surface)', borderRadius: 8, padding: 12, lineHeight: 1.5 }}>
          Disponível no plano Pro. Hoje seus resumos usam o modelo padrão da Audere.
          {salvo.trim() && ' Seu modelo salvo continua guardado e volta a valer quando você assinar o Pro.'}
          <div style={{ marginTop: 10 }}>
            <Link href="/planos" className="btn primary">Conhecer o Pro</Link>
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Em uso: <strong>{usando}</strong>
            {salvo.trim() && atualizadoEm && <> · atualizado em {formatDateTimeBR(atualizadoEm)}</>}
          </div>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            maxLength={MODELO_RESUMO_MAX}
            placeholder={'Ex.:\n## Queixa e contexto\nUm parágrafo curto…\n\n## Intervenções\nLista com as técnicas usadas…\n\n## Plano para a próxima sessão\n…'}
            style={{
              width: '100%', boxSizing: 'border-box', minHeight: 260, resize: 'vertical',
              fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: 12.5, lineHeight: 1.55,
              padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--faint)' }}>
            <span>
              {!texto.trim() && (
                <button type="button" className="btn ghost sm" onClick={() => setTexto(MODELO_RESUMO_EXEMPLO)}>
                  Começar a partir do modelo padrão
                </button>
              )}
            </span>
            <span>{texto.length}/{MODELO_RESUMO_MAX}</span>
          </div>

          {error && <div style={{ color: 'var(--rose)', fontSize: 12 }}>{error}</div>}
          {saved && <SavedBadge />}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {salvo.trim() && (
              <button className="btn ghost" onClick={() => salvar('')} disabled={loading}
                title="Apaga o seu modelo e volta ao padrão da Audere">
                Voltar ao padrão
              </button>
            )}
            <button className="btn primary" onClick={() => salvar(texto)}
              disabled={loading || !sujo || (!!texto.trim() && texto.trim().length < MODELO_RESUMO_MIN)}>
              {loading ? 'Salvando…' : 'Salvar modelo'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

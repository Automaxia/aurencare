'use client'
/* Checagem de humor interativa no palco — o PACIENTE responde durante a sessão
   (escala −5..+5) e a resposta volta pro psicólogo, alimentando o indicador de
   humor da sessão. Mão dupla pelo canal app do WebRTC. */
import { useState } from 'react'

const EMO_LABELS: Record<number, string> = {
  [-5]: 'Extremamente desagradável', [-4]: 'Muito desagradável', [-3]: 'Desagradável',
  [-2]: 'Levemente desagradável', [-1]: 'Pouco desagradável', 0: 'Neutro',
  1: 'Pouco agradável', 2: 'Levemente agradável', 3: 'Agradável',
  4: 'Muito agradável', 5: 'Extremamente agradável',
}
const fmt = (v: number) => (v > 0 ? `+${v}` : `${v}`)

export function ChecagemHumor({ role, resposta, onResponder }: {
  role: 'psicologo' | 'paciente'
  resposta: number | null
  onResponder?: (valor: number) => void
}) {
  const [sel, setSel] = useState(0)
  const [enviado, setEnviado] = useState(false)

  // ── Lado do PSICÓLOGO: só recebe/mostra ──
  if (role !== 'paciente') {
    return (
      <div className="palco-humor">
        <div className="vc-palco-titulo">Checagem de humor</div>
        {resposta == null ? (
          <div className="palco-humor-espera">Aguardando o paciente responder…</div>
        ) : (
          <div className="palco-humor-result">
            O paciente respondeu <b>{fmt(resposta)}</b> — {EMO_LABELS[resposta]}.
            <div className="palco-humor-nota">Registrado no humor da sessão.</div>
          </div>
        )}
      </div>
    )
  }

  // ── Lado do PACIENTE: responde ──
  if (enviado || resposta != null) {
    const v = resposta ?? sel
    return (
      <div className="palco-humor">
        <div className="vc-palco-titulo">Obrigado 💜</div>
        <div className="palco-humor-result">Registrado: <b>{EMO_LABELS[v]}</b>.</div>
      </div>
    )
  }
  return (
    <div className="palco-humor">
      <div className="vc-palco-titulo">Como você está se sentindo agora?</div>
      <div className="palco-humor-label">{EMO_LABELS[sel]}</div>
      <input
        type="range" min={-5} max={5} step={1} value={sel}
        onChange={e => setSel(+e.target.value)}
        className="palco-humor-range"
        aria-label="Como você está se sentindo agora"
      />
      <div className="palco-humor-ends">
        <span>desagradável</span><span>neutro</span><span>agradável</span>
      </div>
      <button className="btn-lp-like palco-humor-enviar" onClick={() => { onResponder?.(sel); setEnviado(true) }}>
        Enviar
      </button>
    </div>
  )
}

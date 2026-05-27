import { CfpBadge } from '@/components/brand/CfpBadge'
import Link from 'next/link'

/**
 * Modo Presença — shell. Layout 2 colunas + PresenceBar. §7.
 * Conteúdo real (transcrição WS, widgets, marcação de turnos) — Fase B.5.
 */
export default function SessaoPage({ params }: { params: { id: string } }) {
  return (
    <>
      <div className="pbar">
        <div>
          <span className="pb-name">Sessão</span>
          <span className="pb-meta">· {params.id.slice(0, 8)} · Presente · 00:00</span>
        </div>
        <div className="pb-actions">
          <CfpBadge />
          <button className="btn">Encerrar</button>
          <Link className="btn ghost" href="/">← Voltar</Link>
        </div>
      </div>

      <div className="sess-layout">
        <div className="talk-card">
          <p style={{ color: 'var(--muted)', fontSize: 12 }}>
            Transcrição ao vivo — implementação na Fase B.5 (WebSocket + AssemblyAI Realtime).
          </p>
        </div>
        <div className="sess-right">
          <Widget title="Ritmo da conversa" />
          <Widget title="Temas desta sessão" />
          <Widget title="Checagem de humor" wide />
          <Widget title="Informações do paciente" />
          <Widget title="Avaliação de risco" />
          <Widget title="Última sessão" wide />
          <Widget title="Tópicos em aberto" />
          <Widget title="Nota rápida" />
        </div>
      </div>
    </>
  )
}

function Widget({ title, wide }: { title: string; wide?: boolean }) {
  return (
    <div className={`widget${wide ? ' wide' : ''}`} data-widget-id={title}>
      <div className="widget-grip" aria-hidden="true">⠿</div>
      <div className="widget-title">{title}</div>
      <div style={{ color: 'var(--muted)', fontSize: 12 }}>—</div>
    </div>
  )
}

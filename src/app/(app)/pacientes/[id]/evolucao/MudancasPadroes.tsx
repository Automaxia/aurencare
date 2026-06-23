import type { MudancasPadroes as Dados } from '@/server/services/mudancasEPadroes'

/** "O que mudou" + "Padrões recorrentes" — determinístico (Fase 3). */
export function MudancasPadroes({ dados }: { dados: Dados }) {
  const { mudancas, padroes } = dados
  if (mudancas.length === 0 && padroes.length === 0) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 16 }}>
      <section className="card" style={{ padding: 18 }}>
        <Rotulo>O que mudou</Rotulo>
        {mudancas.length === 0 ? (
          <Vazio>Sem mudanças marcantes ainda — aparecem ao longo do processo.</Vazio>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 7 }}>
            {mudancas.map((m, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.45 }}>
                <span style={{ color: 'var(--sage)', flex: 'none' }}>✓</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" style={{ padding: 18 }}>
        <Rotulo>Padrões recorrentes</Rotulo>
        {padroes.length === 0 ? (
          <Vazio>Aparecem conforme os temas começam a co-ocorrer entre as sessões.</Vazio>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 7 }}>
            {padroes.map((p, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.45 }}>
                <span style={{ color: 'var(--faint)', flex: 'none' }}>•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}
        <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 10 }}>co-ocorrência observada, não relação causal</div>
      </section>
    </div>
  )
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 600, marginBottom: 10 }}>{children}</div>
}
function Vazio({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.5 }}>{children}</div>
}

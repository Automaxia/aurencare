import Link from 'next/link'
import type { MemoriaClinicaDados } from '@/server/services/memoriaClinica'

/**
 * Rail do briefing — Memória Clínica (fatos longitudinais) + Continuidade
 * (sinais ↑↓→). Tudo determinístico. Server component.
 */
export function MemoriaClinica({ dados, pacienteId }: { dados: MemoriaClinicaDados; pacienteId: string }) {
  const { fatos, continuidade } = dados
  const c = continuidade
  const temContinuidade = c.emergindo.length || c.recorrente.length || c.recuando.length || c.objetivos.length
  const vazio = fatos.length === 0 && !temContinuidade

  return (
    <aside className="card" style={{ padding: 18, display: 'grid', gap: 16, alignContent: 'start' }}>
      <div>
        <Rotulo>Memória clínica</Rotulo>
        {fatos.length === 0 ? (
          <Vazio>{vazio ? 'Aparece conforme você assina sessões — o que se repete, o que persiste.' : 'Sem padrões marcantes ainda.'}</Vazio>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
            {fatos.map((f, i) => (
              <li key={i}>
                <Link href={f.href} style={{
                  display: 'flex', gap: 8, alignItems: 'baseline', textDecoration: 'none',
                  fontSize: 12.5, lineHeight: 1.45, color: f.destaque ? 'var(--ink)' : 'var(--ink-soft)',
                  fontWeight: f.destaque ? 500 : 400,
                }}>
                  <span style={{ color: f.destaque ? 'var(--amber)' : 'var(--faint)', flex: 'none' }}>{f.destaque ? '↻' : '•'}</span>
                  <span>{f.texto}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!!temContinuidade && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <Rotulo>Continuidade</Rotulo>
          <div style={{ display: 'grid', gap: 7 }}>
            <Sinal icone="↑" cor="var(--sage)"   rotulo="emergindo"  itens={c.emergindo} />
            <Sinal icone="→" cor="var(--accent)" rotulo="recorrente" itens={c.recorrente} />
            <Sinal icone="↓" cor="var(--muted)"  rotulo="recuando"   itens={c.recuando} />
            {c.objetivos.map((o, i) => (
              <Linha key={`obj-${i}`} icone="◬" cor={o.estado === 'avancando' ? 'var(--sage)' : 'var(--amber)'}>
                <span style={{ color: 'var(--muted)' }}>{o.estado === 'avancando' ? 'avançando' : 'estagnado'}</span> · {o.titulo}
              </Linha>
            ))}
          </div>
        </div>
      )}

      <Link href={`/pacientes/${pacienteId}/temas`} style={{ fontSize: 12, color: 'var(--accent)' }}>Ver grafo de temas →</Link>
    </aside>
  )
}

function Sinal({ icone, cor, rotulo, itens }: { icone: string; cor: string; rotulo: string; itens: string[] }) {
  if (itens.length === 0) return null
  return (
    <Linha icone={icone} cor={cor}>
      <span style={{ color: 'var(--muted)' }}>{rotulo}</span> · {itens.join(' · ')}
    </Linha>
  )
}
function Linha({ icone, cor, children }: { icone: string; cor: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink-soft)' }}>
      <span style={{ color: cor, flex: 'none', fontWeight: 600 }}>{icone}</span>
      <span style={{ minWidth: 0 }}>{children}</span>
    </div>
  )
}
function Rotulo({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 600, marginBottom: 10 }}>{children}</div>
}
function Vazio({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.5 }}>{children}</div>
}

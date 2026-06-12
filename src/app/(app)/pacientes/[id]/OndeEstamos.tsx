import Link from 'next/link'

/**
 * Bloco "Onde Estamos" — o coração do briefing clínico (Fase 1 do redesign).
 * Server component, só dados reais já existentes: objetivos ativos, temas
 * predominantes, última evolução registrada e atalhos de retomada.
 */

export type OndeEstamosProps = {
  pacienteId: string
  objetivos: { id: string; titulo: string; progresso: number }[]
  totalObjetivosAtivos: number
  temas: string[]
  ultimaEvolucao: { numero: number; quando: string; texto: string } | null
  proximaSessaoId: string | null
}

export function OndeEstamos(props: OndeEstamosProps) {
  const { pacienteId, objetivos, totalObjetivosAtivos, temas, ultimaEvolucao, proximaSessaoId } = props
  const temNada = objetivos.length === 0 && temas.length === 0 && !ultimaEvolucao

  return (
    <section className="card" style={{ padding: 18, marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 600 }}>
          Onde estamos
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {proximaSessaoId
            ? <Link className="btn primary sm" href={`/sessao/${proximaSessaoId}`}>▶ Abrir sessão</Link>
            : <Link className="btn primary sm" href="/agenda/nova">+ Nova sessão</Link>}
          <Link className="btn ghost sm" href={`/pacientes/${pacienteId}/evolucao`}>Evolução</Link>
        </div>
      </div>

      {temNada ? (
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>
          Ainda não há objetivos, temas ou sessões assinadas. Conforme você registra e
          assina sessões, este painel passa a resumir <strong>onde o processo está</strong>.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          {/* Coluna 1 — Objetivos */}
          <div>
            <Rotulo>Objetivos ativos</Rotulo>
            {objetivos.length === 0 ? (
              <Vazio>
                Nenhum objetivo ativo. <Link href={`/pacientes/${pacienteId}/objetivos`} style={{ color: 'var(--accent)' }}>Definir →</Link>
              </Vazio>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {objetivos.map(o => (
                  <Link key={o.id} href={`/pacientes/${pacienteId}/objetivos`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-soft)' }}>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>◬ {o.titulo}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{o.progresso}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 999, background: 'var(--surface)', marginTop: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(2, o.progresso)}%`, background: 'var(--accent)', opacity: .75 }} />
                    </div>
                  </Link>
                ))}
                {totalObjetivosAtivos > objetivos.length && (
                  <Link href={`/pacientes/${pacienteId}/objetivos`} style={{ fontSize: 12, color: 'var(--accent)' }}>
                    Ver todos ({totalObjetivosAtivos}) →
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Coluna 2 — Temas + Última evolução */}
          <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
            <div>
              <Rotulo>Temas predominantes</Rotulo>
              {temas.length === 0 ? (
                <Vazio>Aparecem conforme as sessões são assinadas.</Vazio>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {temas.map(t => (
                    <Link key={t} href={`/pacientes/${pacienteId}/temas`} style={{
                      fontSize: 12, padding: '3px 10px', borderRadius: 999,
                      background: 'var(--surface)', color: 'var(--ink-soft)', textDecoration: 'none',
                    }}>{t}</Link>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Rotulo>Última evolução</Rotulo>
              {ultimaEvolucao ? (
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.55 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Sessão {ultimaEvolucao.numero} · {ultimaEvolucao.quando}</span>
                  <p style={{ margin: '3px 0 0' }}>{ultimaEvolucao.texto || 'Sessão assinada sem resumo.'}</p>
                </div>
              ) : (
                <Vazio>Nenhuma sessão assinada ainda.</Vazio>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{children}</div>
}
function Vazio({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.5 }}>{children}</div>
}

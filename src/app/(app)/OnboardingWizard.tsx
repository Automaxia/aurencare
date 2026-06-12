import Link from 'next/link'
import type { OnboardingStatus } from '@/server/services/onboarding'
import { DemoControl } from './pacientes/DemoControl'

/**
 * Wizard de ativação na Home — os 4 primeiros passos do psicólogo. Some sozinho
 * quando há memória clínica (status.completo). CTA aparece só no próximo passo
 * pendente, pra guiar o foco sem poluir.
 */
export function OnboardingWizard({ status, nome, demoId }: { status: OnboardingStatus; nome: string; demoId?: string | null }) {
  const novato = status.concluidos === 0
  const evolHref = status.pacienteEvolucaoId
    ? `/pacientes/${status.pacienteEvolucaoId}/evolucao`
    : '/pacientes'

  const passos = [
    { feito: status.configurouPratica, titulo: 'Configure sua prática clínica', desc: 'Defina o valor da sessão e conecte o WhatsApp.', href: '/perfil', cta: 'Configurar' },
    { feito: status.temPaciente, titulo: 'Cadastre seu primeiro paciente', desc: 'Ele recebe tudo pelo WhatsApp — sem instalar nada.', href: '/pacientes/novo', cta: 'Cadastrar paciente' },
    { feito: status.temSessao, titulo: 'Registre sua primeira sessão', desc: 'Agende e registre — a transcrição acontece sozinha.', href: '/agenda/nova', cta: 'Agendar sessão' },
    { feito: status.temMemoria, titulo: 'Explore a memória clínica', desc: 'Veja temas, objetivos e evolução que a Audere organiza.', href: evolHref, cta: 'Abrir memória clínica' },
  ]
  const atual = passos.findIndex(p => !p.feito)

  return (
    <section style={{
      marginBottom: 22, padding: '20px 22px', borderRadius: 16,
      background: 'linear-gradient(135deg, rgba(106,78,200,.06), rgba(90,158,138,.05))',
      border: '1px solid var(--border)', position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'var(--f-display)', fontSize: 21, color: 'var(--ink)', lineHeight: 1.15 }}>
            {novato ? <>Bem-vindo(a) à Audere, <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>{nome}</em>.</> : 'Seus primeiros passos na Audere'}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
            {novato
              ? 'Vamos do zero à sua primeira memória clínica — quatro passos rápidos.'
              : 'Em poucos minutos você chega à primeira memória clínica.'}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {status.concluidos} de 4
        </div>
      </div>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
        {passos.map((p, i) => {
          const isAtual = i === atual
          return (
            <li key={i} style={{
              display: 'flex', alignItems: 'center', gap: 13,
              padding: '10px 12px', borderRadius: 10,
              background: isAtual ? 'var(--card)' : 'transparent',
              border: isAtual ? '1px solid var(--border)' : '1px solid transparent',
            }}>
              <span style={{
                flex: 'none', width: 24, height: 24, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600,
                background: p.feito ? 'var(--sage)' : isAtual ? 'var(--accent)' : 'var(--surface)',
                color: p.feito || isAtual ? '#fff' : 'var(--muted)',
                border: p.feito || isAtual ? 'none' : '1px solid var(--border)',
              }}>
                {p.feito ? '✓' : i + 1}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13.5, fontWeight: 500, lineHeight: 1.3,
                  color: p.feito ? 'var(--muted)' : 'var(--ink)',
                  textDecoration: p.feito ? 'line-through' : 'none',
                }}>{p.titulo}</div>
                {isAtual && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>{p.desc}</div>}
              </div>

              {isAtual && (
                <Link href={p.href} className="btn primary" style={{ flex: 'none', fontSize: 12.5, padding: '8px 14px', whiteSpace: 'nowrap' }}>
                  {p.cta} →
                </Link>
              )}
            </li>
          )
        })}
      </ol>

      <div style={{
        marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
          Quer explorar antes de cadastrar um paciente real? Conheça a <strong style={{ color: 'var(--ink-soft)' }}>Maria Joana</strong> — uma paciente de demonstração com sessões, objetivos e temas.
        </span>
        <DemoControl demoId={demoId ?? null} variant="onboarding" />
      </div>
    </section>
  )
}

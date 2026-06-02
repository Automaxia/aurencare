import Link from 'next/link'

/**
 * Banner persistente no topo de todas as páginas (app) quando a psicóloga
 * ainda não concluiu o onboarding de Recebimentos (Pagar.me Recipient).
 * Soft block — ela navega normalmente, mas ações de cobrança caem aqui.
 */
export function OnboardingBanner() {
  return (
    <div style={{
      padding: '10px 20px',
      background: 'rgba(176,125,64,.12)',
      borderBottom: '1px solid rgba(176,125,64,.22)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, fontSize: 13,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink-soft)' }}>
        <span style={{ fontSize: 16 }}>◐</span>
        <span>
          <strong>Configure seus recebimentos</strong> pra começar a cobrar sessões.
          O dinheiro cai direto na sua conta — Auren nunca toca o valor.
        </span>
      </div>
      <Link
        href="/onboarding/recebimentos"
        className="btn primary sm"
        style={{ whiteSpace: 'nowrap' }}
      >
        Configurar →
      </Link>
    </div>
  )
}

import Link from 'next/link'

/**
 * Banner no topo do app quando há algo a resolver no plano:
 * - cota de sessões-IA esgotada no mês, ou
 * - assinatura inadimplente (cobrança recorrente falhou).
 * Soft block — a psicóloga navega normalmente; só o registro com IA bloqueia.
 */
export function PlanoUsoBanner({ motivo, cap, gateway }: { motivo: 'limite' | 'inadimplente'; cap: number; gateway?: 'pagarme' | 'asaas' | null }) {
  const inadimplente = motivo === 'inadimplente'
  return (
    <div style={{
      padding: '10px 20px',
      background: inadimplente ? 'rgba(196,96,122,.12)' : 'rgba(196,96,122,.10)',
      borderBottom: '1px solid rgba(196,96,122,.22)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, fontSize: 13,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink-soft)' }}>
        <span style={{ fontSize: 16 }}>●</span>
        <span>
          {inadimplente ? (
            gateway === 'asaas'
              // Asaas: não há cartão salvo na Audere — o plano ativa quando a fatura é paga.
              ? <><strong>Fatura da assinatura em aberto.</strong> Pague a fatura para ativar o registro com IA do seu plano.</>
              : <><strong>Pagamento da assinatura pendente.</strong> Atualize seu cartão para manter o registro com IA ativo.</>
          ) : (
            <><strong>Limite de {cap} sessões com IA atingido este mês.</strong> Agenda e prontuário seguem normais; faça upgrade para continuar gravando com IA.</>
          )}
        </span>
      </div>
      <Link href="/planos" className="btn primary sm" style={{ whiteSpace: 'nowrap' }}>
        {inadimplente ? (gateway === 'asaas' ? 'Pagar fatura →' : 'Resolver →') : 'Ver planos →'}
      </Link>
    </div>
  )
}

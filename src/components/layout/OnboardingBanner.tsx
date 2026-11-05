import Link from 'next/link'

/**
 * Banner persistente no topo de todas as páginas (app) sobre o recebimento.
 *  - `configurar`: ainda não fez o onboarding (soft block das cobranças);
 *  - `recusado`: o Asaas recusou a subconta — antes caía em "configure", o que
 *    mandava refazer um cadastro que o gateway não vai aceitar igual;
 *  - `documentos`: subconta criada, falta enviar documentos no Asaas (cobra,
 *    mas não saca).
 */
export type MotivoOnboardingBanner = 'configurar' | 'recusado' | 'documentos'

const TEXTO: Record<MotivoOnboardingBanner, { forte: string; resto: string; href: string; botao: string; rose?: boolean }> = {
  configurar: {
    forte: 'Configure seus recebimentos', resto: ' pra começar a cobrar sessões. O dinheiro cai direto na sua conta — Audere nunca toca o valor.',
    href: '/onboarding/recebimentos', botao: 'Configurar →',
  },
  recusado: {
    forte: 'O Asaas recusou sua conta de recebimento.', resto: ' A cobrança pela plataforma está pausada até resolver.',
    href: '/perfil/recebimentos', botao: 'Ver detalhes →', rose: true,
  },
  documentos: {
    forte: 'Envie seus documentos no Asaas', resto: ' para liberar os saques. As cobranças já funcionam.',
    href: '/perfil/recebimentos', botao: 'Ver situação →',
  },
}

export function OnboardingBanner({ motivo = 'configurar' }: { motivo?: MotivoOnboardingBanner }) {
  const t = TEXTO[motivo]
  return (
    <div style={{
      padding: '10px 20px',
      background: t.rose ? 'rgba(196,96,122,.10)' : 'rgba(176,125,64,.12)',
      borderBottom: `1px solid ${t.rose ? 'rgba(196,96,122,.22)' : 'rgba(176,125,64,.22)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, fontSize: 13,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink-soft)' }}>
        <span style={{ fontSize: 16 }}>◐</span>
        <span><strong>{t.forte}</strong>{t.resto}</span>
      </div>
      <Link href={t.href} className="btn primary sm" style={{ whiteSpace: 'nowrap' }}>
        {t.botao}
      </Link>
    </div>
  )
}

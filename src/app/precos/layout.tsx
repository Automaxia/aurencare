import type { Metadata } from 'next'
import '../lancamento/landing-v2.css'
import '../lancamento/v2/v2.css'

export const metadata: Metadata = {
  title: 'Planos e preços — Audere',
  description:
    'Escolha o plano da sua prática: Free, Essencial ou Pro. Todos incluem agenda, prontuário, WhatsApp e cobrança — o que muda é o volume de sessões com a Audere.',
}

/** Mesma casca da landing: pública, sem sidebar/topbar do app. */
export default function PrecosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

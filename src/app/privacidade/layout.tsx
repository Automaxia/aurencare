import type { Metadata } from 'next'
import '../lancamento/landing-v2.css'
import '../lancamento/v2/v2.css'

export const metadata: Metadata = {
  title: 'Política de Privacidade — Audere',
  description: 'Como a Audere trata os dados de psicólogos e pacientes: LGPD, CFP 09/2024, WhatsApp, IA e seus direitos.',
  robots: { index: true, follow: true },
}

/** Mesma casca da landing: pública, sem sidebar/topbar do app. */
export default function PrivacidadeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

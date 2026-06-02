import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Auren Care — Sistema Operacional da Prática Clínica',
  description:
    'Auren Care: agenda, pagamentos, sala de vídeo e IA assistente — tudo conectado. Para psicólogos clínicos privados. A IA é assistente, nunca substitui sua escuta clínica.',
}

/**
 * Layout standalone da landing. Sem sidebar/topbar do app; só o conteúdo
 * promocional. Auth não é exigida — página pública.
 */
export default function LancamentoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

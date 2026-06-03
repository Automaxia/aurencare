import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Auren Care — Sistema Operacional da Prática Clínica',
  description:
    'Auren Care: agenda, pagamentos, sala de vídeo e transcrição — tudo conectado, com a Auren, sua assistente de clínica com memória. Para psicólogos clínicos privados. A Auren organiza e observa; a decisão clínica é sempre sua.',
}

/**
 * Layout standalone da landing. Sem sidebar/topbar do app; só o conteúdo
 * promocional. Auth não é exigida — página pública.
 */
export default function LancamentoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

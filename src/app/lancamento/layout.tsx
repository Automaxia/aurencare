import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Audere — A primeira plataforma de Continuidade Terapêutica do Brasil',
  description:
    'A Audere organiza, acompanha e conecta tudo o que acontece entre uma sessão e outra — memória clínica longitudinal, objetivos terapêuticos e evolução registrada. Para psicólogos que acompanham processos ao longo do tempo. A Audere observa; a decisão clínica é sempre sua.',
}

/**
 * Layout standalone da landing. Sem sidebar/topbar do app; só o conteúdo
 * promocional. Auth não é exigida — página pública.
 */
export default function LancamentoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

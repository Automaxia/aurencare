import type { Metadata } from 'next'
import './landing-v2.css'   // CSS portado do design (escopado sob .lp)
import './v2/v2.css'         // adições/curadoria P1–P6

export const metadata: Metadata = {
  title: 'Audere — A primeira plataforma de Inteligência Clínica Longitudinal do Brasil',
  description:
    'A Audere organiza, acompanha e conecta tudo o que acontece entre uma sessão e outra — inteligência clínica longitudinal, objetivos terapêuticos e evolução registrada. Para psicólogos que acompanham processos ao longo do tempo. A Audere observa; a decisão clínica é sempre sua.',
}

/**
 * Layout standalone da landing. Sem sidebar/topbar do app; só o conteúdo
 * promocional. Auth não é exigida — página pública.
 */
export default function LancamentoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

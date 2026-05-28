'use client'

import { AiChatPanel } from '@/components/AiChatPanel'

export function TemasChat({ pacienteId, pacienteNome, selecionado }: { pacienteId: string; pacienteNome: string; selecionado: string | null }) {
  return (
    <AiChatPanel
      endpoint="/api/analise/chat"
      payload={{ contexto: 'temas', pacienteId, foco: selecionado }}
      title="Apoio à reflexão"
      subtitle={`Pergunte sobre os temas e conexões registrados nas sessões de ${firstName(pacienteNome)}.`}
      initialMessage={`Vejo os registros de ${firstName(pacienteNome)}. Posso explorar como os temas se conectaram ao longo das sessões ou o que mudou com o tempo. O que gostaria de saber?`}
      quickPrompts={[
        selecionado ? `O que sabemos sobre "${selecionado}"?` : 'Quais os temas mais frequentes?',
        'Como esses temas se conectaram ao longo das sessões?',
        'O que mudou entre as primeiras e as últimas sessões?',
      ]}
      placeholder={selecionado ? `Explore "${selecionado}"…` : 'Explore os temas das sessões…'}
    />
  )
}

function firstName(n?: string | null) { return (n ?? '').split(/\s+/)[0] || 'o paciente' }

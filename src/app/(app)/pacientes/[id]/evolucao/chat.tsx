'use client'

import { AiChatPanel } from '@/components/AiChatPanel'

export function EvolucaoChat({ pacienteId, pacienteNome, totalSessoes }: { pacienteId: string; pacienteNome: string; totalSessoes: number }) {
  const first = pacienteNome.split(/\s+/)[0]
  return (
    <div style={{ position: 'sticky', top: 70, alignSelf: 'start' }}>
      <AiChatPanel
        endpoint="/api/analise/chat"
        payload={{ contexto: 'evolucao', pacienteId }}
        title="Memória do processo"
        subtitle={`Pergunte sobre o histórico de ${first}. ${totalSessoes} ${totalSessoes === 1 ? 'sessão registrada' : 'sessões registradas'}.`}
        initialMessage={`Registrei ${totalSessoes} ${totalSessoes === 1 ? 'sessão' : 'sessões'} de ${first}. Posso ajudar a organizar o que foi observado ao longo do processo — temas recorrentes, mudanças, continuidade entre sessões. O que quer explorar?`}
        quickPrompts={[
          'Como evoluiu entre a primeira e a última sessão?',
          'O que mudou nas últimas sessões?',
          'Quais padrões aparecem com mais frequência?',
        ]}
        placeholder={`Explore o histórico de ${first}…`}
      />
    </div>
  )
}

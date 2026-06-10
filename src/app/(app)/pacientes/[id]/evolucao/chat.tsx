'use client'

import { AiChatPanel } from '@/components/AiChatPanel'

export function EvolucaoChat({ pacienteId, pacienteNome, totalSessoes }: { pacienteId: string; pacienteNome: string; totalSessoes: number }) {
  const first = pacienteNome.split(/\s+/)[0]
  return (
    <div style={{ position: 'sticky', top: 70, alignSelf: 'start' }}>
      <AiChatPanel
        endpoint="/api/analise/chat"
        payload={{ contexto: 'evolucao', pacienteId }}
        title="Converse com a memória clínica"
        subtitle={`Aprofunde o que a Audere observou no histórico de ${first}. ${totalSessoes} ${totalSessoes === 1 ? 'sessão registrada' : 'sessões registradas'}.`}
        initialMessage={`Registrei ${totalSessoes} ${totalSessoes === 1 ? 'sessão' : 'sessões'} de ${first}. Use os atalhos abaixo ou pergunte livremente para aprofundar a evolução — temas, mudanças e continuidade ao longo do processo.`}
        quickPrompts={[
          'Como evoluiu entre a primeira e a última sessão?',
          'O que mudou nos últimos 30 dias?',
          'Quais temas diminuíram?',
          'Quais temas reapareceram após desaparecer?',
          'Quais objetivos avançaram?',
          'Quais padrões aparecem com mais frequência?',
        ]}
        placeholder={`Explore o histórico de ${first}…`}
      />
    </div>
  )
}

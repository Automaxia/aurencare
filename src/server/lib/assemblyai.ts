import 'server-only'
import { AssemblyAI } from 'assemblyai'
import { env, integrationStatus } from './env'
import { log } from './log'

/**
 * AssemblyAI — transcrição de chunk (batch).
 * §14: áudio bruto é descartado após transcrever — nada persiste em disco.
 *
 * Para streaming real-time verdadeiro, o ideal é WS direto navegador→AssemblyAI,
 * mas isso requer token efêmero. Aqui usamos batch: chunk de ~5s →
 * upload temporário → transcribe → texto → descarta.
 */

let client: AssemblyAI | null = null
function getClient(): AssemblyAI | null {
  if (!integrationStatus.assembly) return null
  if (!client) client = new AssemblyAI({ apiKey: env.assemblyKey! })
  return client
}

export async function transcreverChunk(audio: Buffer, languageCode = 'pt'): Promise<string> {
  const c = getClient()
  if (!c) {
    // demo mode: gera frase aleatória
    return demoFrase()
  }

  try {
    const t = await c.transcripts.transcribe({
      audio,
      language_code: languageCode as any,
      speech_model: 'best' as any,
    } as any)
    if (t.status === 'error') {
      log.err('assemblyai', t.error ?? 'erro desconhecido')
      return ''
    }
    return t.text ?? ''
  } catch (err) {
    log.err('assemblyai', 'falha no transcribe', err instanceof Error ? err.message : err)
    return ''
  }
}

const DEMO_PHRASES: { turno: 'psicologo' | 'paciente'; texto: string }[] = [
  { turno: 'psicologo', texto: 'Como foi sua semana?' },
  { turno: 'paciente',  texto: 'Tive aquela apresentação que vinha adiando.' },
  { turno: 'psicologo', texto: 'O que você notou em si nesse momento?' },
  { turno: 'paciente',  texto: 'Senti o coração acelerar, mas consegui respirar fundo.' },
  { turno: 'psicologo', texto: 'Bom. E ao final, o que ficou da experiência?' },
  { turno: 'paciente',  texto: 'Que evitar não me protege, só adia.' },
  { turno: 'psicologo', texto: 'Você consegue notar uma diferença em relação ao mês passado?' },
  { turno: 'paciente',  texto: 'Sim. Antes eu não conseguia nem pensar nisso sem travar.' },
]

let demoIdx = 0
function demoFrase(): string {
  const item = DEMO_PHRASES[demoIdx % DEMO_PHRASES.length]
  demoIdx++
  return `${item.turno === 'psicologo' ? '[P]' : '[C]'} ${item.texto}`
}

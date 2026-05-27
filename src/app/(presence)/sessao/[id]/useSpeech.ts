'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Hook de transcrição streaming via Web Speech API nativa do navegador.
 * Chrome/Edge ótimo. Safari ok. Firefox não suporta.
 *
 * Diarização heurística: alterna P↔C quando há pausa >2s OU o turno
 * passa de ~25 segundos (limite de um "ato"). Psicóloga corrige clicando.
 */

export type SpeechFinalChunk = {
  texto: string
  who: 'psicologo' | 'paciente'
  ts: string
}

type Options = {
  enabled: boolean
  onFinal: (chunk: SpeechFinalChunk) => void
  onInterim?: (text: string) => void
}

// Tipos para Web Speech API (não no @types/web por padrão)
type SR = any

export function useSpeech({ enabled, onFinal, onInterim }: Options) {
  const recRef = useRef<SR | null>(null)
  const lastEndRef = useRef<number>(0)
  const lastWhoRef = useRef<'psicologo' | 'paciente'>('paciente')
  const turnStartRef = useRef<number>(Date.now())
  const [supported, setSupported] = useState<boolean | null>(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // detecta suporte uma vez
  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR: SR | undefined =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setSupported(!!SR)
  }, [])

  useEffect(() => {
    if (!enabled || !supported) return
    const SR: SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const r = new SR()
    r.lang = 'pt-BR'
    r.continuous = true
    r.interimResults = true
    r.maxAlternatives = 1

    r.onresult = (ev: any) => {
      let interim = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i]
        const txt = res[0]?.transcript ?? ''
        if (res.isFinal) {
          const now = Date.now()
          // diarização: se houve pausa longa OU o turno ficou muito longo, troca.
          const pausa = now - lastEndRef.current
          const turno = now - turnStartRef.current
          if (lastEndRef.current && (pausa > 2_000 || turno > 25_000)) {
            lastWhoRef.current = lastWhoRef.current === 'paciente' ? 'psicologo' : 'paciente'
            turnStartRef.current = now
          }
          lastEndRef.current = now
          const clean = txt.trim()
          if (clean) {
            onFinal({ texto: clean, who: lastWhoRef.current, ts: new Date(now).toISOString() })
          }
        } else {
          interim += txt
        }
      }
      onInterim?.(interim.trim())
    }

    r.onerror = (ev: any) => {
      const msg = ev?.error ?? 'unknown'
      // 'no-speech', 'aborted' são triviais — não escala
      if (msg !== 'no-speech' && msg !== 'aborted') setError(msg)
    }

    r.onend = () => {
      // auto-reinicia se ainda ativo (Chrome encerra periodicamente)
      if (recRef.current === r && enabled) {
        try { r.start() } catch { /* já startado */ }
      } else {
        setActive(false)
      }
    }

    recRef.current = r
    try {
      r.start()
      setActive(true)
      setError(null)
    } catch (err: any) {
      setError(err?.message ?? 'falha ao iniciar')
    }

    return () => {
      recRef.current = null
      try { r.stop() } catch { /* */ }
    }
  }, [enabled, supported, onFinal, onInterim])

  function forceSpeakerToggle() {
    lastWhoRef.current = lastWhoRef.current === 'paciente' ? 'psicologo' : 'paciente'
    turnStartRef.current = Date.now()
  }

  return { supported, active, error, forceSpeakerToggle }
}

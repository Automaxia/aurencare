'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Transcrição streaming via Web Speech API nativa.
 * Chrome/Edge ótimo · Safari ok · Firefox não suporta.
 *
 * Diarização heurística: alterna P↔C em pausa >2s ou turno >25s.
 * Psicóloga corrige clicando no "P:"/"C:" do turno.
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

type SR = any

export function useSpeech({ enabled, onFinal, onInterim }: Options) {
  // Callbacks vão pra refs ESTÁVEIS — o useEffect principal não reage
  // a mudanças delas, evitando recriar SpeechRecognition a cada render.
  const onFinalRef = useRef(onFinal)
  const onInterimRef = useRef(onInterim)
  useEffect(() => { onFinalRef.current = onFinal }, [onFinal])
  useEffect(() => { onInterimRef.current = onInterim }, [onInterim])

  const lastEndRef = useRef<number>(0)
  const lastWhoRef = useRef<'psicologo' | 'paciente'>('paciente')
  const turnStartRef = useRef<number>(Date.now())

  const [supported, setSupported] = useState<boolean | null>(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Detecta suporte uma vez.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR: SR | undefined =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setSupported(!!SR)
  }, [])

  // Ciclo de vida do reconhecedor.
  useEffect(() => {
    if (!enabled || supported !== true) return

    const SR: SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    let alive = true
    let restartTimer: ReturnType<typeof setTimeout> | null = null

    const r = new SR()
    r.lang = 'pt-BR'
    r.continuous = true
    r.interimResults = true
    r.maxAlternatives = 1

    r.onstart = () => { if (alive) { setActive(true); setError(null) } }

    r.onresult = (ev: any) => {
      if (!alive) return
      let interim = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i]
        const txt = res[0]?.transcript ?? ''
        if (res.isFinal) {
          const now = Date.now()
          const pausa = now - lastEndRef.current
          const turno = now - turnStartRef.current
          if (lastEndRef.current && (pausa > 2000 || turno > 25_000)) {
            lastWhoRef.current = lastWhoRef.current === 'paciente' ? 'psicologo' : 'paciente'
            turnStartRef.current = now
          }
          lastEndRef.current = now
          const clean = txt.trim()
          if (clean) onFinalRef.current?.({ texto: clean, who: lastWhoRef.current, ts: new Date(now).toISOString() })
        } else {
          interim += txt
        }
      }
      onInterimRef.current?.(interim.trim())
    }

    r.onerror = (ev: any) => {
      const msg = ev?.error ?? 'unknown'
      // Trivials — não escalar nem encerrar
      if (msg === 'no-speech' || msg === 'aborted') return
      if (msg === 'not-allowed' || msg === 'service-not-allowed') {
        setError('Permissão de microfone negada ou serviço bloqueado.')
        alive = false
        return
      }
      setError(`Reconhecimento: ${msg}`)
    }

    r.onend = () => {
      if (!alive) { setActive(false); return }
      // Throttle: 500ms antes de tentar restart. Evita tight loop se
      // o navegador estiver em erro persistente.
      if (restartTimer) clearTimeout(restartTimer)
      restartTimer = setTimeout(() => {
        if (!alive) return
        try {
          r.start()
        } catch {
          // Estado inválido (já startou, etc) — para de tentar.
          alive = false
          setActive(false)
        }
      }, 500)
    }

    try {
      r.start()
    } catch (err: any) {
      setError(err?.message ?? 'falha ao iniciar')
      alive = false
    }

    return () => {
      alive = false
      if (restartTimer) { clearTimeout(restartTimer); restartTimer = null }
      // Desliga handlers antes do stop pra evitar onend disparando restart.
      try {
        r.onend = null; r.onresult = null; r.onerror = null; r.onstart = null
        r.stop()
      } catch { /* */ }
      setActive(false)
    }
  }, [enabled, supported])

  function forceSpeakerToggle() {
    lastWhoRef.current = lastWhoRef.current === 'paciente' ? 'psicologo' : 'paciente'
    turnStartRef.current = Date.now()
  }

  return { supported, active, error, forceSpeakerToggle }
}

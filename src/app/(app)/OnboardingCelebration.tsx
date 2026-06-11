'use client'

import { useEffect, useState } from 'react'

/**
 * Micro-toast de parabéns ao chegar na primeira memória clínica (passo 4).
 * Dispara só na TRANSIÇÃO: marca `seen` enquanto o onboarding está incompleto e
 * só celebra quando completa tendo sido visto antes neste navegador — então
 * usuários já estabelecidos (que nunca viram o wizard) nunca recebem o toast.
 */
const K_SEEN = 'audere_onb_seen'
const K_DONE = 'audere_onb_celebrated'

export function OnboardingCelebration({ completo }: { completo: boolean }) {
  const [show, setShow] = useState(false)
  const [vis, setVis] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const get = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
    const set = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch {} }

    if (!completo) { set(K_SEEN, '1'); return }
    if (get(K_SEEN) !== '1' || get(K_DONE) === '1') return

    set(K_DONE, '1')
    setShow(true)
    const r = requestAnimationFrame(() => setVis(true))
    const t = setTimeout(() => setVis(false), 8000)
    const t2 = setTimeout(() => setShow(false), 8400)
    return () => { cancelAnimationFrame(r); clearTimeout(t); clearTimeout(t2) }
  }, [completo])

  if (!show) return null

  function fechar() {
    setVis(false)
    setTimeout(() => setShow(false), 300)
  }

  return (
    <div role="status" style={{
      position: 'fixed', left: '50%', bottom: 24, zIndex: 200,
      transform: `translateX(-50%) translateY(${vis ? 0 : 14}px)`,
      opacity: vis ? 1 : 0, transition: 'opacity .3s var(--ease), transform .3s var(--ease)',
      display: 'flex', alignItems: 'center', gap: 14,
      maxWidth: 'min(440px, 92vw)', padding: '14px 16px',
      borderRadius: 14, background: 'var(--card)',
      border: '1px solid rgba(90,158,138,.3)',
      boxShadow: '0 18px 50px rgba(26,24,37,.16)',
    }}>
      <span style={{
        flex: 'none', width: 36, height: 36, borderRadius: '50%',
        background: 'var(--sage)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
      }}>✓</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>
          Você chegou à primeira memória clínica 🎉
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>
          Agora a Audere acompanha a continuidade de cada paciente por você.
        </div>
      </div>
      <button onClick={fechar} aria-label="Fechar" style={{
        flex: 'none', background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--muted)', fontSize: 16, padding: 4, lineHeight: 1,
      }}>✕</button>
    </div>
  )
}

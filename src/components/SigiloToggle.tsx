'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/**
 * Botão de modo SIGILO (privacidade pra screen-share). Liga/desliga a classe
 * html.sigilo-on, que borra dados sensíveis do paciente (estilo "esconder saldo").
 * Persiste em localStorage; o layout aplica a classe antes da pintura (sem flash).
 */
const KEY = 'auren.sigilo'

export function SigiloToggle() {
  const [on, setOn] = useState(false)

  // Sincroniza com o estado já aplicado pelo script inline do layout.
  useEffect(() => { setOn(document.documentElement.classList.contains('sigilo-on')) }, [])

  function toggle() {
    const next = !on
    setOn(next)
    document.documentElement.classList.toggle('sigilo-on', next)
    try { localStorage.setItem(KEY, next ? '1' : '0') } catch { /* */ }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      title={on ? 'Sigilo ligado — dados do paciente ocultos. Clique para mostrar.' : 'Ocultar dados sensíveis do paciente (sigilo)'}
      className="btn ghost sm"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 500,
        ...(on ? { color: 'var(--accent)', background: 'var(--accent-lo)', border: '1px solid var(--accent)' } : null),
      }}
    >
      {on ? <EyeOff size={15} /> : <Eye size={15} />}
      <span>Sigilo</span>
    </button>
  )
}

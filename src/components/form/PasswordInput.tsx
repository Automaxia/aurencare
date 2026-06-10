'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/**
 * Campo de senha com botão mostrar/ocultar (padrão de mercado).
 * Herda o estilo de input do contexto (.auth-form etc.); só reserva espaço à
 * direita pro olho.
 */
export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false)
  const { style, ...rest } = props
  return (
    <div style={{ position: 'relative' }}>
      <input {...rest} type={show ? 'text' : 'password'} style={{ ...style, paddingRight: 42 }} />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        title={show ? 'Ocultar senha' : 'Mostrar senha'}
        tabIndex={-1}
        style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          background: 'transparent', border: 'none', cursor: 'pointer', padding: 6,
          color: 'var(--muted)', display: 'inline-flex', lineHeight: 0,
        }}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

'use client'

/**
 * Telefone com seletor de país: o número é mascarado no padrão do país
 * escolhido e o valor entregue segue a convenção de src/lib/telefone.ts
 * (BR = só dígitos; exterior = E.164 com '+').
 */
import { useState } from 'react'
import type { CountryCode } from 'libphonenumber-js'
import { PAISES, mascaraNacional, montarTelefone, separarTelefone } from '@/lib/telefone'

const EXEMPLO: Partial<Record<CountryCode, string>> = {
  BR: '(11) 91234-5678', PT: '912 345 678', US: '(201) 555-0123', GB: '07400 123456',
}

export function TelefoneInput({ valorInicial, onChange, required, padding = '8px 12px', fontSize = 13 }: {
  valorInicial?: string | null
  onChange: (armazenado: string) => void
  required?: boolean
  padding?: string
  fontSize?: number
}) {
  const ini = separarTelefone(valorInicial)
  const [iso, setIso] = useState<CountryCode>(ini.iso)
  const [nacional, setNacional] = useState(mascaraNacional(ini.iso, ini.nacional))

  function mudarPais(novo: CountryCode) {
    setIso(novo)
    const m = mascaraNacional(novo, nacional)
    setNacional(m)
    onChange(montarTelefone(novo, m))
  }

  function mudarNumero(texto: string) {
    // Colou um número completo com '+DDI'? Troca o país sozinho.
    if (texto.trim().startsWith('+')) {
      const s = separarTelefone(texto)
      setIso(s.iso)
      const m = mascaraNacional(s.iso, s.nacional)
      setNacional(m)
      onChange(montarTelefone(s.iso, m))
      return
    }
    // Apagando: não reaplica a máscara, senão o ')' / '-' "volta" e trava o backspace.
    const apagando = texto.length < nacional.length
    const m = apagando ? texto : mascaraNacional(iso, texto)
    setNacional(m)
    onChange(montarTelefone(iso, m))
  }

  const pais = PAISES.find(p => p.iso === iso) ?? PAISES[0]

  return (
    <div className="tel-campo" style={{ display: 'flex', gap: 6 }}>
      <select
        value={iso}
        onChange={e => mudarPais(e.target.value as CountryCode)}
        aria-label="País do telefone"
        title={pais.nome}
        style={{ padding, fontSize, flex: '0 0 auto', width: 104 }}
      >
        {PAISES.map(p => (
          <option key={p.iso} value={p.iso}>{p.bandeira} +{p.ddi} · {p.nome}</option>
        ))}
      </select>
      <input
        required={required}
        value={nacional}
        onChange={e => mudarNumero(e.target.value.replace(/[^\d()+\s.-]/g, ''))}
        placeholder={EXEMPLO[iso] ?? 'Número com código de área'}
        inputMode="tel"
        autoComplete="tel-national"
        style={{ padding, fontSize, flex: 1, minWidth: 0 }}
      />
      <style jsx>{`
        .tel-campo select, .tel-campo input {
          border-radius: var(--field-radius);
          border: 1px solid var(--field-border); background: var(--field-bg);
          font-family: inherit; color: var(--ink); outline: none;
          transition: border-color .15s var(--ease), box-shadow .15s var(--ease);
        }
        .tel-campo select { text-overflow: ellipsis; cursor: pointer; }
        .tel-campo select:hover, .tel-campo input:hover { border-color: var(--field-border-hover); }
        .tel-campo select:focus, .tel-campo input:focus { border-color: var(--accent); box-shadow: var(--field-ring); }
      `}</style>
    </div>
  )
}

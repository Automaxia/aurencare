import React from 'react'

/**
 * Marca um conteúdo como sensível (nome, telefone, e-mail do paciente).
 * Quando o modo sigilo está ligado (html.sigilo-on), o CSS borra `.sigilo`.
 * Componente puro (server + client). Use em torno do dado: <Sigilo>{nome}</Sigilo>.
 */
export function Sigilo({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={className ? `sigilo ${className}` : 'sigilo'}>{children}</span>
}

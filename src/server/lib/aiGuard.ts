import 'server-only'

/**
 * CFP 09/2024 — IA nunca emite diagnóstico nem interpretação clínica. §13.
 */
const TERMOS_PROIBIDOS = [
  'diagnóstico', 'diagnostico',
  'o paciente tem', 'a paciente tem',
  'esquema de', 'transferência', 'transferencia',
  'indica fortemente',
  'possível elaboração', 'possivel elaboracao',
  'comprova', 'confirma',
  'sofre de', 'apresenta quadro',
]

export function validarTextoIA(texto: string): boolean {
  const t = texto.toLowerCase()
  return !TERMOS_PROIBIDOS.some(p => t.includes(p.toLowerCase()))
}

/**
 * Quando a IA escapou: troca termos proibidos por versão neutra.
 * Não é perfeito (apenas mitiga); o ideal é re-gerar com nota corretiva.
 *
 * Só faz a troca de termos — NÃO anexa rodapé. O aviso "rascunho/revisar" é de
 * prontuário (psicóloga revisa) e vazava para mensagens de WhatsApp do paciente
 * quando estas passavam pela sanitização. A indicação de rascunho fica a cargo
 * da UI/PDF do prontuário, não do texto.
 */
export function sanitizarTextoIA(texto: string): string {
  let out = texto
  const SUBS: Record<string, string> = {
    'diagnóstico': 'observação',
    'diagnostico': 'observação',
    'o paciente tem': 'observa-se que o paciente',
    'a paciente tem': 'observa-se que a paciente',
    'sofre de': 'relata',
    'apresenta quadro': 'relata padrão',
    'indica fortemente': 'sugere',
    'comprova': 'sugere',
    'confirma': 'aponta',
  }
  for (const [bad, good] of Object.entries(SUBS)) {
    out = out.replace(new RegExp(bad, 'gi'), good)
  }
  return out
}

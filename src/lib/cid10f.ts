/**
 * CID-10 · Capítulo F (Transtornos Mentais e Comportamentais) — subconjunto
 * curado dos mais usados na prática clínica de psicologia.
 *
 * Dados de referência (códigos + descrições padrão da CID-10). NÃO é a CID
 * completa — propositalmente enxuto. Pra expandir: basta acrescentar itens aqui
 * (ou importar de um CSV/JSON para `CID10F` mantendo o mesmo shape).
 */

export type CidItem = {
  codigo: string
  descricao: string
  palavrasChave: string[]
}

export const CID10F: CidItem[] = [
  { codigo: 'F32',   descricao: 'Episódio depressivo',
    palavrasChave: ['depressão', 'depressivo', 'tristeza', 'humor deprimido'] },
  { codigo: 'F33',   descricao: 'Transtorno depressivo recorrente',
    palavrasChave: ['depressão recorrente', 'recorrente', 'depressivo'] },
  { codigo: 'F34',   descricao: 'Transtornos persistentes do humor [afetivos]',
    palavrasChave: ['distimia', 'ciclotimia', 'humor persistente'] },
  { codigo: 'F40.1', descricao: 'Fobia social',
    palavrasChave: ['fobia social', 'ansiedade social', 'timidez'] },
  { codigo: 'F41.0', descricao: 'Transtorno de pânico',
    palavrasChave: ['pânico', 'ataque de pânico', 'crise de pânico'] },
  { codigo: 'F41.1', descricao: 'Transtorno de ansiedade generalizada',
    palavrasChave: ['ansiedade', 'TAG', 'preocupação excessiva'] },
  { codigo: 'F42',   descricao: 'Transtorno obsessivo-compulsivo',
    palavrasChave: ['TOC', 'obsessão', 'compulsão', 'obsessivo'] },
  { codigo: 'F43.1', descricao: 'Transtorno de estresse pós-traumático',
    palavrasChave: ['TEPT', 'trauma', 'estresse pós-traumático', 'PTSD'] },
  { codigo: 'F43.2', descricao: 'Transtorno de adaptação',
    palavrasChave: ['adaptação', 'ajustamento'] },
  { codigo: 'F50.0', descricao: 'Anorexia nervosa',
    palavrasChave: ['anorexia', 'transtorno alimentar'] },
  { codigo: 'F50.2', descricao: 'Bulimia nervosa',
    palavrasChave: ['bulimia', 'compulsão alimentar', 'transtorno alimentar'] },
  { codigo: 'F60.3', descricao: 'Transtorno de personalidade borderline',
    palavrasChave: ['borderline', 'TPB', 'personalidade', 'instabilidade emocional'] },
  { codigo: 'F84.0', descricao: 'Transtorno do espectro autista',
    palavrasChave: ['autismo', 'TEA', 'espectro autista'] },
  { codigo: 'F90.0', descricao: 'Transtorno de déficit de atenção e hiperatividade',
    palavrasChave: ['TDAH', 'déficit de atenção', 'hiperatividade'] },
  { codigo: 'F91',   descricao: 'Transtornos de conduta',
    palavrasChave: ['conduta', 'comportamento'] },
  { codigo: 'F99',   descricao: 'Transtorno mental não especificado',
    palavrasChave: ['não especificado', 'inespecífico'] },
]

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}
/** Só dígitos/letras — pra casar "f411" com "F41.1". */
function soAlnum(s: string): string {
  return normalizar(s).replace(/[^a-z0-9]/g, '')
}

/** Texto canônico de um item pra exibir/salvar: "F41.1 — Descrição". */
export function rotuloCid(item: CidItem): string {
  return `${item.codigo} — ${item.descricao}`
}

/**
 * Busca por código, descrição ou palavra-chave (sem acento, case-insensitive).
 * Ranqueia: match de código primeiro, depois descrição, depois palavra-chave.
 */
export function buscarCid(query: string, limit = 8): CidItem[] {
  const q = normalizar(query)
  if (!q) return CID10F.slice(0, limit)
  const qAlnum = soAlnum(query)

  const scored: { item: CidItem; score: number }[] = []
  for (const item of CID10F) {
    const desc = normalizar(item.descricao)
    const cod = soAlnum(item.codigo)
    let score = 0
    if (qAlnum && cod.startsWith(qAlnum)) score = 100
    else if (qAlnum && cod.includes(qAlnum)) score = 70
    else if (desc.startsWith(q)) score = 60
    else if (desc.includes(q)) score = 40
    else if (item.palavrasChave.some(k => normalizar(k).includes(q))) score = 30
    if (score > 0) scored.push({ item, score })
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(s => s.item)
}

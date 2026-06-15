import React from 'react'

/**
 * Renderer de Markdown mínimo (sem dependência) para o laudo de sessão.
 * Cobre o que o prompt MODE: SUMMARY produz: títulos ## / ### / ####,
 * parágrafos, listas (- / *) e negrito **inline**. Funciona em server e client.
 */

type Block =
  | { t: 'h'; level: number; text: string }
  | { t: 'p'; text: string }
  | { t: 'ul'; items: string[] }

function parse(src: string): Block[] {
  const blocks: Block[] = []
  let para: string[] = []
  let list: string[] = []
  const flushPara = () => { if (para.length) { blocks.push({ t: 'p', text: para.join(' ') }); para = [] } }
  const flushList = () => { if (list.length) { blocks.push({ t: 'ul', items: list }); list = [] } }

  for (const raw of src.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd()
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    const li = line.match(/^\s*[-*]\s+(.*)$/)
    if (h) { flushPara(); flushList(); blocks.push({ t: 'h', level: h[1].length, text: h[2] }) }
    else if (li) { flushPara(); list.push(li[1]) }
    else if (line.trim() === '') { flushPara(); flushList() }
    else { flushList(); para.push(line.trim()) }
  }
  flushPara(); flushList()
  return blocks
}

/** Negrito **inline** → <strong>. */
function inline(text: string, keyBase: string): React.ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((seg, i) =>
    i % 2 === 1 ? <strong key={`${keyBase}-${i}`}>{seg}</strong> : <React.Fragment key={`${keyBase}-${i}`}>{seg}</React.Fragment>,
  )
}

const H_STYLE: Record<number, React.CSSProperties> = {
  2: { fontFamily: 'var(--f-display)', fontSize: 18, fontWeight: 500, color: 'var(--ink)', margin: '18px 0 8px' },
  3: { fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '14px 0 4px' },
  4: { fontSize: 12.5, fontWeight: 600, color: 'var(--ink-soft)', margin: '10px 0 3px' },
}

export function Markdown({ text }: { text: string }) {
  const blocks = parse(text || '')
  return (
    <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.65 }}>
      {blocks.map((b, i) => {
        if (b.t === 'h') {
          const style = H_STYLE[b.level] ?? H_STYLE[4]
          const first = i === 0 ? { marginTop: 0 } : null
          return <div key={i} style={{ ...style, ...first }}>{inline(b.text, `h${i}`)}</div>
        }
        if (b.t === 'ul') {
          return (
            <ul key={i} style={{ margin: '4px 0 4px', paddingLeft: 18 }}>
              {b.items.map((it, j) => <li key={j} style={{ margin: '3px 0' }}>{inline(it, `li${i}-${j}`)}</li>)}
            </ul>
          )
        }
        return <p key={i} style={{ margin: '0 0 8px' }}>{inline(b.text, `p${i}`)}</p>
      })}
    </div>
  )
}

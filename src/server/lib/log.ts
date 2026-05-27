import 'server-only'

const COLORS = {
  info: '\x1b[36m',  // cyan
  ok:   '\x1b[32m',  // green
  warn: '\x1b[33m',  // yellow
  err:  '\x1b[31m',  // red
  dim:  '\x1b[90m',
  reset:'\x1b[0m',
}

function fmt(level: keyof typeof COLORS, scope: string, msg: string, extra?: unknown) {
  const t = new Date().toISOString().split('T')[1]?.slice(0, 8) ?? ''
  const head = `${COLORS.dim}${t}${COLORS.reset} ${COLORS[level]}[${scope}]${COLORS.reset}`
  if (extra !== undefined) console.log(head, msg, extra)
  else console.log(head, msg)
}

export const log = {
  info: (s: string, m: string, e?: unknown) => fmt('info', s, m, e),
  ok:   (s: string, m: string, e?: unknown) => fmt('ok',   s, m, e),
  warn: (s: string, m: string, e?: unknown) => fmt('warn', s, m, e),
  err:  (s: string, m: string, e?: unknown) => fmt('err',  s, m, e),
}

'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'

/**
 * Importa uma transcrição que o psicólogo já tem (colar texto ou .txt/.pdf/.docx)
 * como sessão de histórico. Vira uma sessão concluída com rascunho de laudo — o
 * psicólogo revisa e assina na tela da sessão (que aí alimenta temas/evolução).
 */
export function ImportarSessao({ pacienteId }: { pacienteId: string }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [modo, setModo] = useState<'colar' | 'arquivo'>('colar')
  const [texto, setTexto] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const [numero, setNumero] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const ERROS: Record<string, string> = {
    data_invalida: 'Informe uma data válida.',
    sem_conteudo: 'Cole o texto ou escolha um arquivo.',
    texto_curto: 'A transcrição está muito curta.',
    formato_nao_suportado: 'Formato não suportado. Use .txt, .pdf ou .docx (ou cole o texto).',
    formato_doc_antigo: 'O .doc antigo não é suportado — salve como .docx ou cole o texto.',
    arquivo_grande: 'Arquivo muito grande (máx. 12 MB).',
    falha_extracao: 'Não consegui ler o arquivo. Tente colar o texto.',
    internal: 'Falha ao importar agora. Tente de novo.',
  }

  async function enviar() {
    setErro(null)
    if (modo === 'colar' && texto.trim().length < 40) { setErro('Cole a transcrição (texto muito curto).'); return }
    if (modo === 'arquivo' && !arquivo) { setErro('Escolha um arquivo .txt, .pdf ou .docx.'); return }
    setEnviando(true)
    const fd = new FormData()
    fd.set('data', data)
    if (numero.trim()) fd.set('numero', numero.trim())
    if (modo === 'colar') fd.set('texto', texto)
    else if (arquivo) fd.set('arquivo', arquivo)
    try {
      const res = await fetch(`/api/pacientes/${pacienteId}/importar-sessao`, { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setErro(ERROS[j?.error] ?? 'Falha ao importar.'); setEnviando(false); return }
      // Vai direto pra revisão/assinatura da sessão criada.
      router.push(`/sessao/${j.sessaoId}`)
    } catch {
      setErro('Sem conexão. Tente de novo.'); setEnviando(false)
    }
  }

  return (
    <>
      <button className="btn ghost" onClick={() => setAberto(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Upload size={14} /> Importar sessão
      </button>

      {aberto && (
        <div role="dialog" aria-modal="true" onClick={() => !enviando && setAberto(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,16,38,.55)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16, backdropFilter: 'blur(4px)' }}>
          <div className="card" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: 24 }}>
            <h2 style={{ margin: '0 0 4px' }}>Importar sessão anterior</h2>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 18px', lineHeight: 1.5 }}>
              Traga uma transcrição que você já tem. Ela vira uma sessão com rascunho de laudo —
              você revisa e assina, e ela passa a contar na continuidade do paciente.
            </p>

            <div className="ftabs" style={{ marginBottom: 14 }}>
              <button type="button" className={`ftab${modo === 'colar' ? ' active' : ''}`} onClick={() => setModo('colar')}>Colar texto</button>
              <button type="button" className={`ftab${modo === 'arquivo' ? ' active' : ''}`} onClick={() => setModo('arquivo')}>Arquivo</button>
            </div>

            {modo === 'colar' ? (
              <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={8}
                placeholder="Cole aqui a transcrição da sessão…"
                style={inp} />
            ) : (
              <div>
                <input ref={fileRef} type="file" accept=".txt,.md,.pdf,.docx" style={{ display: 'none' }}
                  onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
                <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()} style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
                  {arquivo ? `📄 ${arquivo.name}` : 'Escolher arquivo (.txt, .pdf, .docx)'}
                </button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={lbl}>Data da sessão</span>
                <input type="date" value={data} onChange={e => setData(e.target.value)} style={inp} />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={lbl}>Nº da sessão (opcional)</span>
                <input type="number" min={1} value={numero} onChange={e => setNumero(e.target.value)} placeholder="auto" style={inp} />
              </label>
            </div>

            {erro && <div style={{ color: 'var(--rose)', fontSize: 12.5, marginTop: 12 }}>{erro}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <button className="btn ghost" onClick={() => setAberto(false)} disabled={enviando}>Cancelar</button>
              <button className="btn primary" onClick={enviar} disabled={enviando}>
                {enviando ? 'Importando…' : 'Importar e revisar →'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 12, lineHeight: 1.5 }}>
              Criptografado em repouso · nada é enviado ao paciente · vira prontuário só após você assinar.
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'white', fontSize: 13, fontFamily: 'inherit',
  color: 'var(--ink)', outline: 'none', resize: 'vertical',
}
const lbl: React.CSSProperties = { fontSize: 11, color: 'var(--muted)' }

import 'server-only'

/**
 * Extrai texto de um arquivo de transcrição importado (.txt / .pdf / .docx).
 * Colar texto direto não passa por aqui — vai como string.
 */
export async function extrairTextoDeArquivo(nome: string, buf: Buffer): Promise<string> {
  const ext = (nome.split('.').pop() || '').toLowerCase()

  if (ext === 'txt' || ext === 'md') {
    return buf.toString('utf-8')
  }

  if (ext === 'pdf') {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(buf))
    const { text } = await extractText(pdf, { mergePages: true })
    return Array.isArray(text) ? text.join('\n') : String(text)
  }

  if (ext === 'docx') {
    const mammoth = await import('mammoth')
    const { value } = await mammoth.extractRawText({ buffer: buf })
    return value
  }

  if (ext === 'doc') {
    throw new Error('formato_doc_antigo') // .doc binário antigo não é suportado — pedir .docx ou colar
  }

  throw new Error('formato_nao_suportado')
}

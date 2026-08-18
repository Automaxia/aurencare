/**
 * Backfill do CPF do psicólogo (migration 046) a partir de `pgm_documento`.
 *
 *   npm run backfill:cpf          # relatório, não escreve nada
 *   npm run backfill:cpf -- --executar
 *
 * Só toca em quem é PF: nesse caso `pgm_documento` guarda o CPF da pessoa e é
 * exatamente o dado que a coluna nova quer. Na PJ o documento é CNPJ — o CPF
 * de um psicólogo PJ tem de vir do cadastro/perfil, não dá pra deduzir aqui
 * (o `pgm_socio_cpf` é do sócio administrador, que nem sempre é ele mesmo).
 *
 * Não é feito em SQL puro porque os dois lados são cifrados com IV aleatório:
 * é preciso decifrar e recifrar em Node.
 */
import { db } from '@/server/db/pool'
import { encrypt, tryDecrypt } from '@/server/lib/crypto'
import { apenasDigitos, validarCpf } from '@/lib/documento'

const executar = process.argv.includes('--executar')

async function main() {
  const { rows } = await db.query<{ id: string; nome: string; pgm_documento: string }>(
    `SELECT id, nome, pgm_documento
       FROM psicologos
      WHERE pgm_tipo_pessoa = 'PF'
        AND pgm_documento IS NOT NULL
        AND cpf IS NULL`,
  )

  console.log(`${rows.length} psicólogo(s) PF com documento e sem CPF.\n`)

  let preenchidos = 0
  let invalidos = 0

  for (const r of rows) {
    const doc = apenasDigitos(tryDecrypt(r.pgm_documento))
    if (!validarCpf(doc)) {
      // Não corrige nem adivinha: um documento que não passa no dígito
      // verificador é problema de cadastro, e o backfill não é o lugar.
      console.log(`✗ ${r.nome} — documento não é CPF válido, pulando`)
      invalidos++
      continue
    }
    if (executar) {
      await db.query(`UPDATE psicologos SET cpf = $2 WHERE id = $1 AND cpf IS NULL`, [r.id, encrypt(doc)])
    }
    console.log(`${executar ? '✓' : '·'} ${r.nome} — ${doc.slice(0, 3)}.***.***-${doc.slice(9)}`)
    preenchidos++
  }

  console.log(`\n${executar ? 'preenchidos' : 'preencheria'}: ${preenchidos} · inválidos: ${invalidos}`)
  if (!executar && preenchidos > 0) console.log('rode com --executar pra gravar.')

  // Quem fica de fora — visível, pra não parecer que o backfill cobriu tudo.
  const { rows: resto } = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM psicologos WHERE cpf IS NULL AND pgm_tipo_pessoa IS DISTINCT FROM 'PF'`,
  )
  console.log(`${resto[0].n} psicólogo(s) seguem sem CPF (PJ ou sem onboarding) — só pelo perfil.`)

  await db.end()
}

main().catch(err => { console.error(err); process.exit(1) })

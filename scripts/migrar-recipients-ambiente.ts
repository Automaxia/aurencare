/**
 * Recria na Pagar.me os recebedores dos psicólogos que já preencheram o
 * onboarding, usando os dados que ficaram salvos no banco.
 *
 *   npm run pagarme:migrar-recipients            # simula (não cria nada)
 *   npm run pagarme:migrar-recipients -- --sim   # cria de verdade
 *
 * POR QUE ISTO EXISTE
 *
 * Recipients são por ambiente: o do sandbox não existe na produção, e os IDs
 * são indistinguíveis (`re_<hash>` nos dois). Ao trocar `PAGARME_API_KEY` para
 * a chave live, todo mundo que já tinha recebedor precisa de um novo — e sem
 * este script cada psicólogo teria que refazer os três passos do wizard com
 * dados que a plataforma JÁ TEM guardados (cifrados) desde o primeiro cadastro.
 *
 * Passa pela mesma `criarRecipient` do onboarding, então o payload é idêntico
 * ao que o wizard enviaria.
 *
 * NÃO é obrigatório: `garantirRecipientAtivo` recria o recebedor sozinha, na
 * primeira cobrança de cada psicólogo. Este script serve para fazer isso de uma
 * vez, ANTES de a primeira sessão aparecer, e para ver num relatório só quem
 * ainda depende de dado que a plataforma não tem.
 *
 * ⚠️ Rode com a chave do CLUSTER, não com a do `.env.local` — foi confundir as
 * duas que gerou um diagnóstico errado de "conta bloqueada" (ver docs/INFRA.md):
 *
 *   PAGARME_API_KEY=$(kubectl ... get secret aurencare-secrets \
 *     -o jsonpath='{.data.PAGARME_API_KEY}' | base64 -d) \
 *   ENCRYPTION_KEY=$(kubectl ... -o jsonpath='{.data.ENCRYPTION_KEY}' | base64 -d) \
 *   npm run pagarme:migrar-recipients
 *
 * `ENCRYPTION_KEY` precisa ser a MESMA que cifrou os dados; com outra, o
 * documento sai como lixo e a Pagar.me recusa.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { db } from '@/server/db/pool'
import { tryDecrypt } from '@/server/lib/crypto'
import { criarRecipient, ambientePagarme, PagarmeRecipientError, type RecipientInput } from '@/server/lib/pagarmeRecipient'
import { lerRascunhoOnboarding, type RascunhoOnboarding } from '@/server/services/onboardingPagamento'

/*
 * Duas fontes de dados, porque o banco vive DENTRO do cluster:
 *
 *   --entrada <arquivo.json>  linhas exportadas via `kubectl exec … psql`,
 *                             e os UPDATEs saem em SQL (--saida-sql) para
 *                             aplicar pelo mesmo caminho;
 *   (sem --entrada)           conexão direta, para quando o script rodar de
 *                             dentro do cluster.
 *
 * O port-forward não serve: o `pg_hba` do Postgres não tem entrada para
 * 127.0.0.1, então a conexão túnel é recusada antes da senha.
 */
function arg(nome: string): string | null {
  const i = process.argv.indexOf(nome)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null
}

/** Converte uma linha exportada do banco no mesmo formato de `lerRascunhoOnboarding`. */
function rascunhoDaLinha(r: any): RascunhoOnboarding {
  const dia = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : '')
  return {
    tipoPessoa: r.pgm_tipo_pessoa === 'PJ' ? 'PJ' : 'PF',
    documento: tryDecrypt(r.pgm_documento) ?? '',
    razaoSocial: r.pgm_razao_social ?? '',
    dataNascimento: dia(r.pgm_data_nascimento),
    rendaCentavos: r.pgm_renda_centavos ?? null,
    endCep: r.pgm_end_cep ?? '', endLogradouro: r.pgm_end_logradouro ?? '',
    endNumero: r.pgm_end_numero ?? '', endComplemento: r.pgm_end_complemento ?? '',
    endBairro: r.pgm_end_bairro ?? '', endCidade: r.pgm_end_cidade ?? '',
    endUf: r.pgm_end_uf ?? '',
    socioNome: r.pgm_socio_nome ?? '', socioCpf: tryDecrypt(r.pgm_socio_cpf) ?? '',
    socioNascimento: dia(r.pgm_socio_nascimento), socioEmail: r.pgm_socio_email ?? '',
    socioTelefone: r.pgm_socio_telefone ?? '', socioRendaCentavos: r.pgm_socio_renda_centavos ?? null,
    bancoCodigo: r.pgm_banco_codigo ?? '', bancoAgencia: r.pgm_banco_agencia ?? '',
    bancoAgenciaDv: r.pgm_banco_agencia_dv ?? '', bancoConta: r.pgm_banco_conta ?? '',
    bancoContaDv: r.pgm_banco_conta_dv ?? '',
    bancoTipo: r.pgm_banco_tipo === 'poupanca' ? 'poupanca' : 'corrente',
    titularNome: r.pgm_titular_nome ?? '', titularDocumento: tryDecrypt(r.pgm_titular_documento) ?? '',
  }
}

type Alvo = {
  id: string
  nome: string
  email: string
  telefone: string | null
  ambienteAtualDoRegistro: string | null
  recipientAntigo: string | null
}

/** Falta algum dado que a Pagar.me exige? Devolve a lista do que falta. */
function faltando(r: NonNullable<Awaited<ReturnType<typeof lerRascunhoOnboarding>>>, telefone: string | null): string[] {
  const falta: string[] = []
  if (!telefone) falta.push('telefone no perfil')
  if (!r.documento) falta.push('CPF/CNPJ')
  if (!r.razaoSocial) falta.push('nome/razão social')
  if (!r.dataNascimento) falta.push('data de nascimento')
  if (!r.rendaCentavos) falta.push('renda')
  // Endereço passou a ser obrigatório na migration 045: quem cadastrou antes
  // não tem. A Pagar.me recusa sem ele, então não adianta tentar.
  if (!r.endCep || !r.endLogradouro || !r.endNumero || !r.endBairro || !r.endCidade || !r.endUf) {
    falta.push('endereço')
  }
  if (!r.bancoCodigo || !r.bancoAgencia || !r.bancoConta || !r.bancoContaDv) falta.push('conta bancária')
  if (!r.titularNome || !r.titularDocumento) falta.push('titular da conta')
  if (r.tipoPessoa === 'PJ' && (!r.socioNome || !r.socioCpf || !r.socioNascimento)) {
    falta.push('sócio administrador')
  }
  return falta
}

async function main() {
  const executar = process.argv.includes('--sim')
  const ambiente = ambientePagarme()
  const key = process.env.PAGARME_API_KEY ?? ''

  if (!key) {
    console.error('PAGARME_API_KEY ausente — abortando (sem chave o modo mock criaria IDs falsos).')
    process.exit(1)
  }

  console.log(`Ambiente Pagar.me: ${ambiente} (${key.slice(0, 8)}…)`)
  console.log(executar ? 'Modo: EXECUTAR\n' : 'Modo: simulação (use `-- --sim` para criar de verdade)\n')

  /*
   * Alvos: quem já preencheu o formulário mas não tem recebedor VÁLIDO neste
   * ambiente. Inclui `pgm_ambiente` nulo (cadastro anterior à migration 048,
   * necessariamente sandbox) e os `mock_rcp_*` do período em modo mock.
   */
  const entrada = arg('--entrada')
  const linhas: any[] = entrada
    ? JSON.parse(readFileSync(entrada, 'utf-8'))
    : (await db.query<any>(
        `SELECT id, nome, email, telefone, pgm_ambiente, pagarme_recipient_id,
                pgm_tipo_pessoa, pgm_documento, pgm_razao_social, pgm_data_nascimento, pgm_renda_centavos,
                pgm_end_cep, pgm_end_logradouro, pgm_end_numero, pgm_end_complemento,
                pgm_end_bairro, pgm_end_cidade, pgm_end_uf,
                pgm_socio_nome, pgm_socio_cpf, pgm_socio_nascimento, pgm_socio_email,
                pgm_socio_telefone, pgm_socio_renda_centavos,
                pgm_banco_codigo, pgm_banco_agencia, pgm_banco_agencia_dv, pgm_banco_conta,
                pgm_banco_conta_dv, pgm_banco_tipo, pgm_titular_nome, pgm_titular_documento
           FROM psicologos WHERE pgm_documento IS NOT NULL AND status = 'ativo' ORDER BY nome`,
      )).rows

  // Quem já tem recebedor VÁLIDO neste ambiente não é alvo.
  const rows: Alvo[] = linhas
    .filter(l => l.pgm_ambiente !== ambiente || !l.pagarme_recipient_id)
    .map(l => ({
      id: l.id, nome: l.nome, email: l.email, telefone: l.telefone,
      ambienteAtualDoRegistro: l.pgm_ambiente, recipientAntigo: l.pagarme_recipient_id,
      linha: l,
    })) as any

  if (!rows.length) {
    console.log('Nada a fazer: todos os psicólogos com cadastro já têm recebedor neste ambiente.')
    return
  }

  const migrados: string[] = []
  const sql: string[] = []
  const incompletos: Array<{ nome: string; falta: string[] }> = []
  const falhas: Array<{ nome: string; erro: string }> = []

  for (const p of rows) {
    const r = entrada ? rascunhoDaLinha((p as any).linha) : await lerRascunhoOnboarding(p.id)
    if (!r || !r.tipoPessoa) { incompletos.push({ nome: p.nome, falta: ['formulário nunca enviado'] }); continue }

    const falta = faltando(r, p.telefone)
    if (falta.length) { incompletos.push({ nome: p.nome, falta }); continue }

    const endereco = {
      cep: r.endCep, logradouro: r.endLogradouro, numero: r.endNumero,
      complemento: r.endComplemento || null, bairro: r.endBairro,
      cidade: r.endCidade, uf: r.endUf,
    }
    const input: RecipientInput = {
      tipoPessoa: r.tipoPessoa,
      documento: r.documento,
      razaoSocial: r.razaoSocial,
      email: p.email,
      telefone: p.telefone!,
      dataNascimento: r.dataNascimento,
      rendaCentavos: r.rendaCentavos!,
      endereco,
      socio: r.tipoPessoa === 'PJ'
        ? {
            nome: r.socioNome, cpf: r.socioCpf, dataNascimento: r.socioNascimento,
            email: r.socioEmail || p.email, telefone: r.socioTelefone || p.telefone!,
            rendaMensalCentavos: r.socioRendaCentavos ?? r.rendaCentavos!,
            endereco,
          }
        : null,
      banco: {
        codigo: r.bancoCodigo, agencia: r.bancoAgencia, agenciaDv: r.bancoAgenciaDv || null,
        conta: r.bancoConta, contaDv: r.bancoContaDv, tipo: r.bancoTipo,
        titularNome: r.titularNome, titularDocumento: r.titularDocumento,
      },
    }

    if (!executar) {
      console.log(`· ${p.nome} — pronto para migrar (${r.tipoPessoa}, banco ${r.bancoCodigo})`)
      migrados.push(p.nome)
      continue
    }

    try {
      const criado = await criarRecipient(input)
      if (entrada) {
        // Sem acesso direto ao banco: o UPDATE sai em SQL para aplicar via psql.
        sql.push(`UPDATE psicologos SET pagarme_recipient_id = '${criado.recipientId}', pgm_ambiente = '${ambiente}', pgm_onboarding_em = NOW() WHERE id = '${p.id}';`)
      } else {
        await db.query(
          `UPDATE psicologos SET pagarme_recipient_id = $2, pgm_ambiente = $3, pgm_onboarding_em = NOW()
            WHERE id = $1`,
          [p.id, criado.recipientId, ambiente],
        )
      }
      console.log(`✓ ${p.nome} → ${criado.recipientId} (status=${criado.status})`)
      migrados.push(p.nome)
    } catch (err) {
      /*
       * Uma falha não interrompe as outras: se a conta ainda estiver sem split
       * habilitado, TODAS falham igual e o relatório final deixa isso claro de
       * uma vez, em vez de parar no primeiro nome.
       */
      const detalhe = err instanceof PagarmeRecipientError
        ? (err.campos.map(c => `${c.caminho}: ${c.mensagens.join('; ')}`).join(' | ') || String((err.detalhe as any)?.message ?? err.message))
        : err instanceof Error ? err.message : String(err)
      console.error(`✗ ${p.nome} — ${detalhe}`)
      falhas.push({ nome: p.nome, erro: detalhe })
    }
  }

  console.log('\n──────── resumo ────────')
  console.log(`${executar ? 'Migrados' : 'Migráveis'}: ${migrados.length}`)
  if (incompletos.length) {
    console.log(`\nPrecisam completar o cadastro (${incompletos.length}) — refazer o wizard:`)
    for (const i of incompletos) console.log(`  · ${i.nome}: falta ${i.falta.join(', ')}`)
  }
  if (falhas.length) {
    console.log(`\nFalharam na Pagar.me (${falhas.length}):`)
    for (const f of falhas) console.log(`  · ${f.nome}: ${f.erro}`)
  }
  const saidaSql = arg('--saida-sql')
  if (sql.length && saidaSql) {
    writeFileSync(saidaSql, sql.join('
') + '
', 'utf-8')
    console.log(`
SQL para aplicar: ${saidaSql} (${sql.length} UPDATE)`)
  } else if (sql.length) {
    console.log('
Aplique no banco:')
    for (const q of sql) console.log('  ' + q)
  }
  if (!executar && migrados.length) {
    console.log('\nNada foi criado. Para valer: npm run pagarme:migrar-recipients -- --sim')
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1) })

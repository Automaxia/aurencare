'use client'

import { useState } from 'react'

/**
 * Vitrine pública de planos. Vive em dois lugares — a seção de compra da
 * landing e a página `/precos` — por isso é um componente só, e não markup
 * duplicado: preço divergente entre as duas telas seria erro de vendas.
 *
 * Os preços NÃO são escritos aqui. Chegam por prop a partir de
 * `src/server/lib/planos.ts`, a mesma fonte que o checkout usa para cobrar.
 * Assim a vitrine não pode anunciar um valor e a cobrança executar outro.
 */

type PlanoKey = 'free' | 'essencial' | 'pro'
type Ciclo = 'mensal' | 'anual'

export type PlanoVitrine = {
  chave: PlanoKey
  nome: string
  capSessoesIa: number
  precoMensalCentavos: number
  precoAnualCentavos: number | null
  destaque?: boolean
}

const brl = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** O que cada plano entrega, em linguagem de vitrine. */
const INCLUI: Record<PlanoKey, string[]> = {
  free: [
    'Agenda, pacientes e prontuário',
    'WhatsApp da prática',
    'Cobrança por sessão (PIX, crédito, débito)',
    'Objetivos e evolução registrada',
  ],
  essencial: [
    'Tudo do Free',
    'Temas recorrentes e leitura longitudinal',
    'Laudo de sessão sob demanda',
    'Exportação contábil pro contador',
  ],
  pro: [
    'Tudo do Essencial',
    'Volume de prática cheia',
    'Copiloto de objetivos',
    'Suporte prioritário',
  ],
}

export function PrecosTabela({ planos, cicloInicial = 'mensal' }: {
  planos: PlanoVitrine[]
  cicloInicial?: Ciclo
}) {
  const [ciclo, setCiclo] = useState<Ciclo>(cicloInicial)

  return (
    <div className="pr-wrap">
      <div className="pr-toggle" role="group" aria-label="Ciclo de cobrança">
        <button
          type="button"
          className={'pr-toggle-btn' + (ciclo === 'mensal' ? ' on' : '')}
          onClick={() => setCiclo('mensal')}
          aria-pressed={ciclo === 'mensal'}
        >
          Mensal
        </button>
        <button
          type="button"
          className={'pr-toggle-btn' + (ciclo === 'anual' ? ' on' : '')}
          onClick={() => setCiclo('anual')}
          aria-pressed={ciclo === 'anual'}
        >
          Anual <span className="pr-off">−12%</span>
        </button>
      </div>

      <div className="pr-grid">
        {planos.map(p => {
          const gratuito = p.precoMensalCentavos === 0
          // No anual mostramos o equivalente mensal (é como a pessoa compara),
          // com a cobrança de uma vez explicitada logo abaixo — sem letra miúda.
          const anual = ciclo === 'anual' && p.precoAnualCentavos != null
          const exibido = gratuito
            ? 0
            : anual
              ? Math.round(p.precoAnualCentavos! / 12)
              : p.precoMensalCentavos

          const href = gratuito
            ? '/cadastro'
            : `/cadastro?plano=${p.chave}&ciclo=${ciclo}`

          return (
            <div key={p.chave} className={'pr-card' + (p.destaque ? ' destaque' : '')}>
              {p.destaque && <div className="pr-tag">Mais escolhido</div>}

              <h3 className="serif pr-nome">{p.nome}</h3>

              <div className="pr-preco">
                {gratuito ? (
                  <span className="pr-valor">Grátis</span>
                ) : (
                  <>
                    <span className="pr-cifra">R$</span>
                    <span className="pr-valor">{brl(exibido)}</span>
                    <span className="pr-por">/mês</span>
                  </>
                )}
              </div>

              <div className="pr-preco-nota">
                {gratuito
                  ? 'Para sempre. Sem cartão.'
                  : anual
                    ? `R$ ${brl(p.precoAnualCentavos!)} cobrados uma vez por ano`
                    : 'Cobrado todo mês. Cancele quando quiser.'}
              </div>

              <div className="pr-cap">
                <strong>{p.capSessoesIa}</strong> sessões com a Audere por mês
              </div>

              <ul className="pr-lista">
                {INCLUI[p.chave].map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <a href={href} className={'btn-lp ' + (p.destaque ? 'btn-lp-primary' : 'btn-lp-ghost') + ' pr-cta'}>
                {gratuito ? 'Criar conta grátis →' : `Assinar ${p.nome} →`}
              </a>
            </div>
          )
        })}
      </div>

      <p className="pr-rodape">
        Todos os planos incluem a plataforma inteira — o que muda é o volume de sessões
        com a Audere. Sobre o pagamento dos seus pacientes cobramos 2,5% por sessão,
        descontados na própria liquidação.
      </p>
    </div>
  )
}

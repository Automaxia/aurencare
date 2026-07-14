# Contexto

Estamos em beta (`BETA_LIBERADO = true`, cobrança desligada) e preparando o modelo de preço final da Audere. A extração real de `api_custos` (10 jun → 12 jul 2026, 2 psicólogos, 11 sessões, 4.228 chamadas, R$ 39,81) revelou que **o modelo de cobrança está medindo a coisa errada**:

- A tabela de planos cobra por **sessão-IA** (custo modelado: R$ 1,27/sessão).
- Mas **78% do gasto real (R$ 31,17) não está ligado a sessão** — são jobs de fundo/batch.
- O maior item único de todos é `temas.grafo.clinico` a **R$ 11,03 (28% do gasto total)**, e é um **recálculo em lote**, não custo de atendimento.
- Só a transcrição grava `sessao_id`. **Todo o custo de LLM está solto**, sem vínculo com sessão, psicólogo ou paciente.

Conclusão: a cota por sessão protege apenas 22% do custo. Não podemos ligar a cobrança sem entender como o custo de fundo escala.

**Não altere preços, planos ou a flag de beta.** O objetivo desta rodada é instrumentar, reduzir vazamento óbvio e **medir** — não decidir modelo.

---

# Tarefas, em ordem estrita de dependência

## Tarefa 0 — Mapear o terreno antes de mudar qualquer coisa (bloqueante)

Antes de escrever código, leia e me reporte:

1. O schema real da tabela `api_custos` (colunas, tipos, índices, quais campos são nullable).
2. **Todos** os pontos do código que gravam em `api_custos` — liste arquivo + função. Quero saber quantos call-sites existem e se há um wrapper único ou se cada chamada grava por conta própria.
3. Todos os call-sites de LLM (Anthropic, OpenAI) e de transcrição (AssemblyAI). Para cada um, qual operação ele representa (o valor que hoje aparece como `ia.tom`, `temas.grafo.clinico`, `resumo/laudo`, `ia.obs-viva`, `marcos`).
4. Como `temas.grafo.clinico` é disparado hoje: é cron? trigger por evento? on-demand? Qual a frequência e qual o escopo de cada execução (recalcula 1 paciente? todos os pacientes de 1 psicólogo? tudo?).
5. O grafo recalcula **do zero** a cada execução, ou é incremental?

**Pare aqui e me mostre esse levantamento antes de prosseguir.** Se houver mais de ~5 call-sites de LLM sem wrapper comum, quero decidir contigo o desenho antes de você mexer.

---

## Tarefa 1 — Instrumentação de custo (a condição para tudo o mais)

Hoje o custo de IA é cego. Precisamos saber, para cada centavo gasto, **de quem é, de qual paciente, de qual sessão e de qual operação**.

### 1a. Estender `api_custos`

Adicione (migration, nullable para não quebrar o histórico):

- `sessao_id` — nullable (jobs de fundo não têm sessão)
- `psicologo_id` — **deve ser preenchido sempre**, inclusive em jobs de fundo
- `paciente_id` — nullable
- `operacao` — enum/string estável e canônica (ex.: `transcricao`, `grafo_temas`, `analise_tom`, `obs_viva`, `laudo`, `marcos`)
- `natureza` — enum: `sessao` | `ao_vivo` | `fundo`
- `escopo_recalculo` — nullable; só para jobs de fundo. Quantas sessões/eventos foram processados naquela execução. **Este campo é o que vai revelar a curva de custo do grafo.**

Se algum desses campos já existir com outro nome, reutilize — não duplique.

### 1b. Wrapper único e obrigatório

Crie (ou consolide, se já existir algo parecido) **um único ponto de passagem** por onde toda chamada de LLM/transcrição precisa passar. Algo como:

```ts
registrarCustoIA({
  provedor, modelo, operacao, natureza,
  psicologo_id, paciente_id?, sessao_id?, escopo_recalculo?,
  tokens_in?, tokens_out?, duracao_s?
})
```

Requisitos:
- Grava custo em **USD e BRL** (câmbio configurável, hoje 5,40 — não hardcode espalhado).
- Anthropic/OpenAI: custo por **tokens reais**, não estimativa.
- AssemblyAI: custo por duração.
- **Se `psicologo_id` não for informado, falhe alto** (throw em dev, log de erro crítico em prod). Custo órfão é o problema que estamos corrigindo — não crie mais.

Refatore **todos** os call-sites do levantamento da Tarefa 0 para passarem por aqui. Nenhuma chamada de IA pode escrever em `api_custos` por fora.

### 1c. Teste

Teste de integração que roda uma sessão fake ponta a ponta e afirma que **toda** linha gerada em `api_custos` tem `psicologo_id` e `operacao` preenchidos, e que as de `natureza='sessao'` têm `sessao_id`.

---

## Tarefa 2 — Fechar o vazamento do `ia.tom` (barato, reversível, faça já)

Dado real: a mesma chamada mecânica de análise ao vivo custa

- Anthropic: **R$ 0,00202**/chamada (1.752 chamadas = R$ 3,54)
- OpenAI gpt-4o-mini: **R$ 0,00024**/chamada (1.378 chamadas = R$ 0,33)

**8,4× mais caro pelo mesmo trabalho.** Hoje o tráfego está dividido entre os dois.

O que fazer:

- Roteie **100% do tier `fast`** (análise ao vivo, `ia.tom`, `ia.obs-viva`, chamadas mecânicas de baixo risco) para `gpt-4o-mini`.
- Anthropic fica **exclusivamente** como fallback em caso de erro/timeout do OpenAI — e o fallback deve **logar um alerta**, porque fallback silencioso é como o vazamento começou.
- **Não** mova para o modelo barato: `laudo`, `resumo` clínico e qualquer detecção de risco. Esses continuam no modelo forte. O critério é risco clínico, não custo.

Alvo: as ~3.130 chamadas de `ia.tom` saem de R$ 3,87 → ~R$ 0,75.

**Antes de mexer, me mostre a lista de operações que você classificou como `fast` para eu aprovar.** Não quero descobrir depois que algo clínico foi rebaixado.

---

## Tarefa 3 — Descobrir a curva de custo do grafo (a pergunta de R$ 1 milhão)

Esta é a tarefa que decide o modelo de negócio. `temas.grafo.clinico` é 28% do gasto e é o nosso diferencial competitivo — não vamos cortá-lo, vamos entendê-lo.

**A pergunta:** o custo de recalcular o grafo escala com o quê?

- Por **psicólogo**? → custo fixo por assinante. Gerenciável.
- Por **paciente ativo**? → cresce com o sucesso do cliente, invisível na cota de sessões.
- Por **sessão acumulada no histórico**? → é uma bomba. O paciente na sessão 40 é onde a Audere brilha *e* onde ela sangra, todo mês, para sempre, mesmo sem sessões novas.

**O que fazer:**

Escreva um script de benchmark (`scripts/bench-grafo.ts`, ou onde fizer sentido) que:

1. Gera pacientes sintéticos com histórico de **5, 10, 20, 40 e 80 sessões** (transcrições realistas em tamanho, não lorem ipsum de 3 linhas).
2. Dispara o recálculo do grafo para cada um.
3. Mede e tabula, por tamanho de histórico: **tokens de entrada, tokens de saída, custo em BRL, latência**.
4. Cospe uma tabela e me diz explicitamente se a curva é **O(1), O(n) ou O(n²)** no número de sessões.

Rode contra um ambiente de teste, não produção. Se não houver ambiente isolado, me avise antes de rodar.

**Não implemente otimização ainda.** Meça primeiro, me mostre a curva, decidimos juntos.

---

## Tarefa 4 — Diagnóstico do disparo do grafo (só reportar, não corrigir ainda)

Com base na Tarefa 0.4, me responda:

- O grafo recalcula por **cron** ou por **evento**?
- Se for cron: com que frequência, e quantos pacientes ele varre por execução?
- Recalcula pacientes **sem sessão nova** desde o último recálculo? (Se sim, estamos pagando para redesenhar um grafo que não mudou — e essa é provavelmente a maior economia disponível.)
- Existe cache ou memoização de qualquer tipo?

Proponha — **sem implementar** — o desenho de um recálculo **incremental, disparado por evento** (nova sessão finalizada), com teto de frequência. Quero avaliar o custo/complexidade antes de você escrever.

---

# Regras

- **Não toque** em preços, cotas, tiers ou `BETA_LIBERADO`.
- **Não otimize** o grafo antes de medir a curva (Tarefa 3).
- Se encontrar divergência entre o que a doc/`CLAUDE.md` diz e o que o código faz, **o código é a verdade** — reporte a divergência, e ao final alinhe a doc (a doc ainda descreve roteamento Anthropic-primário, mas o código já é OpenAI-primário no `fast`).
- Commits pequenos e separados por tarefa.
- **Pare e me consulte** ao final da Tarefa 0, antes da Tarefa 2 (lista de operações `fast`), e ao final da Tarefa 3 (curva medida).

# Entregável final desta rodada

1. O levantamento da Tarefa 0.
2. `api_custos` instrumentado, com wrapper único e teste passando.
3. `ia.tom` consolidado no gpt-4o-mini, com alerta no fallback.
4. **A curva de custo do grafo**, medida e tabulada.
5. Proposta (não implementada) de recálculo incremental.

Com isso na mão, eu fecho a tabela de preços final.

# tasks.md — Migração para o Asaas · Audere

> Requisitos em [spec.md](./spec.md); design em [sdd.md](./sdd.md).
> Backlog geral em [../tasks.md](../tasks.md). Criado em 04/11/2026.

Legenda status: ✅ concluído · 🔄 em andamento · ⏳ pendente · 🔮 futuro
Legenda prioridade: **P0** bloqueia a virada · **P1** importante · **P2** desejável
Dono: **[conta]** = ação no painel/comercial do Asaas (dono da conta) · **[dev]** = código

---

## Fase 0 — Conta e validação no sandbox (antes de escrever o adaptador)

- ⏳ **P0 [conta]** Completar o cadastro da conta raiz (hoje "Nível 1"): documento +
  selfie do usuário, dados comerciais ("Desenvolvimento e Suporte tecnológico",
  regime tributário, faturamento) e documentos da empresa.
- ⏳ **P0 [conta]** Cadastrar **chave PIX** da conta raiz (sem ela o QR é
  transitório e expira no mesmo dia).
- ⏳ **P0 [conta]** Habilitar **split** em *Integrações › Segurança* (SMS/token).
- ⏳ **P0 [conta]** Perguntar ao Asaas, por escrito: (1) subcontas via API liberadas?
  (2) pedir **homologação antecipada** para sair do período de avaliação
  (10 subcontas / R$ 2.000 por subconta / 60 dias); (3) playbook de marca para
  white-label; (4) habilitação de tokenização (só se D-04 mudar); (5) BaaS — custo
  e prazo (D-06, futuro).
- ✅ **P0 [conta]** Conta **sandbox** com chave (`.env.local`), raiz aprovada e
  chave PIX CNPJ. ⚠️ Compartilhada com o BolsoAI (não mexer no webhook dele).
- ⏳ **P0 [conta]** Novos, saídos do spike ([spike.md](./spike.md) §10 P5):
  - **whitelist de IPs** na raiz (pré-requisito para gerar nova apiKey de subconta);
  - perguntar ao Asaas: estorno PIX via API sem **autorização manual de evento
    crítico** (D-09) e se a exigência de **saldo na raiz ≥ estorno** vale em
    produção (D-08).
- ✅ **P0 [dev]** Spike no sandbox (`scripts/asaas-spike.ts`, `npm run asaas:spike`),
  respostas reais em [`spike.md`](./spike.md) — 04/11/2026:
  - [x] subconta PF e PJ; campos obrigatórios; filtro `?cpfCnpj=` existe; documento
        repetido → 400 "já está em uso";
  - [x] aprovação por `POST /sandbox/myAccount/approve` (apiKey da subconta);
        `ACCOUNT_STATUS_*` chegam fora de ordem;
  - [x] split antes da aprovação: **aceito e liquidado** (RN-06 → `walletId`);
  - [x] **D-01:** raiz ficou com R$ 0,25 exatos de R$ 10 — via `PUT /v3/payments/{id}`
        (o `lean` não devolve o split);
  - [x] **D-03:** link descarta o `split` (pago em 6x, sem split) → opção (1); parcelado com
        `PUT /v3/installments/{id}/splits` exato;
  - [~] **D-04:** sem cartão ok; paga **pela fatura**, guarda o cartão;
        ⏳ ver a renovação de 05/11 (`-- pendencias`);
  - [x] estorno: cartão ok; PIX exige `splitRefunds`, saldo na raiz e autorização
        de evento crítico (D-08, D-09);
  - [x] `notificationDisabled=true` desliga e-mail/SMS (confirmado no painel);
  - [x] webhook reenviado em ~32 s com o mesmo `id` (`evt_<hex>&<n>`).
- ✅ **P1** `sdd.md` atualizado; D-01, D-02, D-03 fechadas; D-04 com pendência;
  D-08/D-09 novas.
- ⏳ **P1 [dev]** Pendências do spike P3 e P5 (spike.md §10); P1, P2 e P4 feitas em 04/11.

## Fase 1 — Camada de abstração (sem mudar comportamento) — ✅ 04/11/2026

- ✅ **P0 [dev]** `src/server/lib/pagamentos/tipos.ts` + `index.ts` (`gatewayPadrao`,
  `gatewayDe`, `nomeGateway`) — interface `GatewayPagamento`.
- ✅ **P0 [dev]** Adaptador `pagamentos/pagarme.ts`. **Desvio do sdd:** os clientes
  HTTP `pagarme.ts`, `pagarmeRecipient.ts` e `pagarmeSubscription.ts` ficaram onde
  estavam (scripts antigos importam de lá); o adaptador só os envolve.
  `pagamentos/split.ts` neutro (`planos.ts` continua a fonte do 2,5%).
- ✅ **P0 [dev]** Migration **053** (`053_gateway_neutro.sql`): colunas neutras +
  `cobranca_parcelamento_id` + `reembolso_pendente_em/motivo` + backfill +
  `webhook_eventos`. Idempotente (testada rodando duas vezes).
- ✅ **P0 [dev]** Serviços na interface e nas colunas neutras, com **dual-write** em
  `pagarme_*` (pod antigo e novo convivem no rollout): `sessoes.ts`,
  `onboardingPagamento.ts`, `assinatura.ts`, `inbox.ts`, `confirmacaoSessao.ts`,
  `sessaoExclusao.ts`, `admin.ts`, `financeiro.ts`, `visaoContabil.ts`,
  `exportacaoContabil.ts`, `agenda`, `/planos`. `psicologo.ts` e `cron.ts` não
  precisaram mudar.
- ✅ **P1 [dev]** Tabela única de taxas: `pagamentos/taxas.ts` (Pagar.me + Asaas),
  usando `taxa_gateway_centavos` (real, do webhook) quando houver.
- ✅ **P0 [dev]** Correções que valem para os dois gateways:
  - [x] estorno Pagar.me por charge (`GET /orders/{id}` → `DELETE /charges/{id}`);
  - [x] `marcarPagamentoCancelado` não sobrescreve `pago`/`reembolsado`/`contestado`;
  - [x] `charge.refunded` → `reembolsado`; `charge.chargedback` → `contestado`;
  - [x] `pagamento_parcelas` real (`last_transaction.installments`);
  - [x] página `/pagamento-ok` (pública);
  - [x] webhook Pagar.me passa por `webhook_eventos`;
  - [x] confirmação atômica (CONFIRMED + RECEIVED juntos não mandam 2 mensagens).
- ✅ **P0 [dev]** Testes: `npm run test:pagamentos` (unitário),
  `npm run test:pagamentos-db` (Postgres de teste) e `npm run test:split`, que
  já estava quebrado por um nome de constante antigo e foi corrigido.
- ⏳ **P0** Deploy desta fase com `PAYMENT_GATEWAY=pagarme` e regressão manual
  (cobrança PIX/cartão, webhook, cancelamento).

## Fase 2 — Adaptador Asaas — ✅ 04/11/2026 (desligado: `PAYMENT_GATEWAY=pagarme`)

- ✅ **P0 [dev]** `asaas/cliente.ts`: `access_token`, `User-Agent`, timeout 60 s,
  retry só em GET (429/5xx com backoff), `AsaasErro` tipado.
- ✅ **P0 [dev]** `asaas/recebedor.ts`: `POST /v3/accounts` com `webhooks`
  (quando há token + URL https), idempotência por `?cpfCnpj=`, apiKey cifrada na
  gravação, `lerSituacao` via `GET /v3/myAccount/status`.
- ✅ **P0 [dev]** `asaas/cobranca.ts`: customer por `externalReference`
  (`paciente:<id>`, `notificationDisabled`), PIX + `pixQrCode`, crédito à vista e
  parcelado (`installmentCount`), split por PUT (D-01), estorno com `splitRefunds`.
  Débito → crédito à vista.
- ✅ **P0 [dev]** `asaas/assinatura.ts`: criar sem cartão (fatura, D-04), trocar
  plano por `PUT`, cancelar.
- ✅ **P0 [dev]** `asaas/webhook.ts` (puro) + rota `/api/webhooks/asaas` +
  `services/eventosPagamento.ts` (dedupe + aplicação neutra).
- ✅ **P1 [dev]** `asaas/erros.ts`: recusa → campo do wizard.
- ✅ **P1 [dev]** Mock (`mock_asaas_*`) e `integrationStatus.asaas` em `env.ts`.
- ✅ **P1 [dev]** `scripts/asaas-webhook.ts` (`npm run asaas:webhook`, simula por
  padrão; `--aplicar` cria/atualiza só o webhook "Audere — cobranças").
- ✅ **P0 [dev]** `npm run test:asaas` — adaptador real no sandbox, verde em
  04/11/2026: PIX R$ 10 → raiz +0,25; 3× R$ 100 → raiz 7,50; estornos; assinatura.
- ⏳ **P1 [dev]** Teste ponta a ponta do webhook na rota (app rodando + túnel) —
  as peças (normalização, dedupe, serviços) estão cobertas pelos testes acima.

## Fase 3 — Produto (UI, textos, operação)

- ✅ **P0 [dev]** Wizard de recebimento no modo Asaas: 1 passo só (sem banco/PIX
  nem sócio), `companyType` na PJ, aviso do e-mail de acesso do Asaas e marca
  Asaas (RF-PG-12). Celular pedido no próprio wizard quando falta (antes o erro
  só aparecia no último clique) — vale também para a Pagar.me.
- ⏳ **P0 [dev]** Perfil › Recebimentos e `OnboardingBanner` mostram a situação
  cadastral (RF-PG-13).
- ⏳ **P0 [dev]** WhatsApp sem DÉBITO e **com a pergunta de parcelas** no CRÉDITO
  (D-03: "em quantas vezes, de 1 a 6?"): `inbox.ts` (parser), `evolution.ts`
  (textos) e templates Meta `audere_*` novos → **submeter à aprovação da Meta**
  pelo `/admin/whatsapp` com antecedência.
- ⏳ **P1 [dev]** Estorno PIX (D-08/D-09): reserva mínima de saldo na raiz com
  alerta no admin; listar no admin as sessões com `reembolso_pendente_em` e os
  estornos aguardando autorização de evento crítico.
- 🟡 **P0 [dev]** `/planos` no modo Asaas: botão → fatura do Asaas ✅; banner
  "fatura em aberto" ✅. Falta: "Resolver" levar à fatura PENDENTE já existente
  (hoje reassinar cancela e cria outra) e o retorno pós-pagamento.
- ✅ **P1 [dev]** Cron (`services/manutencaoPagamentos.ts`, in-process + rota
  `/api/cron/pagamentos`): PIX vencido @5min (D-05, `DELETE /payments`);
  `webhook_eventos` com erro @10min; estornos com `reembolso_pendente_em` @hora
  (D-08, alerta por e-mail ao admin após 24h); situação das subcontas 07h40/19h40.
  Validado no E2E local de 04/11/2026.
- ⏳ **P1 [dev]** `/admin`: subcontas por situação, cobranças sem split, eventos
  com erro, divergência de split.
- ✅ **P1 [dev]** Financeiro e exportação contábil: rótulo "Taxas do gateway" e
  taxa real; "estorno pendente" na linha da cobrança.
- ⏳ **P1 [dev]** `/privacidade` e termos: Asaas como operador de pagamento.

### E2E local (04/11/2026) — achados corrigidos
- Chave `$aact_…` chegava VAZIA ao Next (expansão de `$var` no `.env`) e o
  adaptador caía em mock em silêncio → escapar `\$` no `.env.local`; `env.ts`
  aceita as duas formas; em produção, Asaas padrão sem chave agora FALHA alto.
- `gravarRecebedor`/`assinar`: "inconsistent types deduced for parameter" →
  casts explícitos; o teste de banco agora roda o wizard e o `assinar` reais.
- Card de paciente mostrava sessão cancelada como "próxima sessão".

## Fase 4 — Virada e limpeza

- ⏳ **P0 [conta]** Homologação aprovada (fim do período de avaliação) **antes** de
  liberar para todos.
- ⏳ **P0 [dev]** Secrets no cluster: `ASAAS_API_URL`, `ASAAS_API_KEY`,
  `ASAAS_WEBHOOK_TOKEN`; criar o webhook da raiz em produção.
- ⏳ **P0** Piloto com 1–2 psicólogos (critérios de aceite, spec §8).
- ⏳ **P0 [dev]** `PAYMENT_GATEWAY=asaas`.
- ⏳ **P1** Convidar os 5 psicólogos com `mock_rcp_*` (e quem nunca operou na
  Pagar.me) a refazer o onboarding (RF-PG-15).
- ⏳ **P1** Acompanhar 30 dias: confirmações, split, estornos, renovações.
- 🔮 **P2 [dev]** Quando não houver mais cobrança/assinatura Pagar.me aberta:
  remover adaptador Pagar.me, colunas `pagarme_*`, `NEXT_PUBLIC_PAGARME_PUBLIC_KEY`
  do build e chaves Pagar.me do cluster; renomear `pgm_*` → `kyc_*`.
- 🔮 **P2** BaaS (onboarding dentro da Audere), se o Asaas liberar (D-06).

## Riscos

| Risco | Mitigação |
|---|---|
| Período de avaliação bloqueia subcontas/cobranças no lançamento | pedir homologação na Fase 0 |
| Split sobre líquido distorce os 2,5% | D-01 validado no spike antes de codar |
| Templates Meta novos demoram a aprovar | submeter assim que o texto estiver fechado (Fase 3, início) |
| Psicólogo não conclui KYC no Asaas (fluxo fora da Audere) | banner + lembrete por e-mail; situação visível no perfil |
| `apiKey` da subconta perdida na criação | gravar na mesma transação; procedimento de recuperação documentado |
| Asaas também travar algo na conta | é o motivo da camada de abstração: o adaptador Pagar.me continua vivo |

## Troca de plano (04/11/2026) ✅

Regra em `src/server/lib/trocaPlano.ts` (migration 054):
- **Subir** vale na hora. A diferença proporcional aos dias que faltam no ciclo é somada na próxima cobrança PENDING (PUT `/payments/{id}`). Sem cobrança gerada ainda, abre uma fatura avulsa da diferença.
- **Descer de plano ou trocar o ciclo** vale na renovação (`plano_agendado*`). O webhook só aplica quando o vencimento da cobrança paga é igual ou posterior a `plano_agendado_vigencia`, porque o RECEIVED de um ciclo anterior chega cerca de 30 dias depois.
- **Escolher o plano atual** desfaz a troca agendada. Acréscimos já somados na cobrança são preservados.
- **"Renova em"** usa o vencimento da próxima cobrança PENDING, porque `nextDueDate` da assinatura já aponta para a de depois.
- **Fatura em aberto** ("Pagar fatura"): reabre a cobrança PENDING/OVERDUE e não cria outra assinatura.
- **Pagar.me** continua como antes: cancela e cria, cobrando o plano novo cheio na hora.

E2E no sandbox (sub_nk5o4fgyvj984j5r):
- Essencial→Pro: fatura de 04/12 = 248,68 (159,90 + 88,78).
- Descer agendado: 158,68.
- "Manter Pro": volta a 248,68.

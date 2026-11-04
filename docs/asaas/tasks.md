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

## Fase 1 — Camada de abstração (sem mudar comportamento)

- ⏳ **P0 [dev]** `src/server/lib/pagamentos/tipos.ts` + `index.ts` (`gatewayPadrao`,
  `gatewayDe`) — interface `GatewayPagamento` (sdd §2.1).
- ⏳ **P0 [dev]** Mover `pagarme.ts`, `pagarmeRecipient.ts`, `pagarmeSubscription.ts`
  para `pagamentos/pagarme/` implementando a interface. `split.ts` neutro com o
  cálculo da taxa (`planos.ts` continua a fonte do 2,5%).
- ⏳ **P0 [dev]** Migration **053** (sdd §3): colunas neutras + backfill +
  `webhook_eventos`.
- ⏳ **P0 [dev]** Serviços passam a usar a interface e as colunas neutras:
  `sessoes.ts`, `onboardingPagamento.ts`, `assinatura.ts`, `inbox.ts`, `cron.ts`,
  `confirmacaoSessao.ts`, `sessaoExclusao.ts`, `psicologo.ts`, `admin.ts`,
  `financeiro.ts`, `visaoContabil.ts`, `exportacaoContabil*.ts`.
- ⏳ **P1 [dev]** Unificar a tabela de taxas estimadas (hoje duplicada) em
  `pagamentos/taxas.ts`; usar `taxa_gateway_centavos` quando houver.
- ⏳ **P0 [dev]** Correções que valem para os dois gateways:
  - [ ] estorno Pagar.me por charge (`DELETE /charges/{id}`; gravar o charge id);
  - [ ] `marcarPagamentoCancelado` não sobrescreve `pago`;
  - [ ] tratar `charge.refunded` / chargeback;
  - [ ] gravar `pagamento_parcelas` real;
  - [ ] página `/pagamento-ok` (ou trocar o `success_url`);
  - [ ] webhook Pagar.me passa por `webhook_eventos`.
- ⏳ **P0 [dev]** Testes unitários (sdd §8) e regressão: tudo continua na
  Pagar.me com `PAYMENT_GATEWAY=pagarme`. Deploy desta fase sozinha.

## Fase 2 — Adaptador Asaas

- ⏳ **P0 [dev]** `asaas/cliente.ts`: `access_token`, `User-Agent`, timeout 60 s em
  cartão/assinatura, sem retry automático em criação (risco de duplicar), backoff
  em 429, erros tipados.
- ⏳ **P0 [dev]** `asaas/recebedor.ts`: `POST /v3/accounts` com `webhooks`, cifrar
  `apiKey`, `situacaoRecebedor` via `GET /v3/myAccount/status`.
- ⏳ **P0 [dev]** `asaas/cobranca.ts`: customer (busca + cache em
  `dados_cadastro`), PIX + `pixQrCode`, crédito (`invoiceUrl`), split (D-01),
  estorno.
- ⏳ **P0 [dev]** `asaas/assinatura.ts`: criar (D-04), trocar plano por `PUT`,
  cancelar.
- ⏳ **P0 [dev]** `asaas/webhook.ts` + rota `/api/webhooks/asaas` (sdd §4.3).
- ⏳ **P1 [dev]** `asaas/erros.ts`: tradução de erros para os campos do wizard.
- ⏳ **P1 [dev]** `asaas/mock.ts` e `integrationStatus.asaas` em `env.ts`.
- ⏳ **P1 [dev]** `scripts/asaas-webhook.ts` (`npm run asaas:webhook`): cria/atualiza
  o webhook da conta raiz.
- ⏳ **P0 [dev]** `npm run test:asaas` — integração no sandbox (sdd §8).

## Fase 3 — Produto (UI, textos, operação)

- ⏳ **P0 [dev]** Wizard de recebimento no modo Asaas: tira banco/PIX, acrescenta
  `companyType` (PJ) e e-mail de login; tela final com o aviso do e-mail do
  Asaas e a marca Asaas (RF-PG-12).
- ⏳ **P0 [dev]** Perfil › Recebimentos e `OnboardingBanner` mostram a situação
  cadastral (RF-PG-13).
- ⏳ **P0 [dev]** WhatsApp sem DÉBITO e **com a pergunta de parcelas** no CRÉDITO
  (D-03: "em quantas vezes, de 1 a 6?"): `inbox.ts` (parser), `evolution.ts`
  (textos) e templates Meta `audere_*` novos → **submeter à aprovação da Meta**
  pelo `/admin/whatsapp` com antecedência.
- ⏳ **P1 [dev]** Estorno PIX (D-08/D-09): reserva mínima de saldo na raiz com
  alerta no admin, `reembolso_pendente` (sem saldo / "tente novamente") e
  `reembolso_solicitado` (aguardando autorização de evento crítico).
- ⏳ **P0 [dev]** `/planos` no modo Asaas: botão → fatura do Asaas → retorno.
- ⏳ **P1 [dev]** Cron: cancelar PIX vencido pela regra de 30 min (D-05);
  reconciliar situação das subcontas pendentes (1×/dia); reprocessar
  `webhook_eventos` com erro; reembolso pendente.
- ⏳ **P1 [dev]** `/admin`: subcontas por situação, cobranças sem split, eventos
  com erro, divergência de split.
- ⏳ **P1 [dev]** Financeiro e exportação contábil: rótulo "Taxas do gateway"
  (hoje "Taxas Pagar.me") e taxa real.
- ⏳ **P1 [dev]** `/privacidade` e termos: Asaas como operador de pagamento.

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

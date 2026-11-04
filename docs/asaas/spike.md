# spike.md — Fase 0 no sandbox do Asaas · Audere

> Respostas reais do sandbox (`api-sandbox.asaas.com/v3`) em **04/11/2026**, obtidas com
> [`scripts/asaas-spike.ts`](../../scripts/asaas-spike.ts) (`npm run asaas:spike`) e
> conferidas no painel `sandbox.asaas.com`. Decisões que resultam daqui estão em
> [sdd.md §7](./sdd.md#7-decisões); checklist em [tasks.md](./tasks.md) (Fase 0).
>
> O log HTTP redigido e o estado de cada execução ficam em
> `%TEMP%/audere-asaas-spike/` (fora do repo; o estado guarda as apiKeys das subcontas
> de teste).

## Resumo

| Item | Resultado | Consequência |
|---|---|---|
| Subconta PF e PJ | ✅ criadas; filtro `?cpfCnpj=` existe; CPF/CNPJ repetido → 400 | idempotência por busca antes de criar |
| Aprovação | ✅ `POST /sandbox/myAccount/approve` com a apiKey **da subconta** | eventos `ACCOUNT_STATUS_*` chegam fora de ordem |
| Split antes da aprovação | ✅ **aceito**, e o split é liquidado (`DONE`) | RN-06: split já com `walletId` (validar no piloto) |
| **D-01** | ✅ (a) funciona: raiz ficou com **R$ 0,25 exatos** de R$ 10 | `PUT /v3/payments/{id}` com split, não o `lean` |
| **D-03** | ❌ link **descarta** o `split` (pago em 6x: nenhuma parcela com split); parcelado pela API ✅ exato | opção (1): WhatsApp pergunta as parcelas |
| **D-04** | ✅ paga **pela fatura** (e pela API) a assinatura guarda o cartão; a próxima cobrança já nasce com ele | ⏳ só a renovação debitada em 05/11 |
| Estorno | ⚠️ cartão ✅; PIX exige **saldo na raiz ≥ valor do estorno** e **autorização de evento crítico** | reserva de saldo + item de conta |
| `notificationDisabled` | ✅ desliga e-mail/SMS do Asaas (confirmado no painel) | a API continua listando as notificações como ativas |
| Webhook duplicado | ✅ reenvio em ~32 s com o **mesmo `id`**; token sempre presente | dedupe pela string inteira do `id` |

## Ambiente

- A conta raiz do sandbox (PJ, CNPJ da Automaxia) já está `general=APPROVED`, com
  **chave PIX CNPJ ativa**. Split funcionou sem precisar de habilitação. Em produção
  a habilitação em *Integrações › Segurança* continua obrigatória (tasks Fase 0).
- ⚠️ O sandbox é **compartilhado com o BolsoAI**. Ele tem um webhook próprio
  ("BolsoAI local (sandbox)", ngrok antigo) que recebe também os eventos das nossas
  cobranças e está penalizado. O spike cria um webhook temporário `audere-spike-*` e
  o remove no fim. Não mexer no do BolsoAI.
- Tarifas do sandbox (`GET /myAccount/fees`): PIX **R$ 1,99** (promo R$ 0,99 até
  05/01/2027); crédito à vista 2,99% + R$ 0,49 (promo 1,99%), 2–6x 3,49% (promo
  2,49%). A tabela tem débito (1,89% + R$ 0,35), mas não existe débito na criação de
  cobrança. Ver RF-PG-20.
- Túnel para o webhook: o ngrok instalado (3.23.1) é recusado pela conta (mínimo
  3.28) e o zip novo é bloqueado pelo Defender. Usamos o quick tunnel do
  `cloudflared` (`ASAAS_SPIKE_CLOUDFLARED=<binário>`). Depois o ngrok 3.39 foi
  instalado pela Microsoft Store, mas o do Chocolatey (3.23) vem antes no PATH.
  `ASAAS_SPIKE_NGROK=<caminho>` escolhe o binário. Para resolver de vez, rodar como
  admin `choco upgrade ngrok -y` ou `choco uninstall ngrok -y`.

## 1. Subcontas PF e PJ

- `POST /v3/accounts {}` → 400 com: CEP, CPF/CNPJ, nome e data de nascimento. O
  corpo do sdd §4.1 (`name, email, cpfCnpj, mobilePhone, incomeValue, address,
  addressNumber, complement, province, postalCode` + `birthDate` (PF) |
  `companyType: LIMITED` (PJ)) foi **aceito** nos dois casos.
- **Latência alta:** PF **10,4 s**, PJ **28,7 s**. O timeout do cliente tem que ser
  ≥ 60 s também aqui, e o wizard precisa de estado "criando…" (não só cartão e
  assinatura, como diz o tasks Fase 2).
- Resposta: `id`, `walletId`, `accountNumber`, `loginEmail` (= `email`) e a chave
  **em dois lugares**: `apiKey` no topo e `accessToken.apiKey`.
- `webhooks` dentro do `POST /accounts` foi aceito (formato do sdd §4.1, com `name`,
  `email`, `enabled`, `interrupted`, `apiVersion: 3`, `authToken`, `sendType`).
- Idempotência: `GET /v3/accounts?cpfCnpj=` e `?walletId=` **funcionam**
  (`totalCount=1`, mesmo `id`). Criar de novo com o mesmo documento →
  `400 invalid_object "O CPF … já está em uso."` / `"O CNPJ … já está em uso."`.
- Situação inicial:
  - PF: `commercialInfo=APPROVED`, `bankAccountInfo=PENDING`, `documentation=PENDING`, `general=PENDING`.
  - PJ: `commercialInfo=AWAITING_APPROVAL`, os outros `PENDING`.
- Recuperar a chave (`GET /v3/accounts/{id}/accessTokens`) → `400 invalid_action
  "…é necessário ter uma configuração de whitelist de IPs configurada"`. A
  recuperação de apiKey perdida depende de **whitelist de IPs na conta raiz**
  (item de conta novo).

## 2. Aprovação e `ACCOUNT_STATUS_*`

- `POST /v3/sandbox/myAccount/approve` **com a apiKey da subconta** → 200. Não
  existe a versão que recebe o id da subconta. As quatro dimensões passam a
  `APPROVED` na hora.
- Eventos recebidos no webhook da subconta:
  - ao criar: `ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED`;
  - ao aprovar: `BANK_ACCOUNT_INFO_APPROVED` → `GENERAL_APPROVAL_AWAITING_APPROVAL`
    → `DOCUMENT_APPROVED` → `GENERAL_APPROVAL_APPROVED`.
- O `AWAITING_APPROVAL` geral chega **depois** de aprovações parciais, então o
  **nome** do evento não serve como estado.
- **Payload (capturado na 2ª rodada, 04/11):**
  ```json
  { "id": "evt_403d8f21…&24285042", "event": "ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED",
    "dateCreated": "2026-11-04 15:23:22",
    "account": { "id": "<subconta>", "ownerId": "<conta raiz>" },
    "accountStatus": { "id": "<subconta>", "commercialInfo": "APPROVED",
      "bankAccountInfo": "APPROVED", "documentation": "APPROVED", "general": "APPROVED" } }
  ```
  `accountStatus` é um **snapshot do estado atual na hora da entrega**: até o
  `GENERAL_APPROVAL_AWAITING_APPROVAL` (fora de ordem) já veio com
  `general=APPROVED`. Gravar o `accountStatus` do payload, ignorar o nome do evento.
  Não precisa de `GET /myAccount/status` a cada evento; o `GET` fica só para a
  reconciliação do cron.
- O `approve` do sandbox chamado logo depois da criação, com `commercialInfo` ainda
  `AWAITING_APPROVAL` (caso PJ e, às vezes, PF), devolve **`500 unknow.error`**.
  Alguns segundos depois funciona. O spike retenta a cada 15 s.

## 3. Split antes da aprovação (RN-06)

- Cobrança PIX de R$ 10 com `split [{ walletId: PJ não aprovada, fixedValue: 5 }]`
  → **aceita** (`split.status=PENDING`). Depois de paga: `split.status=DONE`, saldo
  da subconta **R$ 5,00**.
- No sandbox o Asaas **não bloqueia** split para subconta pendente. O saque é que
  depende da aprovação. Produção pode ser mais restritiva: confirmar no piloto.

## 4. D-01 — 2,5% exatos do bruto

Sessão de R$ 10,00, PIX:

| Passo | Resposta |
|---|---|
| `POST /payments` sem split | `netValue = 9,01` **já na criação** (tarifa 0,99) |
| `PUT /lean/payments/{id} {split}` | 200, mas a resposta não devolve o split |
| `PUT /payments/{id} {split:[{walletId, fixedValue: 8,76}]}` | 200, split `PENDING` |
| `GET /payments/{id}/pixQrCode` | `payload` ok, `expirationDate = 2027-11-04 23:59:59` |
| confirmar (sandbox) | `RECEIVED`, `split.status=DONE` |
| Δ saldo | **raiz +0,25** (esperado 0,25) · **psicólogo +8,76** (esperado 8,76) |

- A opção (b), split já na criação com a tarifa da tabela (0,99), também deu
  `netValue` igual. Mas depende da promoção que expira em 05/01/2027 e de a tabela
  da conta não mudar.
- O QR vale **1 ano** com chave PIX cadastrada. Os 30 min são regra nossa (D-05).

## 5. D-03 — parcelas no crédito

**Link de pagamento** (`POST /paymentLinks`, `chargeType=INSTALLMENT`,
`maxInstallmentCount=6`, com `split`): 200, mas o `split` **não aparece** na resposta
nem no `GET` do link (campos devolvidos: `id, name, value, active, chargeType, url,
billingType, …, maxInstallmentCount, …`). O campo é descartado sem aviso.
**Prova final (04/11, pago pela página em 6× de R$ 50):** as 6 parcelas
(`installment` único, `netValue` 48,68 cada) estão `CONFIRMED` com **`split=null`**.
Link de pagamento **não serve** para sessão com split. Obs.: o filtro `GET /payments?paymentLink=` é **ignorado** pela API
(devolve tudo).

**Parcelado pela API** (`installmentCount=3`, `totalValue=300`):
- Cria as 3 parcelas na hora (`PAYMENT_CREATED` × 3). Σ `netValue` **antes** de
  pagar = 292,05 (2,49% + 0,49 da promo).
- `PUT /v3/installments/{id}/splits { splits: [{ walletId, totalFixedValue: 284,55 }] }` → 200.
- `payWithCreditCard` na 1ª parcela confirma **as 3** (`PAYMENT_CONFIRMED` × 3, um
  por parcela). Cada parcela: split 94,85 `AWAITING_CREDIT`. Sobra da raiz =
  **7,50 = 2,5% de 300**, exato. O crédito na conta só sai em ~32 dias.
- `split.totalFixedValue` na **criação** também funciona e divide igualmente
  (83,33 por parcela). Quando não divide exato, verificar o arredondamento.
- Estorno do parcelamento: `POST /v3/installments/{id}/refund` (ver §7).

## 6. D-04 — assinatura sem cartão na Audere

- `POST /subscriptions` com `billingType=CREDIT_CARD` **sem** `creditCard` → 200,
  `ACTIVE`. A 1ª cobrança é gerada na hora, com `invoiceUrl`.
- 1ª cobrança paga com `payWithCreditCard` → a **assinatura passa a guardar o
  cartão** (`creditCard: { creditCardNumber: final, creditCardBrand: VISA,
  creditCardToken }`).
- `PUT /subscriptions/{id} { nextDueDate: amanhã, updatePendingPayments: true }` →
  a próxima cobrança (05/11) **já nasce com o cartão VISA**.
- ✅ **Pela página** (`invoiceUrl`, o fluxo real do D-04; 04/11): a 1ª cobrança da
  `sub_z8gop9aw0utrxacn` ficou `CONFIRMED` e a assinatura passou a ter
  `creditCard` (final 1111, VISA, token) — mesmo comportamento do pagamento via API.
- ⏳ Falta só ver se a cobrança de 05/11 da `sub_ry187h6b4ef1oe03` foi debitada
  sozinha (`npm run asaas:spike -- pendencias` em 05/11).

## 7. Estorno

**Cartão (parcelado):** `POST /installments/{id}/refund` → 200. As 3 parcelas vão a
`REFUNDED`, o split a `CANCELLED` (`cancellationReason=PAYMENT_REFUNDED`) e chega
`PAYMENT_REFUNDED` por parcela. Antes do crédito, não depende de saldo.

**PIX com split:**

| Caso | Resposta |
|---|---|
| logo após o recebimento | às vezes `400 invalid_action "…Tente novamente em alguns instantes."` |
| parcial 5,00 **sem** `splitRefunds` | `400 "Valor da cobrança insuficiente…"`: o rateio automático tira **só da parte da raiz** (0,25) |
| parcial 5,00 **com** `splitRefunds [{id, value: 4}]` | 200; raiz −1, psicólogo −4 **na hora**; `refundedSplits[].done=true` |
| total 10,00 com raiz em 7,52 (com ou sem `splitRefunds`) | `400 "…não há saldo suficiente."` |
| parcial 9,50 (psicólogo 8,76) com raiz em 7,52 | `400 "Saldo insuficiente."` |
| parcial 7,40 com raiz em 7,52 | 200 |
| total 10,00 com `splitRefunds` e raiz em 11,38 | 200; split `REFUNDED` |

- **A raiz precisa ter saldo ≥ valor bruto do estorno**, mesmo quando quase tudo
  volta da subconta. Sem saldo, o estorno é recusado (não fica na fila).
- Todo estorno PIX aceito fica em **`AWAITING_CRITICAL_ACTION_AUTHORIZATION`**. O
  painel mostra "Você possui 3 eventos críticos pendentes — Criação de reembolso de
  crédito Pix", com "Enviar código" (token/SMS). O saldo já sai na hora, mas o
  dinheiro só volta ao paciente, e `PAYMENT_REFUNDED` só chega, depois da
  autorização. Nada foi autorizado no spike.

## 8. `notificationDisabled`

- `GET /customers/{id}/notifications` devolve as **mesmas 8 notificações ativas**
  (e-mail + SMS ao cliente) com `notificationDisabled` `true` ou `false`. A lista
  não reflete a flag.
- No painel, a cobrança do cliente **com** notificação mostra "Envio por E-mail e
  SMS — **Ativo**" (com "Reenviar"). A do cliente com `notificationDisabled=true`
  não tem envio ativo e só oferece habilitar. **A flag funciona como interruptor
  geral.**
- `PUT /v3/notifications/batch` com tudo `false` → 200, e depois disso a lista
  também fica desligada. Dá para usar junto com a flag.

## 9. Webhook

- **Formato do `id`:** `evt_<32 hex>&<número>`, ex.
  `evt_d26e303b238e509335ac9ba210e51b0f&24283928`. O hex é **o mesmo para todo
  evento do mesmo tipo** (todo `PAYMENT_CREATED` tem `evt_05b708f9…`), e o número é
  que distingue. Deduplicar pela **string inteira**, nunca cortar no `&`. Cabe em
  `VARCHAR(120)`.
- **Reenvio:** respondemos 500 à 1ª entrega de `PAYMENT_RECEIVED` e ela voltou
  **~32 s depois com o mesmo `id`**. Uma falha não penalizou a fila
  (`interrupted=false`, `penalizedRequestsCount=0`).
- `asaas-access-token` presente e igual ao `authToken` em **100%** das entregas
  (43/43 nas duas rodadas).
- **PIX no sandbox:** `PAYMENT_CREATED → PAYMENT_RECEIVED`, **sem**
  `PAYMENT_CONFIRMED`. Cartão: `PAYMENT_CONFIRMED`. O handler tem que tratar os
  dois como "pago" (o sdd §4.3 já prevê).
- **Ordem não garantida** mesmo com `SEQUENTIALLY`: `SUBSCRIPTION_CREATED`
  (seq. …756) chegou **depois** de `PAYMENT_CONFIRMED` (…760) da mesma assinatura.
- O payload traz `account { id, ownerId }` e o objeto `payment` completo (`value`,
  `netValue`, `billingType`, `status`, `externalReference`, `invoiceUrl`,
  `pixTransaction`, `refunds`, `subscription`/`installment` quando houver).
- Painel › Integrações › **Logs de Webhooks** tem **"Reenviar"** e "Remover da
  fila" por entrega (guardados 14 dias). Não achamos reenvio pela API.
- Resíduo: os webhooks das subcontas de teste apontam para túneis que não existem
  mais e serão penalizados (só no sandbox).

## 10. Pendências do spike

| # | O quê | Como |
|---|---|---|
| ~~P1~~ | ✅ 04/11 — fatura paga pela página; assinatura guardou o cartão | — |
| ~~P2~~ | ✅ 04/11 — link pago em 6x; parcelas sem split | — |
| P3 | Cobrança de 05/11 da `sub_ry187h6b4ef1oe03` debitada sozinha? | `pendencias` em 05/11 |
| ~~P4~~ | ✅ 04/11 — corpo de `ACCOUNT_STATUS_*` capturado (§2) | — |
| P5 | Perguntar ao Asaas: estorno via API sem autorização manual de evento crítico (whitelist de IP? configuração?) e se a exigência de saldo na raiz vale em produção | [conta] |

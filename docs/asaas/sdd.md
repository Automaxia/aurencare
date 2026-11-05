# sdd.md — Design técnico: gateway Asaas · Audere

> Requisitos em [spec.md](./spec.md); execução em [tasks.md](./tasks.md).
> Arquitetura geral em [../sdd.md](../sdd.md). Criado em 04/11/2026.
>
> Fontes: código em 04/11/2026 e documentação oficial do Asaas
> (docs.asaas.com, lida em 04/11/2026). Itens marcados **[validar]** não estão
> confirmados na documentação e precisam de teste no sandbox (tasks.md, Fase 0).
>
> **Fases 1 e 2 implementadas em 04/11/2026** (os dois gateways lado a lado,
> `PAYMENT_GATEWAY=pagarme`). Procedimento de virada em `docs/INFRA.md` §4c.
>
> **Spike da Fase 0 feito em 04/11/2026** — respostas reais em [spike.md](./spike.md).
> Os itens validados viraram **[spike ✅]**; o que ainda depende de teste manual ou de
> tempo está marcado **[spike ⏳]**.

---

## 1. Estado atual (Pagar.me)

Não existe camada de abstração. Os clientes HTTP estão em três arquivos,
importados direto pelos serviços:

| Arquivo | Funções | Endpoint Pagar.me |
|---|---|---|
| `src/server/lib/pagarme.ts` | `montarSplitSessao`, `criarOrderPix`, `criarCheckoutCartao`, `reembolsar` | `POST /orders`, `DELETE /orders/{id}` |
| `src/server/lib/pagarmeRecipient.ts` | `criarRecipient`, `ambientePagarme`, `isRecipientMock` | `POST /recipients` |
| `src/server/lib/pagarmeSubscription.ts` | `criarAssinatura`, `cancelarAssinatura` | `POST/DELETE /subscriptions` |

Consumidores diretos: `sessoes.ts`, `onboardingPagamento.ts`, `assinatura.ts`,
`admin.ts`, `inbox.ts`, `cron.ts`, `financeiro.ts`, `visaoContabil.ts`,
`exportacaoContabil*.ts`, `confirmacaoSessao.ts`, `sessaoExclusao.ts`,
`psicologo.ts`, páginas de `planos`, `perfil/recebimentos`,
`onboarding/recebimentos`, `(app)/layout.tsx`, `OnboardingBanner.tsx`.

Colunas específicas: `psicologos.pagarme_recipient_id`, `pagarme_subscription_id`,
`pgm_*` (dados de KYC, vários cifrados), `pgm_ambiente`;
`sessoes.pagarme_order_id`, `pagarme_qrcode`, `pagarme_qrcode_url`,
`pagarme_checkout_url`.

### Defeitos atuais que o novo design corrige
1. `reembolsar` chama `DELETE /orders/{id}`, que **não estorna** na v5 (o estorno é
   por charge, e o charge id não é gravado). Reembolso provavelmente nunca funcionou.
2. `marcarPagamentoCancelado` grava `falhou` sem condição: `order.canceled` depois
   do pagamento sobrescreve `pago`.
3. `charge.refunded` / chargeback são ignorados.
4. `pagamento_parcelas` nunca recebe o número real de parcelas.
5. `success_url` aponta para `/pagamento-ok`, que não existe.
6. Webhook sem deduplicação por id de evento.
7. Status do recebedor nunca é acompanhado.
8. Tabela de taxas estimadas duplicada (`financeiro.ts` e `exportacaoContabil.ts`).

## 2. Arquitetura alvo

```
src/server/lib/pagamentos/
  tipos.ts          ← DTOs neutros + interface GatewayPagamento
  index.ts          ← gatewayPadrao() e gatewayDe(nome)
  split.ts          ← cálculo da taxa administrativa (neutro, testável)
  pagarme.ts        ← adaptador (os clientes lib/pagarme*.ts ficaram no lugar — scripts importam de lá)
  taxas.ts          ← taxa do gateway (real ou estimada), fonte única
  asaas/
    cliente.ts      ← fetch com access_token, timeout, retry seguro, erros tipados
    recebedor.ts    ← subconta (POST /v3/accounts) e situação cadastral
    cobranca.ts     ← customer, payment, pixQrCode, refund
    assinatura.ts   ← subscription
    webhook.ts      ← autenticação + normalização de eventos
    erros.ts        ← tradução de erros para campos do wizard
    situacao.ts     ← snapshot → situação neutra (puro)
    ref.ts          ← externalReference sessao:/paciente:/psicologo: (puro)
    index.ts        ← adaptador + modo mock (sem chave)
```

### 2.1 Interface

```ts
type Gateway = 'pagarme' | 'asaas'

interface GatewayPagamento {
  nome: Gateway
  ambiente(): 'sandbox' | 'live'

  // Recebedor
  criarRecebedor(input: RecebedorInput): Promise<RecebedorCriado>
  situacaoRecebedor(ref: RecebedorRef): Promise<SituacaoRecebedor>

  // Cobrança de sessão
  criarCobrancaSessao(input: CobrancaSessaoInput): Promise<CobrancaCriada>
  reembolsar(cobrancaId: string, valorCentavos?: number): Promise<ReembolsoResultado>

  // Assinatura do plano
  criarAssinatura(input: AssinaturaInput): Promise<AssinaturaCriada>
  /** Troca no mesmo cartão; `acrescimoCentavos` = diferença proporcional do upgrade. */
  atualizarAssinatura?(id: string, input: AssinaturaInput, acrescimoCentavos?: number): Promise<AtualizacaoAssinatura>
  cancelarAssinatura(assinaturaId: string): Promise<boolean>
  faturaEmAberto?(assinaturaId: string): Promise<string | null>   // invoiceUrl PENDING/OVERDUE
  proximaCobranca?(assinaturaId: string): Promise<string | null>  // AAAA-MM-DD

  // Cobrança de sessão não paga (D-05: a validade é regra nossa)
  cancelarCobranca?(cobrancaId: string): Promise<boolean>

  // Webhook
  autenticarWebhook(req: Request, corpoBruto: string): boolean
  normalizarEvento(payload: unknown): EventoPagamento | null
}

type EventoPagamento =
  | { tipo: 'cobranca.paga'; eventoId: string; cobrancaId: string; liquidoCentavos?: number }
  | { tipo: 'cobranca.falhou' | 'cobranca.vencida' | 'cobranca.cancelada'; eventoId: string; cobrancaId: string }
  | { tipo: 'cobranca.reembolsada'; eventoId: string; cobrancaId: string; valorCentavos: number; parcial: boolean }
  | { tipo: 'cobranca.contestada'; eventoId: string; cobrancaId: string }
  | { tipo: 'assinatura.paga' | 'assinatura.falhou' | 'assinatura.cancelada'; eventoId: string; assinaturaId: string; cicloFim?: string; vencimento?: string }
  | { tipo: 'recebedor.situacao'; eventoId: string; recebedorId: string; situacao: SituacaoRecebedor }
```

Os serviços (`sessoes.ts`, `assinatura.ts`, `onboardingPagamento.ts`) passam a
falar só com essa interface. `gatewayPadrao()` lê `PAYMENT_GATEWAY`;
`gatewayDe(linha.gateway)` é usado para tudo que já existe (RF-PG-02).

## 3. Modelo de dados (migration 053)

Colunas **neutras**, com backfill das atuais. As colunas `pagarme_*` ficam até a
Fase 4 (remoção), sendo só lidas.

```sql
-- sessoes
ALTER TABLE sessoes
  ADD COLUMN gateway            VARCHAR(20),   -- 'pagarme' | 'asaas'
  ADD COLUMN cobranca_id        VARCHAR(100),  -- order (pagarme) | pay_... (asaas)
  ADD COLUMN cobranca_parcelamento_id VARCHAR(100), -- asaas installment (crédito parcelado, D-03)
  ADD COLUMN cobranca_qrcode    TEXT,
  ADD COLUMN cobranca_qrcode_url TEXT,
  ADD COLUMN cobranca_url       TEXT,          -- checkout (pagarme) | invoiceUrl (asaas)
  ADD COLUMN cobranca_vence_em  TIMESTAMPTZ,
  ADD COLUMN taxa_gateway_centavos INTEGER;    -- valor − líquido real (webhook)
UPDATE sessoes SET gateway='pagarme', cobranca_id=pagarme_order_id,
  cobranca_qrcode=pagarme_qrcode, cobranca_qrcode_url=pagarme_qrcode_url,
  cobranca_url=pagarme_checkout_url
 WHERE pagarme_order_id IS NOT NULL;
CREATE INDEX sessoes_cobranca ON sessoes (gateway, cobranca_id) WHERE cobranca_id IS NOT NULL;

-- psicologos: recebedor
ALTER TABLE psicologos
  ADD COLUMN recebedor_gateway   VARCHAR(20),
  ADD COLUMN recebedor_id        VARCHAR(100),  -- re_... | acc id (asaas)
  ADD COLUMN recebedor_wallet_id VARCHAR(100),  -- asaas walletId (destino do split)
  ADD COLUMN recebedor_api_key   TEXT,          -- asaas apiKey da subconta, AES-256-GCM
  ADD COLUMN recebedor_situacao  VARCHAR(30),   -- pendente|em_analise|aprovado|recusado
  ADD COLUMN recebedor_situacao_detalhe JSONB,  -- documentation/commercialInfo/bankAccountInfo/general
  ADD COLUMN recebedor_ambiente  VARCHAR(10);   -- sandbox|live (substitui pgm_ambiente)
UPDATE psicologos SET recebedor_gateway='pagarme', recebedor_id=pagarme_recipient_id,
  recebedor_ambiente=pgm_ambiente
 WHERE pagarme_recipient_id IS NOT NULL AND pagarme_recipient_id NOT LIKE 'mock_rcp_%';

-- psicologos: assinatura do plano
ALTER TABLE psicologos
  ADD COLUMN assinatura_gateway VARCHAR(20),
  ADD COLUMN assinatura_id      VARCHAR(100);
UPDATE psicologos SET assinatura_gateway='pagarme', assinatura_id=pagarme_subscription_id
 WHERE pagarme_subscription_id IS NOT NULL;
CREATE INDEX psicologos_assinatura ON psicologos (assinatura_gateway, assinatura_id)
 WHERE assinatura_id IS NOT NULL;

-- idempotência de webhooks
CREATE TABLE webhook_eventos (
  gateway      VARCHAR(20)  NOT NULL,
  evento_id    VARCHAR(120) NOT NULL,
  tipo         VARCHAR(80)  NOT NULL,
  recebido_em  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  processado_em TIMESTAMPTZ,
  erro         TEXT,
  payload      JSONB,       -- sem dados de cartão; CPF mascarado
  PRIMARY KEY (gateway, evento_id)
);
```

- Os dados de KYC `pgm_*` são **reaproveitados** pelo wizard do Asaas (mesmos
  campos, mesma cifragem). Renomear para `kyc_*` fica para a Fase 4.
- `cobranca_id` é o `pay_...` (da 1ª parcela, no parcelado). Como D-03 fechou em
  parcelamento pela API, a migration 053 acrescenta
  `sessoes.cobranca_parcelamento_id VARCHAR(100)` (id do `installment`): o estorno
  do parcelado é `POST /v3/installments/{id}/refund`, e o webhook chega **uma vez
  por parcela** (cada uma com seu `pay_...`) — o lookup da sessão usa
  `externalReference` ou o `installment` do payload, não só o `cobranca_id`.
- Todo `obterAssinatura`, Admin (MRR, cortesia) e `sqlTemCobrancaAberta` passam a
  ler `assinatura_id` / `cobranca_id`. A cortesia continua sendo "plano ≠ free e
  sem `assinatura_id`" (migration 047 usa o mesmo critério).

### Migrations seguintes
- **054 `plano_agendado`** — `psicologos.plano_agendado`, `plano_ciclo_agendado`,
  `plano_agendado_vigencia` (troca de plano na renovação, §4.5).
- **055 `wa_parcelas`** — `sessoes.wa_parcelas_perguntado_em` (pergunta de
  parcelas no WhatsApp, §4.5b).

## 4. Fluxos no Asaas

Base: `https://api.asaas.com/v3` (produção) e `https://api-sandbox.asaas.com/v3`
(sandbox), header `access_token: <chave>`, `User-Agent: Audere/1.0`. Ambiente
definido por `ASAAS_API_URL` (não pelo prefixo da chave). Limites: 25.000
requisições / 12 h por conta; 429 → backoff, nunca retry imediato.

### 4.1 Onboarding → subconta

```
wizard (dados atuais pgm_*) ──► salvarOnboarding
  └─► POST /v3/accounts   (chave da conta RAIZ)
        name, email, loginEmail, cpfCnpj, birthDate (PF) | companyType (PJ),
        mobilePhone, incomeValue, address, addressNumber, complement,
        province, postalCode,
        webhooks: [{ url: /api/webhooks/asaas, authToken, events: ACCOUNT_STATUS_* }]
  ◄── { id, walletId, accessToken.apiKey }
  grava recebedor_id=id, recebedor_wallet_id=walletId,
        recebedor_api_key=cifrar(apiKey), recebedor_situacao='pendente'
```

- Mapeamento do wizard: `pgm_renda_centavos/100 → incomeValue`;
  `pgm_data_nascimento → birthDate (AAAA-MM-DD)`; PJ: `companyType`
  (`MEI|LIMITED|INDIVIDUAL|ASSOCIATION`, campo novo no wizard).
- **Conta bancária e chave PIX saem do wizard** no modelo sem BaaS: o titular
  cadastra no próprio Asaas. A tela final explica o e-mail de ativação (RF-PG-12).
- `apiKey` só vem uma vez (no topo **e** em `accessToken.apiKey`): se a gravação
  falhar depois do `POST`, registrar o `id` em log de erro e o admin recupera
  pelo endpoint de chaves da subconta — que **exige whitelist de IPs configurada
  na conta raiz** (`400 invalid_action` sem ela) **[spike ✅]**. Item de conta.
- Idempotência: antes de criar, `GET /v3/accounts?cpfCnpj=` (filtro existe; também
  `?walletId=`/`?email=`). Documento repetido → `400 "O CPF … já está em uso."`:
  tratar como "já existe" e buscar **[spike ✅]**.
- **Latência:** `POST /v3/accounts` levou 10 s (PF) e 29 s (PJ) no sandbox →
  timeout de 60 s e estado "criando sua conta…" no wizard **[spike ✅]**.
- Situação: webhook `ACCOUNT_STATUS_*` (por dimensão) + consulta
  `GET /v3/myAccount/status` com a `apiKey` da subconta (reconciliação no cron).
  Os eventos chegam **fora de ordem** (`GENERAL_APPROVAL_AWAITING_APPROVAL` depois
  de aprovações parciais), mas cada um traz `accountStatus` com o **snapshot atual**
  das quatro dimensões (+ `account.ownerId` = conta raiz). O handler grava o
  `accountStatus` do payload e ignora o nome do evento; o `GET` fica só para a
  reconciliação do cron **[spike ✅]**. Sandbox: aprovar com
  `POST /v3/sandbox/myAccount/approve` usando a apiKey da subconta.
- Situação inicial observada: PF `commercialInfo=APPROVED`, demais `PENDING`;
  PJ `commercialInfo=AWAITING_APPROVAL`.
  Mapeamento: qualquer `REJECTED` → `recusado`; `general=APPROVED` → `aprovado`;
  algum `AWAITING_APPROVAL` → `em_analise`; senão `pendente`.
  `COMMERCIAL_INFO_EXPIRED` vira alerta mesmo com `general=APPROVED`.

### 4.2 Cobrança da sessão

**Quem cria a cobrança:** a conta **raiz**, com `split` para a `walletId` do
psicólogo. O saldo que não vai para o split fica na raiz (documentado). É o
mesmo modelo de hoje na Pagar.me (order da plataforma com split).

```
gerarCobrancaPix / gerarCobrancaCartao
  1. customer: GET /v3/customers?cpfCnpj=  → senão POST /v3/customers
     (name, cpfCnpj, email, mobilePhone, externalReference=paciente_id,
      notificationDisabled=true — quem avisa é o WhatsApp da Audere)
     cache em pacientes.dados_cadastro->'asaas_customer_id'
  2. POST /v3/payments   (SEM split)
       customer, billingType PIX | CREDIT_CARD, value, dueDate,
       externalReference = sessao_id, description
       [crédito parcelado: installmentCount + totalValue — D-03]
     ◄── netValue já vem na resposta (no parcelado: Σ netValue das parcelas)
  3. split (D-01):
       à vista:   PUT /v3/payments/{id}  { split: [{ walletId, fixedValue: netValue − taxaAdm }] }
       parcelado: PUT /v3/installments/{installment}/splits
                  { splits: [{ walletId, totalFixedValue: Σ netValue − taxaAdm }] }
  4. PIX: GET /v3/payments/{id}/pixQrCode → payload (copia e cola) + encodedImage
     CRÉDITO: invoiceUrl
  5. grava gateway='asaas', cobranca_id, cobranca_parcelamento_id, cobranca_qrcode,
     cobranca_url, cobranca_vence_em, comissao_centavos
```

- **Split sobre o líquido.** No Asaas `percentualValue` e o teto do split são
  sobre o `netValue` (valor − tarifa do Asaas). Para a plataforma ficar com
  **exatamente 2,5% do bruto** e o psicólogo absorver a tarifa (regra atual):
  `fixedValue_psicologo = netValue − taxaAdm`. **D-01 fechado em (a)** **[spike ✅]**:
  o `netValue` já vem na resposta da criação; o split vai por
  `PUT /v3/payments/{id}` (o `PUT /v3/lean/payments/{id}` responde 200 mas não
  devolve o split — não usar). Sessão de R$ 10 no PIX: raiz **+R$ 0,25**,
  psicólogo **+R$ 8,76**, exatos. No parcelado (3× R$ 100): sobra da raiz
  **R$ 7,50**, exata. A cobrança só é enviada ao paciente depois do split gravado;
  se o `PUT` falhar, cair para (b) — split na criação com a tarifa de
  `GET /v3/myAccount/fees` (também bateu no spike, mas depende da promoção da
  conta, que expira em 05/01/2027).
- **Split para subconta ainda não aprovada** é aceito e liquidado no sandbox
  (`split.status=DONE`, saldo creditado na subconta) **[spike ✅]**. Só o saque
  depende da aprovação → RN-06 passa a ser "split assim que houver `walletId`"
  (confirmar no piloto em produção).
- **Divergência:** se o split passar do líquido no recebimento, o Asaas bloqueia
  (`PAYMENT_SPLIT_DIVERGENCE_BLOCK`, 2 dias úteis para corrigir). Alerta no admin.
- **Psicólogo não apto** (sem `recebedor_wallet_id`, ou subconta `recusado`):
  cobrança sem split + alerta (RF-PG-24). Situação `pendente`/`em_analise` **não**
  bloqueia o split (RN-06 revisada).
- **PIX:** a conta raiz precisa de **chave PIX cadastrada**; sem ela o QR é
  "transitório" e expira às 23:59 do dia (descontinuado pelo Asaas). Com chave,
  o QR vale até 12 meses após o vencimento (sandbox: `expirationDate` = vencimento
  + 1 ano **[spike ✅]**) → a expiração de 30 min da regra de negócio passa a ser
  **nossa** (cron cancela `DELETE /v3/payments/{id}` das cobranças vencidas pela
  regra, D-05).
- **Crédito:** fatura hospedada (`invoiceUrl`), sem dado de cartão na Audere.
  Parcelamento **D-03 → opção (1)**: o WhatsApp pergunta "em quantas vezes (1 a
  6)?" e a cobrança nasce com `installmentCount`. O link de pagamento aceita o
  campo `split` mas **o descarta** (não volta na resposta nem no `GET`, e o link pago em 6x gerou
  parcelas sem split) **[spike ✅]**. Pagar a 1ª parcela
  confirma todas (`PAYMENT_CONFIRMED` por parcela); o split fica
  `AWAITING_CREDIT` até o crédito (~32 dias).
- **Débito:** removido (não existe na criação de cobrança). `inbox.ts`, os textos
  de `evolution.ts` e os templates Meta `audere_*` mudam (novos templates exigem
  nova aprovação da Meta).
- `notificationDisabled=true` no customer evita que o Asaas mande e-mail/SMS
  próprio ao paciente (o canal é o WhatsApp) **[spike ✅]**. Confirmado no painel
  (a cobrança não tem envio ativo); `GET /customers/{id}/notifications` continua
  listando tudo como ativo e **não serve** de verificação. Reforço opcional:
  `PUT /v3/notifications/batch` com tudo `false` na criação do customer.

### 4.3 Webhook `/api/webhooks/asaas`

```
POST /api/webhooks/asaas
  1. header asaas-access-token == ASAAS_WEBHOOK_TOKEN (timing-safe) senão 401
     (produção sem token configurado → 503, como hoje)
  2. INSERT webhook_eventos (gateway='asaas', evento_id=payload.id) ON CONFLICT DO NOTHING
     já existia e processado → 200
  3. normalizarEvento → processa → processado_em = NOW()  (erro → grava erro, 500 p/ retry)
```

| Evento Asaas | Evento neutro | Efeito |
|---|---|---|
| `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED` | `cobranca.paga` | `marcarPagamentoConfirmado` (idempotente; o 1º que chegar confirma). `taxa_gateway_centavos = value − netValue`. |
| `PAYMENT_OVERDUE`, `PAYMENT_DELETED` | `cobranca.vencida/cancelada` | `falhou` **só se** `pagamento_status <> 'pago'` |
| `PAYMENT_REPROVED_BY_RISK_ANALYSIS`, `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED` | `cobranca.falhou` | idem |
| `PAYMENT_REFUNDED`, `PAYMENT_PARTIALLY_REFUNDED` | `cobranca.reembolsada` | `reembolsado` / parcial |
| `PAYMENT_CHARGEBACK_REQUESTED`, `_DISPUTE` | `cobranca.contestada` | `contestado` + alerta |
| `PAYMENT_SPLIT_DIVERGENCE_BLOCK` | — | alerta admin |
| pagamento com `subscription` preenchido | `assinatura.paga/falhou` | `aplicarEventoAssinatura` |
| `SUBSCRIPTION_INACTIVATED`, `SUBSCRIPTION_DELETED` | `assinatura.cancelada` | `cancelado` |
| `ACCOUNT_STATUS_*` | `recebedor.situacao` | atualiza `recebedor_situacao*` |

- Confirmar no **primeiro** de `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED`: no cartão o
  `RECEIVED` só vem ~32 dias depois; no **PIX vem só `RECEIVED`** (sem
  `CONFIRMED`) **[spike ✅]**. Em PIX de conta PF o `CONFIRMED` pode ser
  provisório (retenção de até 72 h) — a conta raiz é PJ, então não se aplica.
- **`payload.id`** = `evt_<32 hex>&<número>`; o hex se repete para todo evento do
  mesmo tipo, o número é que distingue → `evento_id` é a **string inteira**
  (nunca cortar no `&`) **[spike ✅]**.
- Entrega "at least once": com 500, o mesmo evento voltou em ~32 s com o **mesmo
  `id`** **[spike ✅]**; 15 falhas seguidas pausam a fila (eventos guardados 14
  dias, reenvio manual pelo painel › Logs de Webhooks; sem API). Responder rápido
  e processar de forma idempotente. `sendType: SEQUENTIALLY` — mas a **ordem não é
  garantida** entre recursos (`SUBSCRIPTION_CREATED` chegou depois do
  `PAYMENT_CONFIRMED` da mesma assinatura): nenhum handler pode depender de um
  evento anterior ter chegado.
- O payload traz `account { id, ownerId }` + o objeto completo (`payment` com
  `value`, `netValue`, `status`, `externalReference`, `subscription`,
  `installment`), então `taxa_gateway_centavos` sai do próprio evento.
- Webhook da conta raiz criado por `POST /v3/webhooks` (script `npm run
  asaas:webhook`); o das subcontas vai no `webhooks` do `POST /v3/accounts`.
- O webhook da Pagar.me continua no ar (RF-PG-03) e passa a usar a mesma tabela
  `webhook_eventos` e a mesma regra "não sobrescrever `pago`".

### 4.4 Reembolso

Resultado do spike **[spike ✅]**:

- **Sempre** `POST /v3/payments/{id}/refund { value, splitRefunds: [{ id: split.id, value }] }`.
  Sem `splitRefunds` o rateio automático tira **só da parte da raiz** e o parcial
  falha (`"Valor da cobrança insuficiente…"`). Regra Audere: o psicólogo devolve
  proporcionalmente; no total, `splitRefunds` = valor inteiro do split.
- **Saldo na raiz ≥ valor bruto do estorno**, mesmo quando quase tudo volta da
  subconta (R$ 9,50 recusado com raiz em R$ 7,52; R$ 7,40 aceito). Sem saldo → 400
  (não entra em fila) → D-08.
- Logo após o recebimento pode vir `400 "Tente novamente em alguns instantes"` →
  retentativa com espera (cron `reembolso_pendente`).
- Estorno PIX aceito fica **`AWAITING_CRITICAL_ACTION_AUTHORIZATION`**: o saldo
  sai na hora (raiz e subconta), mas o dinheiro só volta ao paciente — e
  `PAYMENT_REFUNDED` só chega — depois de alguém autorizar o evento crítico no
  painel (token/SMS) → D-09. **Implementado:** `solicitado` grava `reembolsado`
  (o saldo já saiu) com aviso no log; sem saldo/"tente novamente" mantém `pago`
  e marca `reembolso_pendente_em` + `reembolso_motivo` para o cron (Fase 3).
  Não criamos status novos — o Financeiro e os filtros continuam valendo.
- **Cartão parcelado:** `POST /v3/installments/{id}/refund` → todas as parcelas
  `REFUNDED`, split `CANCELLED`, `PAYMENT_REFUNDED` por parcela, sem depender de
  saldo nem de autorização (antes do crédito).

Corrige o defeito 1 também para a Pagar.me (`DELETE /charges/{charge_id}` no
adaptador `pagarme`).

### 4.5 Assinatura do plano

Recomendado (D-04): **sem tokenização na Audere**.

```
assinar(plano, ciclo)
  1. customer do psicólogo (cpfCnpj = pgm_documento | cpf)
  2. POST /v3/subscriptions
       billingType CREDIT_CARD, value, cycle MONTHLY|YEARLY, nextDueDate=hoje,
       description, externalReference = psicologo_id
     (sem creditCard/creditCardToken)
  3. GET das cobranças da assinatura → invoiceUrl da 1ª → redireciona o psicólogo
  4. webhook da 1ª cobrança paga → plano ativo; o Asaas guarda o cartão para as
     renovações
```

- Spike: assinatura `CREDIT_CARD` sem cartão → 200 `ACTIVE`, 1ª cobrança com
  `invoiceUrl` na hora. Paga a 1ª (via API), a assinatura passa a ter `creditCard`
  (final, bandeira, token) e a cobrança seguinte **já nasce com o cartão** — igual
  com a 1ª paga **pela fatura** (página do Asaas) **[spike ✅]**. Falta ver a
  renovação debitada sozinha **[spike ⏳]** (spike.md §10, P3).

- Alternativa (se o item acima não se confirmar): tokenizar via
  `POST /v3/creditCard/tokenizeCreditCard` **no servidor** (o Asaas não tem
  tokenização no navegador documentada) → o número do cartão passa pela Audere
  (escopo PCI maior) e exige habilitação do Asaas em produção. Evitar.
- Cancelamento: `DELETE /v3/subscriptions/{id}`.
- **Troca de plano** (RF-PG-42, `src/server/lib/trocaPlano.ts`, migration 054):
  ```
  calcularTroca(atual, novo, expiraEm)            // puro, testado
    subir  → plano novo agora; acréscimo = Δpreço(ciclo atual) × fração restante
    descer / trocar ciclo → plano atual até a renovação; destino em plano_agendado*
  atualizarAssinaturaAsaas(sub, destino, acréscimo)
    1. PUT /subscriptions/{id} { value, cycle, updatePendingPayments: false }
    2. cobrança PENDING mais próxima: PUT /payments/{id}
         value = preço do destino + acréscimos já somados nela + acréscimo
       (sem cobrança gerada ainda → fatura avulsa da diferença)
    3. devolve o vencimento dessa cobrança → plano_agendado_vigencia
  webhook assinatura.paga com vencimento >= vigência → aplica plano_agendado
  ```
  O `PAYMENT_RECEIVED` do cartão chega ~30 dias após o `CONFIRMED`; o de um
  ciclo anterior não pode antecipar a troca — daí a vigência por vencimento.
- **Fatura em aberto:** `assinar()` no mesmo plano com status `inadimplente`
  devolve a fatura PENDING/OVERDUE existente; `/planos` e o banner chamam
  `faturaEmAberto` ("Pagar fatura").
- **Data de renovação:** o webhook da cobrança paga grava `plano_expira_em` =
  vencimento da próxima cobrança PENDING (fallback: `nextDueDate`, que pula de
  ciclo quando a próxima cobrança é gerada).
- Assinaturas Pagar.me existentes: seguem no adaptador `pagarme` até cancelar ou
  trocar de plano (RF-PG-44). `NEXT_PUBLIC_PAGARME_PUBLIC_KEY` continua no build
  até não haver mais checkout Pagar.me.
- `/planos` deixa de ter formulário de cartão próprio quando o gateway padrão é
  Asaas: botão "Assinar" → fatura do Asaas → volta para `/planos?ok=1`.

### 4.5b WhatsApp — crédito parcelado (D-03, migration 055)

```
paciente: CREDITO           → wa_parcelas_perguntado_em = now; pergunta 1–6 (com o valor de cada)
paciente: "3" | "3x" | ...  → tratarRespostaParcelas: sessão com a pergunta < 24h e não paga
                              → gerarCobrancaCartao(sessão, 'credito', 3) → installmentCount + split
paciente: CREDITO 3         → direto (número na mesma mensagem)
paciente: DEBITO            → "não aceitamos débito" (Asaas não tem débito online)
```

Templates Meta do modo Asaas: `audere_sessao_metodo_v2` (botões PIX/CREDITO) e
`audere_checkout_v2` (sem "expira em 2h"; já com o parcelamento). As `_v1`
continuam valendo para a Pagar.me (template aprovado é imutável). A pergunta
de parcelas é texto livre (janela de 24h aberta pela resposta do paciente).

Taxa do gateway no parcelado: cada webhook é de uma parcela; as parcelas do
Asaas têm valor e taxa iguais → taxa total = taxa da parcela × nº de parcelas,
gravada no 1º evento.

### 4.6 Modo mock

Sem `ASAAS_API_KEY` configurada (mesmo critério `isConfigured` de `env.ts`), o
adaptador devolve ids `mock_asaas_*` e URLs de `/mock/...` — a rota de mock já
existe. Os prefixos `mock_` continuam sendo o único sinal de mock.

## 5. Configuração

| Env | Uso |
|---|---|
| `PAYMENT_GATEWAY` | `pagarme` (padrão até a virada) \| `asaas` |
| `ASAAS_API_URL` | `https://api-sandbox.asaas.com/v3` ou `https://api.asaas.com/v3` |
| `ASAAS_API_KEY` | chave da conta raiz (secret do cluster, nunca no build) |
| `ASAAS_WEBHOOK_TOKEN` | 32–255 caracteres, gerado por nós; **não** é a API key |

Nada de `NEXT_PUBLIC_*` para o Asaas (sem tokenização no navegador).
Atualizar `.env.example`, `k8s/aurencare-secrets.example.yaml`, `env.ts`
(`integrationStatus.asaas`) e `docs/INFRA.md`.

## 6. Segurança e LGPD

- `recebedor_api_key` cifrada com `ENCRYPTION_KEY` (AES-256-GCM, `crypto.ts`);
  só o servidor decifra, só para `GET /v3/myAccount/status` da própria subconta.
- Webhook: token comparado em tempo constante; fail-closed em produção.
- `webhook_eventos.payload` sem número de cartão; CPF mascarado.
- Termos de uso e `/privacidade` passam a citar o Asaas como operador de
  pagamento (hoje citam a Pagar.me).
- Remover do cluster/`.env.local` as chaves Pagar.me que sobrarem quando a Fase 4
  terminar; rotacionar as que estão em texto no `.env.local`.

## 7. Decisões

| # | Decisão | Opções | Situação |
|---|---|---|---|
| D-01 | Como garantir 2,5% exatos do bruto com split sobre o líquido | (a) criar → ler `netValue` → `PUT` split; (b) tarifa da tabela da conta | ✅ **fechada: (a)** via `PUT /v3/payments/{id}` (parcelado: `PUT /v3/installments/{id}/splits`); (b) como fallback. Exato no spike (R$ 0,25 de R$ 10; R$ 7,50 de 3× R$ 100) |
| D-02 | Quem cria a cobrança | conta raiz com split p/ psicólogo; subconta (apiKey dela) com split p/ raiz | ✅ **raiz** (documentado; usado em todo o spike) |
| D-03 | Parcelas no crédito | (1) WhatsApp pergunta "em quantas vezes?" e cria `installmentCount`; (2) Link de pagamento com até 6x à escolha do pagador; (3) só à vista | ✅ **fechada: (1)**. O link descarta o `split` sem erro (pago em 6x: parcelas sem split); o parcelado pela API dá split exato. Migration 053 ganha `cobranca_parcelamento_id`; o fluxo do WhatsApp ganha uma pergunta (template Meta novo) |
| D-04 | Cartão da assinatura | fatura do Asaas (sem cartão na Audere); tokenização no servidor | ✅ **fatura** — assinatura sem cartão aceita; paga pela página, guarda o cartão e a próxima cobrança já nasce com ele; ⏳ só a renovação debitada em 05/11 |
| D-05 | Validade do PIX | manter 30 min (cron cancela) ; vencer só na data da sessão | **30 min** (QR do Asaas vale 1 ano: a regra é nossa) |
| D-06 | Onboarding | sem BaaS (e-mail do Asaas); BaaS (link/API dentro da Audere) | **sem BaaS** agora; BaaS depois com gerente de contas |
| D-07 | Coexistência | coluna `gateway` por registro | sim (RF-PG-02) |
| D-08 | Saldo para estornos PIX (o Asaas exige saldo na raiz ≥ valor do estorno) | (a) manter **reserva** fixa na raiz (ex.: maior valor de sessão × N) e não sacar abaixo dela; (b) estorno vira `reembolso_pendente` e o cron tenta quando houver saldo; (c) só (b) | **(a) + (b)**: reserva + fila; alerta no admin quando o saldo da raiz < reserva. **Confirmado pelo Asaas (05/11): igual em produção.** Com `splitRefunds` (já enviado) a parte da subconta sai dela; a raiz só precisa cobrir a parte dela |
| D-09 | Autorização de evento crítico nos estornos PIX via API | (a) autorizar manualmente no painel (token/SMS); (b) configuração do Asaas que dispense (whitelist de IP / ajuste de segurança) | **(b) whitelist de IP** — resposta do Asaas (05/11): não há endpoint para o token, nem autorização em lote, nem webhook de evento crítico; com a trava de IP as chamadas dos IPs homologados dispensam o SMS/token. Até configurar, (a) |
| D-10 | Troca de plano no Asaas | (a) cancelar + criar (como na Pagar.me); (b) PUT na assinatura | ✅ **(b)**: subir na hora com a diferença proporcional na próxima fatura; descer/trocar ciclo na renovação (migration 054). Decidido pelo usuário em 04/11/2026 |
| RN-06 | Quando o psicólogo entra no split | situação geral aprovada; ou assim que existir `walletId` | **`walletId`** (split para subconta pendente foi aceito e liquidado no sandbox); confirmar no piloto |

## 8. Testes

- Unitários: `split.ts` (arredondamento, soma = valor), mapeamento de situação
  cadastral, `normalizarEvento` para cada evento da tabela §4.3, regra "não
  sobrescrever `pago`".
- Integração no sandbox (`npm run test:asaas`): subconta PF e PJ, aprovação pelo
  endpoint de sandbox, PIX pago pelo "confirmar pagamento" do sandbox, cartão de
  teste à vista e parcelado, estorno total/parcial, assinatura, reenvio do mesmo
  webhook.
- Banco real (`npm run test:pagamentos-db`, Postgres em docker na 55433):
  wizard nos dois gateways, `assinar`, manutenção (cron), regra pura da troca
  de plano e o fluxo assinar → agendar → webhook (inclui o RECEIVED atrasado).
- E2E pelo Chrome (04 e 05/11/2026): onboarding PF e PJ, PIX com split,
  crédito 3x pelo WhatsApp, estorno do parcelado, assinatura, troca de plano,
  recusa → "Pagar fatura". Resultado em `tasks.md`.
- Produção (spec §8): checklist manual com valores mínimos.

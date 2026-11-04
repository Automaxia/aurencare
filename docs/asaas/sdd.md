# sdd.md — Design técnico: gateway Asaas · Audere

> Requisitos em [spec.md](./spec.md); execução em [tasks.md](./tasks.md).
> Arquitetura geral em [../sdd.md](../sdd.md). Criado em 04/11/2026.
>
> Fontes: código em 04/11/2026 e documentação oficial do Asaas
> (docs.asaas.com, lida em 04/11/2026). Itens marcados **[validar]** não estão
> confirmados na documentação e precisam de teste no sandbox (tasks.md, Fase 0).

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
  pagarme/          ← adaptador: move pagarme.ts, pagarmeRecipient.ts, pagarmeSubscription.ts
  asaas/
    cliente.ts      ← fetch com access_token, timeout, retry seguro, erros tipados
    recebedor.ts    ← subconta (POST /v3/accounts) e situação cadastral
    cobranca.ts     ← customer, payment, pixQrCode, refund
    assinatura.ts   ← subscription
    webhook.ts      ← autenticação + normalização de eventos
    erros.ts        ← tradução de erros para campos do wizard
    mock.ts         ← respostas mock (sem chave)
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
  cancelarAssinatura(assinaturaId: string): Promise<boolean>

  // Webhook
  autenticarWebhook(req: Request, corpoBruto: string): boolean
  normalizarEvento(payload: unknown): EventoPagamento | null
}

type EventoPagamento =
  | { tipo: 'cobranca.paga'; eventoId: string; cobrancaId: string; liquidoCentavos?: number }
  | { tipo: 'cobranca.falhou' | 'cobranca.vencida' | 'cobranca.cancelada'; eventoId: string; cobrancaId: string }
  | { tipo: 'cobranca.reembolsada'; eventoId: string; cobrancaId: string; valorCentavos: number; parcial: boolean }
  | { tipo: 'cobranca.contestada'; eventoId: string; cobrancaId: string }
  | { tipo: 'assinatura.paga' | 'assinatura.falhou' | 'assinatura.cancelada'; eventoId: string; assinaturaId: string; cicloFim?: string }
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
- `cobranca_id` precisa ser o identificador usado no estorno. No Asaas é o
  `pay_...` (da 1ª parcela, no parcelado). Se D-03 resultar em parcelamento,
  acrescentar `cobranca_parcelamento_id` (id do `installment`) na mesma migration.
- Todo `obterAssinatura`, Admin (MRR, cortesia) e `sqlTemCobrancaAberta` passam a
  ler `assinatura_id` / `cobranca_id`. A cortesia continua sendo "plano ≠ free e
  sem `assinatura_id`" (migration 047 usa o mesmo critério).

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
- `apiKey` só vem uma vez: se a gravação falhar depois do `POST`, registrar o
  `id` em log de erro e o admin recupera (gera nova chave pelo endpoint de chaves
  da subconta) **[validar]**.
- Idempotência: antes de criar, `GET /v3/accounts?cpfCnpj=` **[validar filtro]**
  para não duplicar subconta em retry.
- Situação: webhook `ACCOUNT_STATUS_*` (por dimensão) + consulta
  `GET /v3/myAccount/status` com a `apiKey` da subconta (reconciliação no cron).
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
  2. POST /v3/payments
       customer, billingType PIX | CREDIT_CARD, value, dueDate,
       externalReference = sessao_id, description,
       split: [{ walletId: psicologo, fixedValue: ? }]   ← ver D-01
  3. PIX: GET /v3/payments/{id}/pixQrCode → payload (copia e cola) + encodedImage
     CRÉDITO: invoiceUrl
  4. grava gateway='asaas', cobranca_id, cobranca_qrcode, cobranca_url,
     cobranca_vence_em, comissao_centavos
```

- **Split sobre o líquido.** No Asaas `percentualValue` e o teto do split são
  sobre o `netValue` (valor − tarifa do Asaas). Para a plataforma ficar com
  **exatamente 2,5% do bruto** e o psicólogo absorver a tarifa (regra atual):
  `fixedValue_psicologo = netValue − taxaAdm`. Como `netValue` só é conhecido
  depois de criar, a decisão D-01 escolhe entre:
  - (a) criar sem split, ler `netValue`, e `PUT /v3/lean/payments/{id}` com o split
    (documentado); ou
  - (b) calcular a tarifa pela tabela da conta (`GET` "Recuperar taxas da conta")
    e mandar o split já na criação.
  **Recomendado: (a)**, com fallback para (b) se o PUT falhar — a cobrança só é
  enviada ao paciente depois do split gravado.
- **Divergência:** se o split passar do líquido no recebimento, o Asaas bloqueia
  (`PAYMENT_SPLIT_DIVERGENCE_BLOCK`, 2 dias úteis para corrigir). Alerta no admin.
- **Psicólogo não apto** (sem `recebedor_wallet_id` ou situação ≠ apta):
  cobrança sem split + alerta (RF-PG-24).
- **PIX:** a conta raiz precisa de **chave PIX cadastrada**; sem ela o QR é
  "transitório" e expira às 23:59 do dia (descontinuado pelo Asaas). Com chave,
  o QR vale até 12 meses após o vencimento → a expiração de 30 min da regra de
  negócio passa a ser **nossa** (cron cancela `DELETE /v3/payments/{id}` das
  cobranças vencidas pela regra, D-05).
- **Crédito:** fatura hospedada (`invoiceUrl`), sem dado de cartão na Audere.
  Parcelamento: D-03.
- **Débito:** removido (não existe na criação de cobrança). `inbox.ts`, os textos
  de `evolution.ts` e os templates Meta `audere_*` mudam (novos templates exigem
  nova aprovação da Meta).
- `notificationDisabled=true` no customer evita que o Asaas mande e-mail/SMS
  próprio ao paciente (o canal é o WhatsApp) **[validar efeito em cobranças]**.

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

- Confirmar em `PAYMENT_CONFIRMED` (não esperar `RECEIVED`): no cartão o
  `RECEIVED` só vem ~32 dias depois. Em PIX de conta PF o `CONFIRMED` pode ser
  provisório (retenção de até 72 h) — a conta raiz é PJ, então não se aplica.
- Entrega "at least once", até 15 falhas seguidas pausam a fila (eventos guardados
  14 dias): responder rápido e processar de forma idempotente. `sendType:
  SEQUENTIALLY`.
- Webhook da conta raiz criado por `POST /v3/webhooks` (script `npm run
  asaas:webhook`); o das subcontas vai no `webhooks` do `POST /v3/accounts`.
- O webhook da Pagar.me continua no ar (RF-PG-03) e passa a usar a mesma tabela
  `webhook_eventos` e a mesma regra "não sobrescrever `pago`".

### 4.4 Reembolso

`POST /v3/payments/{id}/refund` (sem `value` = total). O estorno de cobrança com
split **estorna os repasses** (documentado). Parcial: mandar `splitRefunds`
explícito para não depender do rateio automático **[validar]**. PIX pode falhar
com 400 se a conta não tiver saldo logo após o recebimento → marcar
`reembolso_pendente` e tentar no cron. Corrige o defeito 1 também para a Pagar.me
(`DELETE /charges/{charge_id}` no adaptador `pagarme`).

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
     renovações [validar: renovação automática quando o 1º pagamento é pela fatura]
```

- Alternativa (se o item acima não se confirmar): tokenizar via
  `POST /v3/creditCard/tokenizeCreditCard` **no servidor** (o Asaas não tem
  tokenização no navegador documentada) → o número do cartão passa pela Audere
  (escopo PCI maior) e exige habilitação do Asaas em produção. Evitar.
- Cancelamento: `DELETE /v3/subscriptions/{id}`. Troca de plano:
  `PUT /v3/subscriptions/{id}` (valor/ciclo valem para as próximas cobranças) em
  vez de cancelar e criar.
- Assinaturas Pagar.me existentes: seguem no adaptador `pagarme` até cancelar ou
  trocar de plano (RF-PG-44). `NEXT_PUBLIC_PAGARME_PUBLIC_KEY` continua no build
  até não haver mais checkout Pagar.me.
- `/planos` deixa de ter formulário de cartão próprio quando o gateway padrão é
  Asaas: botão "Assinar" → fatura do Asaas → volta para `/planos?ok=1`.

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

| # | Decisão | Opções | Recomendação |
|---|---|---|---|
| D-01 | Como garantir 2,5% exatos do bruto com split sobre o líquido | (a) criar → ler `netValue` → `PUT` split; (b) tarifa da tabela da conta | **(a)**, validar no sandbox |
| D-02 | Quem cria a cobrança | conta raiz com split p/ psicólogo; subconta (apiKey dela) com split p/ raiz | **raiz** (documentado; o outro não é) |
| D-03 | Parcelas no crédito | (1) WhatsApp pergunta "em quantas vezes?" e cria `installmentCount`; (2) Link de pagamento com até 6x à escolha do pagador; (3) só à vista | testar (2) no sandbox (split em link **[validar]**); senão (1) |
| D-04 | Cartão da assinatura | fatura do Asaas (sem cartão na Audere); tokenização no servidor | **fatura** |
| D-05 | Validade do PIX | manter 30 min (cron cancela) ; vencer só na data da sessão | **30 min**, mantém templates e regra atual |
| D-06 | Onboarding | sem BaaS (e-mail do Asaas); BaaS (link/API dentro da Audere) | **sem BaaS** agora; BaaS depois com gerente de contas |
| D-07 | Coexistência | coluna `gateway` por registro | sim (RF-PG-02) |

## 8. Testes

- Unitários: `split.ts` (arredondamento, soma = valor), mapeamento de situação
  cadastral, `normalizarEvento` para cada evento da tabela §4.3, regra "não
  sobrescrever `pago`".
- Integração no sandbox (`npm run test:asaas`): subconta PF e PJ, aprovação pelo
  endpoint de sandbox, PIX pago pelo "confirmar pagamento" do sandbox, cartão de
  teste à vista e parcelado, estorno total/parcial, assinatura, reenvio do mesmo
  webhook.
- Produção (spec §8): checklist manual com valores mínimos.

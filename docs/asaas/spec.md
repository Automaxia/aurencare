# spec.md — Migração de gateway para o Asaas · Audere

> Especificação funcional da troca (e coexistência) Pagar.me → Asaas.
> Design técnico em [sdd.md](./sdd.md); plano de execução em [tasks.md](./tasks.md).
> Produto geral em [../spec.md](../spec.md). Criado em 04/11/2026.

---

## 1. Contexto e motivação

- A conta live da Pagar.me **não cria recebedores** (`412 action_forbidden`) desde
  set/2026. Com isso o psicólogo não conclui o onboarding de recebimento, as
  sessões saem **sem split** e a taxa administrativa de 2,5% não é cobrada.
- Diagnóstico de 04/11/2026: a conta Automaxia na Pagar.me tem
  `business_model: null` e `marketplace.live.can_create_recipient/can_split: false`.
  A conta da Habilita, que funciona, está como `marketplace`. Só a Pagar.me muda
  isso, e o chamado está parado desde 23/10.
- Decisão: integrar o **Asaas** como gateway, atrás de uma camada de abstração,
  para não depender de novo de um único fornecedor.
- A conta Asaas da Automaxia já existe e é **PJ** (CNPJ 38.154.192/0001-63), em
  "Nível 1 – Cadastro incompleto" em 04/11/2026.

## 2. Objetivos

| # | Objetivo |
|---|----------|
| O1 | Psicólogo consegue concluir o onboarding de recebimento e receber o valor das sessões. |
| O2 | A plataforma recebe os 2,5% de cada sessão paga, separados automaticamente (split). |
| O3 | Paciente paga por PIX ou cartão de crédito pelo WhatsApp, sem instalar nada (P5). |
| O4 | Sessão só fica `confirmada` depois da confirmação do pagamento pelo gateway (P4). |
| O5 | Assinatura dos planos (Essencial/Pro) cobrada no cartão, com renovação automática. |
| O6 | Trocar de gateway no futuro é trocar um adaptador, não reescrever o produto. |

## 3. Fora de escopo

- Boleto (o Asaas suporta, mas o produto não usa).
- Antecipação de recebíveis.
- Emissão de NF pelo Asaas (continua o fluxo atual de NF).
- Migrar o histórico financeiro antigo para o Asaas: o histórico da Pagar.me fica
  onde está e continua legível no Financeiro.
- Modelo BaaS (onboarding 100% dentro da Audere). Fica como evolução (§7).

## 4. Atores

- **Psicólogo** — titular de uma **subconta Asaas**; recebe o valor das sessões.
- **Paciente** — paga a sessão pelo link/QR recebido no WhatsApp.
- **Plataforma (Automaxia)** — conta raiz Asaas; cria as cobranças, fica com a
  taxa administrativa e recebe as assinaturas.
- **Admin** — acompanha recebedores, cobranças e falhas em `/admin`.

## 5. Requisitos funcionais

### 5.1 Gateway e coexistência
- **RF-PG-01** O gateway ativo para **novas** operações é escolhido por
  configuração (`PAYMENT_GATEWAY=pagarme|asaas`), sem deploy de código diferente.
- **RF-PG-02** Cada cobrança, recebedor e assinatura registra **em qual gateway
  foi criado**. Eventos, reembolsos e consultas usam sempre o gateway de origem,
  mesmo depois da troca do padrão.
- **RF-PG-03** Cobranças e assinaturas abertas na Pagar.me continuam
  funcionando (webhook, reembolso, cancelamento) até se encerrarem.
- **RF-PG-04** Sem chave configurada, o gateway roda em **modo mock** (como hoje),
  para dev local e demonstração.

### 5.2 Onboarding de recebimento (psicólogo)
- **RF-PG-10** O wizard de recebimento coleta os dados exigidos pelo Asaas para
  criar a subconta: tipo de pessoa, CPF/CNPJ, nome/razão social, data de
  nascimento (PF) ou tipo de empresa (PJ), e-mail, celular, renda/faturamento
  mensal e endereço completo.
- **RF-PG-11** Ao concluir, a Audere cria a **subconta Asaas** do psicólogo e
  guarda o identificador da carteira (`walletId`).
- **RF-PG-12** O psicólogo é avisado de que vai receber um **e-mail do Asaas**
  para ativar a conta, enviar documentos e cadastrar a conta bancária de saque.
  A tela explica isso com a marca Asaas visível (exigência do Asaas).
- **RF-PG-13** A Audere acompanha a **situação cadastral** da subconta
  (documentos, dados comerciais, conta bancária, aprovação geral) e mostra no
  Perfil › Recebimentos: "Aguardando documentos", "Em análise", "Aprovada",
  "Recusada — veja o e-mail do Asaas".
- **RF-PG-14** Enquanto a subconta não está apta a receber split, as sessões do
  psicólogo seguem o comportamento atual de "recebimento não configurado".
- **RF-PG-15** Psicólogos com recebedor `mock_rcp_*` ou recebedor Pagar.me que
  nunca operou são convidados a refazer o onboarding no Asaas (banner + e-mail).
- **RF-PG-16** Dados enviados com erro voltam para o passo do campo recusado,
  com mensagem em português (equivalente ao `traduzirRecusa` atual).

### 5.3 Cobrança da sessão (paciente)
- **RF-PG-20** Ao agendar, o WhatsApp pergunta o método: **PIX** ou **CRÉDITO**.
  **Débito sai do produto**: o Asaas não cria cobrança online em cartão de débito.
- **RF-PG-21** **PIX:** o paciente recebe o QR/copia-e-cola e o link da fatura.
  A cobrança vence no horário-limite definido pela regra de negócio (§6).
- **RF-PG-22** **Crédito:** o paciente recebe o link da fatura hospedada no
  Asaas e paga em até **6x sem juros** para o paciente (decisão D-03 no SDD
  define como o número de parcelas é escolhido).
- **RF-PG-23** Toda cobrança de sessão com psicólogo apto sai **com split**:
  psicólogo recebe o valor menos a taxa administrativa; a plataforma fica com
  **2,5% do valor bruto**, exato, auditável e igual ao que aparece no Financeiro.
  A taxa do gateway é do psicólogo, como hoje.
- **RF-PG-24** Psicólogo sem subconta apta: a cobrança sai **sem split**
  (degradação com aviso ao admin), mantendo o comportamento atual.
- **RF-PG-25** Confirmação do pagamento (webhook) move a sessão para
  `confirmada`, avisa o painel (SSE) e confirma ao paciente por WhatsApp/e-mail.
- **RF-PG-26** "Reenviar cobrança" reaproveita a cobrança aberta ou gera uma nova
  se a anterior venceu.
- **RF-PG-27** O Financeiro mostra a **taxa real do gateway** (líquido informado
  pelo Asaas), não estimativa.

### 5.4 Cancelamento e reembolso
- **RF-PG-30** Cancelamento com mais de 24h de antecedência de sessão paga
  reembolsa o paciente **de fato** no gateway, inclusive o split.
- **RF-PG-31** Reembolso, estorno parcial e chargeback recebidos por webhook
  atualizam a sessão (`reembolsado`, `contestado`) e aparecem no Financeiro.
- **RF-PG-32** Um evento de cancelamento ou falha **nunca** sobrescreve uma
  sessão já `pago`.

### 5.5 Assinatura dos planos (psicólogo)
- **RF-PG-40** Novas assinaturas (Essencial/Pro, mensal/anual) são criadas no
  Asaas, no cartão de crédito, com renovação automática.
- **RF-PG-41** Os dados do cartão **não passam pelo servidor da Audere**
  (decisão D-04 no SDD).
- **RF-PG-42** Upgrade/downgrade/cancelamento mantêm as regras atuais
  (`assinatura.ts`): cancelamento mantém acesso até `plano_expira_em`.
- **RF-PG-43** Falha de renovação deixa o plano `inadimplente`; pagamento
  posterior reativa.
- **RF-PG-44** Assinaturas existentes na Pagar.me continuam lá até o assinante
  trocar de plano ou de cartão; aí migram para o Asaas.

### 5.6 Operação
- **RF-PG-50** Todo webhook é autenticado e **idempotente** (mesmo evento
  entregue duas vezes não tem efeito duplicado).
- **RF-PG-51** `/admin` lista subcontas por situação cadastral, cobranças sem
  split e eventos com falha de processamento.

## 6. Regras de negócio

| # | Regra |
|---|-------|
| RN-01 | Taxa administrativa = `round(valor × 2,5%)` em centavos (`planos.ts`), gravada em `sessoes.comissao_centavos` no ato da cobrança. |
| RN-02 | PIX: a cobrança vence na **data da sessão**; o QR some do fluxo do WhatsApp depois de 30 min sem pagamento (nova cobrança no "reenviar"). Texto do template segue a regra que valer (D-05). |
| RN-03 | Crédito: até 6 parcelas, sem juros para o paciente; a taxa de parcelamento é do psicólogo. |
| RN-04 | Reembolso automático só com mais de 24h de antecedência (regra atual, configurável). |
| RN-05 | Sessão gratuita (`isento`) não gera cobrança. |
| RN-06 | Psicólogo só entra no split quando a subconta está apta a receber (situação geral aprovada ou o Asaas aceitar split para ela — validar no sandbox). |

## 7. Restrições conhecidas do Asaas (docs oficiais, lidas em 04/11/2026)

- **Split precisa ser habilitado** na conta raiz em *Integrações › Segurança*
  (confirmação por SMS/token). Sem isso a API devolve `invalid_action`.
- **Período de avaliação** a partir da 1ª subconta em produção: até **10
  subcontas**, **R$ 2.000 por subconta** e **60 dias**. Estourou um limite,
  novas subcontas e cobranças ficam bloqueadas e assinaturas da subconta são
  canceladas. A homologação pode ser pedida **a qualquer momento** — pedir antes
  do lançamento.
- **Sem BaaS** (padrão), o titular ativa a subconta e envia documentos pela
  interface do Asaas, por e-mail. BaaS (onboarding por link/API dentro da
  Audere) exige alinhamento com o gerente de contas.
- A marca e os textos de responsabilidade do Asaas precisam aparecer nos pontos
  de contato com o cliente (playbook do Asaas — pedir).
- **Débito online não existe** na criação de cobrança/assinatura.
- A `apiKey` da subconta só é devolvida **uma vez**, na criação.
- Tokenização de cartão em produção depende de **habilitação** pelo Asaas.

## 8. Critérios de aceite (produção)

1. Um psicólogo real conclui o onboarding, recebe o e-mail do Asaas e a subconta
   chega a "Aprovada".
2. Uma sessão de R$ 10,00 paga por PIX: sessão `confirmada` em < 30 s, psicólogo
   recebe o valor − taxa do gateway − R$ 0,25 e a plataforma recebe R$ 0,25.
3. A mesma sessão cancelada com > 24h: paciente reembolsado, split estornado,
   sessão `reembolsado`.
4. Sessão paga no crédito em 3x: confirmada, split correto, Financeiro com a
   taxa real.
5. Assinatura Essencial mensal criada e cancelada; plano `cancelado` com acesso
   até o fim do ciclo.
6. O mesmo webhook reenviado não altera nada na segunda vez.
7. Uma cobrança antiga da Pagar.me ainda aberta é confirmada pelo webhook da
   Pagar.me depois da troca de gateway padrão.

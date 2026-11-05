# Perguntas ao Asaas (P5) — rascunho para enviar ao gerente de contas

> Preparado em 05/11/2026 a partir do spike e dos testes ponta a ponta no
> sandbox. Envie pelo canal do gerente de contas / suporte; as respostas
> fecham as decisões D-08 e D-09 (`docs/asaas/sdd.md` §7).

**Contexto (para o e-mail):** somos a Audere, plataforma para psicólogos. A
conta raiz cria as cobranças das sessões com **split** para a subconta do
psicólogo (criada por nós via `POST /v3/accounts`) e cobra assinaturas dos
planos. Usamos a API v3.

1. **Estorno de PIX e saldo da conta raiz.** No sandbox, `POST /payments/{id}/refund`
   de um PIX com split falha com "não há saldo suficiente" quando o saldo da
   raiz é menor que o valor do estorno — mesmo com a parte do psicólogo
   estando na subconta. Em produção é igual? O estorno debita só da raiz ou
   reverte o split da subconta? Existe forma de o estorno sair da subconta
   (a dona do valor)?

2. **Autorização de evento crítico via API.** Estornos PIX (e transferências)
   ficam em `AWAITING_CRITICAL_ACTION_AUTHORIZATION` e exigem token/SMS no
   painel. Existe configuração para dispensar essa autorização em chamadas
   da API — whitelist de IP, chave com permissão específica, ou outra? Se não
   houver, é possível autorizar em lote, ou há um webhook quando um evento
   crítico fica pendente?

3. **E-mail único por subconta.** O `POST /accounts` recusa um e-mail já usado
   em outra subconta. Quando o psicólogo muda de PF para PJ, abrimos a 2ª
   subconta com alias (`nome+audere2@dominio`). Isso é aceito em produção?
   Há forma recomendada de migrar a subconta PF para PJ, ou de encerrar a
   anterior?

4. **Período de avaliação / homologação.** O que precisa estar pronto para a
   conta sair do período de avaliação (criação de subcontas, split e
   assinaturas liberados em produção)? Prazo típico?

5. **Split habilitado em produção.** O split já vem habilitado na conta raiz
   em produção ou precisa ser solicitado? Há limite de subcontas criadas pela
   API?

6. **Renovação da assinatura no cartão salvo.** A cobrança recorrente de uma
   assinatura `CREDIT_CARD` cujo cartão foi salvo pelo pagamento da 1ª fatura
   (página do Asaas) é debitada automaticamente no vencimento? Em que horário
   do dia? Em caso de recusa, o Asaas tenta de novo (quantas vezes)?

7. **`nextDueDate` da assinatura.** Observamos que, gerada a próxima cobrança
   (PENDING), o `nextDueDate` passa a apontar para o ciclo seguinte. Esse é o
   comportamento esperado? Qual campo usar como "data da próxima cobrança"?

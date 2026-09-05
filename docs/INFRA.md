# INFRA.md — Pendências de infraestrutura · Audere

> **Fonte única.** O `INFRA.md` da raiz virou um ponteiro para este arquivo —
> as duas cópias haviam divergido (a da raiz tinha o TURN concluído, esta tinha
> o login com Google; nenhuma era superconjunto da outra).
>
> App: monolito Next.js, **1 pod** `aurencare-web` · namespace `aurencare` · secret
> `aurencare-secrets`. **Deploy automático no push para `main`** (GitHub Actions:
> build → migrate → rollout). As migrations rodam sozinhas na esteira.
>
> Marque `[x]` conforme concluir. Contexto técnico em [sdd.md](./sdd.md); backlog
> completo em [tasks.md](./tasks.md).

---

> ℹ️ **Estado do secret verificado em ago/2026** (`kubectl get secret
> aurencare-secrets -n aurencare`). Já definidos e reais: `ASSEMBLYAI_API_KEY`,
> `CRON_SECRET`, `EVOLUTION_WEBHOOK_TOKEN`, `OPENAI_API_KEY`, `ENCRYPTION_KEY`,
> `TURN_URLS`, `PAGARME_API_KEY`, `PAGARME_WEBHOOK_USER`/`_SECRET`.
> `PAGARME_API_KEY` virou a chave **live** em 04/09/2026, com
> `PAGARME_RECIPIENT_PLATAFORMA=re_cmq56ad0y1aq40l9taj8lovw6` e webhook live
> autenticado. Pendente: **split desabilitado na conta live** — ver §2.

## 🟢 1. Pagar.me fora do modo mock — ✅ RESOLVIDO (ago/2026)

`PAGARME_API_KEY` no cluster era o **placeholder literal** `sk_test_...` (11
chars), que está em `PLACEHOLDER_HINTS` → `integrationStatus.pagarme = false` →
**produção rodava em modo mock**: toda cobrança virava link `/mock/qr/…`, rota
que não existia (404 no paciente).

- [x] Chave de teste real aplicada no secret e pod reiniciado.
- [x] Rota `/mock/[...slug]` criada — se o modo mock voltar a acontecer, o link
      explica que é demonstração em vez de dar 404.
- [x] `PLACEHOLDER_HINTS` ampliada para pegar `sk_live_...`, `pk_live_...`, `<...>`.
- [x] `ASSEMBLYAI_API_KEY` definida — transcrição do paciente, fallback do tablet
      e multilíngue (PT/EN) destravados.
- [ ] **Rotacionar** a key da AssemblyAI (foi compartilhada em texto).

## 🟢 2. Confirmação de pagamento — ✅ RESOLVIDO (ago/2026)

O webhook estava quebrado por **três** causas somadas, não uma:

- [x] **URL apontava para domínio morto** — estava `aurencare.automaxia.com.br`
      (curl → 000). Corrigida para `https://app.audere.ia.br/api/webhooks/pagarme`.
- [x] **Mecanismo errado no código** — a Pagar.me v5 autentica webhook por
      **HTTP Basic Auth** (painel: "Habilitar autenticação" → Usuário + Senha),
      não por HMAC/X-Hub-Signature. Enquanto o código validava HMAC, NENHUM valor
      de secret poderia funcionar. Corrigido em `webhookAuth.ts`.
- [x] **Máximo de tentativas era 1** → agora 3. Com uma só, qualquer instabilidade
      perdia a confirmação do pagamento em definitivo.
- [x] Credenciais no cluster: `PAGARME_WEBHOOK_USER` + `PAGARME_WEBHOOK_SECRET`
      (a senha do painel).

Verificado em produção: sem credencial → **401**, credencial errada → **401**,
credencial correta → **200**. O ciclo do cartão fecha: paciente paga → `order.paid`
autenticado → sessão vira `confirmada` → SSE + WhatsApp + email.

> ⚠️ Ao criar o webhook do ambiente **live** no go-live, repetir os três pontos:
> URL correta, autenticação habilitada (Basic) e tentativas > 1.

- [x] **~~🔴 BLOQUEADO NA PAGAR.ME~~ — no SANDBOX não estava. Era formato de
      data. (27/08/2026)** ⚠️ Na conta **live** o split está mesmo desabilitado
      — ver o item 🔴 logo abaixo.

      O `POST /recipients` com a chave de teste do cluster cria recebedor
      normalmente — verificado criando um (`re_cmtbl0…`, status `active`).

      **De onde veio o diagnóstico errado.** O `action_forbidden` é real, mas
      vem de OUTRA chave — a `sk_test_49d8…` do `.env.local`, de uma conta
      diferente da `sk_test_BjNA…` que roda em produção. O teste de 18/08 foi
      feito contra a conta errada e a conclusão foi colada aqui.

      **O que de fato quebrava o onboarding**, os dois corrigidos:

      1. `birthdate`/`founding_date` iam em ISO (`1985-01-15`), o que o
         `<input type="date">` produz. Este endpoint exige **DD/MM/YYYY** e
         responde `412 invalid_parameter`. Outros endpoints da v5 aceitam ISO.
      2. `complementary` ausente quando o endereço não tem complemento →
         `422 The complementary field is required`, antes de qualquer outra
         validação.

      **E por que a tela mentia.** `traduzirRecusa` classificava **todo** 412
      como bloqueio de conta, então o erro de data virava "aguarde a liberação
      do nosso provedor de pagamentos" — mandando o psicólogo esperar por algo
      que não existia, em vez de mostrar o campo que ele podia corrigir. Agora
      o bloqueio exige a mensagem `action_forbidden`, não o status.

      **Lição:** confira QUAL chave está sendo testada antes de concluir que a
      conta está bloqueada — `kubectl get secret aurencare-secrets`, não o
      `.env.local`.

- [x] **Recebedor da plataforma criado** — `re_cmtbr3xe…` no sandbox, e na
      **live** já existia `re_cmq56ad0y1aq40l9taj8lovw6` (Automaxia, `active`,
      criado 08/06/2026), com repasse automático diário ligado em 04/09/2026.
      O script recusa duplicar recebedor do mesmo CNPJ.

- [ ] **🔴 SPLIT DESABILITADO NA CONTA LIVE — bloqueia a cobrança pela
      plataforma em produção. (04/09/2026)**

      **Por que apareceu agora:** `PAGARME_API_KEY` no cluster foi trocada da
      chave de teste para a **live** em 04/09/2026. Não é o split que "voltou a
      cair" — é outra conta. No sandbox ele continua habilitado.

      A Pagar.me é explícita, nas duas pontas:

      ```
      POST /recipients → 412 The account must have split settings enabled,
                             in order to create a recipient
      POST /orders     → 412 Split is disabled.        (order COM split)
      POST /orders     → 200                            (order SEM split)
      ```

      Ou seja: em produção dá para **cobrar**, mas não para **dividir** nem para
      criar recebedores. No sandbox o split funciona — foi lá que todo o fluxo
      PIX foi validado ponta a ponta.

      Não confunda com o item acima: aquele `action_forbidden` vinha de uma
      terceira chave (`sk_test_49d8…`, conta alheia) e era falso alarme. Este
      aqui é a conta de produção de verdade, com mensagem inequívoca.

      **Consequência hoje:** nenhum psicólogo consegue concluir o onboarding de
      recebimento em produção — dois tentaram sete vezes em 04/09 e viram erro.
      Todas as sessões nascem confirmadas com pagamento direto, combinado entre
      psicólogo e paciente. Nada quebra; a plataforma é que não intermedia.

      **Ação (não é código):** pedir à Pagar.me a habilitação de **split de
      pagamentos** na conta de produção (merchant `merch_D07OoPQSrH24qdnM`,
      CNPJ 38.154.192/0001-63), citando as duas mensagens de erro acima.

      Enquanto não vier, a alternativa seria cobrar SEM split — o valor cairia
      inteiro na conta da Automaxia e o repasse ao psicólogo seria manual. Isso
      exige mudar o gate que hoje só cobra quando o onboarding está completo, e
      é decisão de produto, não de infra.

      **Código:** `traduzirRecusa` reconhece as duas redações do bloqueio
      (`action_forbidden` e `split settings enabled`), então a tela mostra o
      aviso de liberação pendente e aponta o caminho de cobrar direto, em vez de
      despejar o erro em inglês da API no psicólogo.

      Para conferir qual chave está no cluster (nunca o `.env.local`):
      ```bash
      kubectl --insecure-skip-tls-verify --kubeconfig=kube_config.yaml         -n aurencare get secret aurencare-secrets         -o jsonpath='{.data.PAGARME_API_KEY}' | base64 -d | cut -c1-12
      ```
      `sk_test_` = sandbox; qualquer outro prefixo = produção.

      **Para checar se já liberaram, sem criar nada** — `POST /recipients` com
      CPF inválido. O gate do split roda ANTES da validação de campo (o CPF nem
      chega a ser avaliado), então a resposta é conclusiva e nenhum recebedor é
      criado, mesmo que o split tenha sido habilitado no meio tempo:
      ```bash
      K=$(kubectl -n aurencare get secret aurencare-secrets \
            -o jsonpath='{.data.PAGARME_API_KEY}' | base64 -d)
      curl -s -u "$K:" -H 'Content-Type: application/json' -X POST \
        https://api.pagar.me/core/v5/recipients \
        -d '{"register_information":{"type":"individual","email":"probe@example.invalid",
             "document":"11111111111","name":"Probe","birthdate":"01/01/1990",
             "monthly_income":100000,"professional_occupation":"Teste",
             "address":{"street":"Rua Teste","street_number":"1","complementary":"N/A",
             "neighborhood":"Centro","city":"Brasilia","state":"DF","zip_code":"70000000",
             "reference_point":"N/A"},"phone_numbers":[{"ddd":"61","number":"999999999",
             "type":"mobile"}]}}'
      ```
      Ainda bloqueado → volta o `412 ... split settings enabled`. Liberado →
      volta erro de campo (documento inválido), e o onboarding real destrava.
      Rodado em 05/09/2026: **ainda bloqueado**.

- [ ] **5 psicólogos com recebedor sintético — precisam refazer o onboarding.**
      Enquanto valia o placeholder da §1, o onboarding gravou `mock_rcp_*` em
      `psicologos.pagarme_recipient_id` (IDs que não existem na Pagar.me):
      LUIZ CARLOS DA SILVA FILHO · Daniel Versiani · Leila de Souza Silva
      Santana · LUCILEIDE MARIA CARDOSO COSTA · QA Ficticia.
      O código já os trata como "recebimento não configurado" e a aba
      **Perfil › Recebimentos** mostra o aviso pedindo para refazer — mas alguém
      precisa avisá-los. ⚠️ **Só depois do split sair**: enquanto o item acima
      valer, refazer o wizard bate no 412 e a frustração é garantida. Conferir depois:
      ```bash
      kubectl exec -n aurencare deploy/aurencare-web -- node -e "…SELECT nome, pagarme_recipient_id FROM psicologos WHERE pagarme_recipient_id LIKE 'mock_%'"
      ```

## 🟢 3. Confiabilidade do vídeo — servidor TURN (#11) — ✅ ATIVO
Chamadas atrás de NAT/4G agora têm relay TURN (antes só STUN).

- [x] **Código** — app lê TURN do cluster: `src/server/lib/turn.ts` (credenciais
      **efêmeras** HMAC, modo coturn `use-auth-secret`), rota pública `/api/ice`
      (liberada no middleware), `useWebRTC` busca de lá (fallback STUN-only).
- [x] **coturn no cluster** — `k8s/coturn.yaml` aplicado, pod Running no nó
      `84.247.138.18` (hostNetwork). Secret `coturn-auth` + `aurencare-secrets`
      com `TURN_STATIC_AUTH_SECRET`/`TURN_URLS`/`TURN_TTL`.
- [x] **DNS** — `turn.audere.ia.br` → `84.247.138.18` (resolve no 8.8.8.8/1.1.1.1).
- [x] **Firewall** — `3478/udp` e `3478/tcp` abertos + relay `49160-49200/udp`.
- [x] **Validado end-to-end** (jun/2026) — TURN Allocate real com credencial
      efêmera do `/api/ice`: `realm=audere.ia.br`, relay alocado em `:49165`.
      Auth HMAC OK, relay OK.
- [ ] *(Opcional)* `turns:` (TLS:5349) — só após montar cert válido em
      `/etc/coturn/certs` e descomentar `cert`/`pkey` no ConfigMap do `coturn.yaml`.
      Útil em redes que bloqueiam tudo menos 443/TLS; `3478 udp/tcp` cobre o resto.
- [ ] *(Opcional)* Espelhar `TURN_*` no `.env.local` — dev local roda STUN-only.

## 🟢 3b. PIX — validado direto na API (18/08/2026)

`POST /orders` com `payment_method: pix` e `customer.document` devolveu charge
`waiting_payment` **com `qr_code` e `qr_code_url`**. O "Modelo de negócio =
Simulator" está correto no sandbox. A `PAGARME_API_KEY` do cluster foi conferida:
`sk_test_` real (não placeholder), válida, e da **mesma conta** da chave local.

O que faltava no PIX não era a Pagar.me, e sim o **CPF do pagador**: só
**3 de 34 pacientes ativos** tinham CPF cadastrado. Corrigido no app — campo CPF
no cadastro do paciente, validação por dígito verificador e motivo acionável
quando a cobrança não sai.

## 🟡 4. Cobrança — **seguimos em SANDBOX durante o beta**

Hoje: `BETA_LIBERADO=true` (acesso liberado, sem cobrança) e chaves
`sk_test_`/`pk_test_`. Nenhuma cobrança é real — dá para exercitar o fluxo
inteiro sem risco. **A troca para `live` é um passo deliberado do go-live.**

Quando for ligar de verdade:

- [x] `PAGARME_API_KEY` → chave live no secret. **Feito em 04/09/2026.**
      ⚠️ A chave live desta conta **não** tem prefixo `sk_live_`, é `sk_<hash>`
      — só `sk_test_` é sandbox. Foi essa troca que expôs o split desabilitado
      da §2.
- [ ] `NEXT_PUBLIC_PAGARME_PUBLIC_KEY` → `pk_live` — ⚠️ **é build-time**: tem que
      entrar no **build da imagem** (`--build-arg` no `build-push.sh` ou env do
      job de build), **não** só no secret de runtime. Hoje vem do secret do
      **GitHub Actions** (`deploy.yml:65` → `Dockerfile:60`), não do cluster —
      logo, `kubectl` não mostra e não serve para conferir. Com a secreta já em
      live, confirmar que a pública também é `pk_live`: se ficou `pk_test`, a
      tokenização do cartão não fecha.
- [x] Recriar no ambiente live: webhook (URL + Basic Auth) — feito. Recipient da
      plataforma já existia no live (`re_cmq56ad0…`, §2).
- [ ] ⚠️ **Modelo de negócio do PIX**: em Configurações → Meios de pagamento, o
      sandbox usa **Simulator** e o live precisa de **PSP** (com credenciamento
      feito). Foi o "Simulator vs PSP" que manteve o PIX quebrado no teste.
- [ ] ⚠️ **Recipients são por ambiente**: os psicólogos que fizerem o onboarding
      de recebimento em sandbox terão de refazê-lo (ou ser migrados) no live.
      Pesar isso antes de abrir o beta para muita gente com KYC completo.
- [ ] No código: trocar `BETA_LIBERADO` para `false` em `src/server/lib/planos.ts`
      + redeploy.

## 🔒 5. Segurança / hardening
- [ ] Confirmar que `ENCRYPTION_KEY` e `NEXTAUTH_SECRET` são valores **reais e
      definitivos** (trocar `ENCRYPTION_KEY` depois torna dados clínicos ilegíveis).
- [x] `EVOLUTION_WEBHOOK_TOKEN` definido → validação do webhook da Evolution
      **ativa** (verificado no secret, ago/2026).
- [ ] Rotacionar credenciais já expostas no histórico: AssemblyAI (agora), Resend,
      e decidir sobre a Evolution API key (rotacionar = recriar instância → QR).
- [ ] **ZDR + DPA com a OpenAI** — ela é o provedor primário de IA, então dado
      clínico trafega para lá na maioria das chamadas. A promessa "zero data
      training" exibida na UI depende desse contrato.

## ⚙️ 6. Operação
- [ ] Migrar o cron in-process (node-cron) para **CronJob do k8s** (evita lembrete
      duplicado se subir mais de 1 pod). O `CRON_SECRET` já está na §2.

## 🔵 7. Login com Google (adiado — precisa de credenciais OAuth)
Recuperação de senha já está no ar. O login/cadastro com Google fica pra ligar
quando houver as credenciais (o dev faz o código; estas etapas são suas):

- [ ] No **Google Cloud Console** → APIs & Services → Credentials → criar
      **OAuth client ID** (tipo *Web application*).
- [ ] Authorized redirect URI: `https://app.audere.ia.br/api/auth/callback/google`
- [ ] Definir no secret e reiniciar:
  ```bash
  kubectl patch secret aurencare-secrets -n aurencare --type merge \
    -p '{"stringData":{"GOOGLE_CLIENT_ID":"<id>","GOOGLE_CLIENT_SECRET":"<secret>"}}'
  ```
- [ ] Confirmar `NEXTAUTH_URL=https://app.audere.ia.br` (o callback do Google usa essa base).
- [ ] Decisão já tomada: contas de mesmo email são **vinculadas** (Google = outra
      forma de entrar na conta existente).

---

## 🐞 Diagnóstico (não é config — precisa reproduzir)
- [ ] **#8 confirmação do paciente falhando:** reproduzir e enviar o log
  ```bash
  kubectl logs deploy/aurencare-web -n aurencare --tail=200 | grep confirmacao.action
  ```
- [ ] **Fallback de custo de IA:** se aparecer, a OpenAI está fora e o tier `fast`
      está rodando ~8× mais caro no Anthropic
  ```bash
  kubectl logs deploy/aurencare-web -n aurencare --tail=500 | grep "ALERTA CUSTO"
  ```

---

*Atualizado: ago/2026. Itens de código associados ficam com o time de dev.*

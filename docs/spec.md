# spec.md — Especificação do Produto · Audere

> Especificação funcional e de negócio. Para arquitetura técnica veja [sdd.md](./sdd.md);
> para acompanhamento de tarefas veja [tasks.md](./tasks.md).
> Última atualização: agosto 2026.
>
> **Nome:** o produto é **Audere** (marca, UI, copy). Os identificadores técnicos
> seguem `aurencare`/`auren` (domínio, banco, namespace k8s, imagem) — rename de
> infra é trabalho à parte.

---

## 1. Visão

**Audere — "Sistema Operacional da Prática Clínica".** Plataforma SaaS para
psicólogos clínicos privados que unifica agenda, pagamentos, comunicação por
WhatsApp, transcrição de sessão, análise longitudinal e inteligência clínica em
um único produto.

- **Público-alvo:** psicólogo(a) clínico(a), prática online ou híbrida, 15–30
  pacientes ativos.
- **Não é:** ERP, prontuário hospitalar, telemedicina genérica.
- **Estado:** em produção (https://app.audere.ia.br/), em **beta** —
  `BETA_LIBERADO = true`, acesso liberado e cobrança desligada.

## 2. Premissas inegociáveis

> **As 6 premissas canônicas (P1–P6) estão em CLAUDE.md §2** (IA nunca diagnostica;
> nota abre como rascunho; zero data training; pagamento confirma agendamento;
> paciente não instala nada; badge CFP visível). Toda RF abaixo as respeita.

Premissa adicional adotada neste produto:

| # | Premissa | Origem |
|---|----------|--------|
| P7 | **Análise é sobre o paciente.** A extração de temas/observações considera apenas as falas do paciente, nunca as do psicólogo. | Clínico |

## 3. Requisitos funcionais

### 3.1 Autenticação e conta
- RF-01 Login/logout do psicólogo (email + senha, bcrypt, sessão JWT 8h).
- RF-02 Cadastro público de psicólogo em `/cadastro` (5 campos) com auto-login.
- RF-03 Recuperação de senha por email (`/recuperar-senha`, `/redefinir-senha`).
- RF-04 Perfil: dados pessoais, abordagem clínica (TCC/humanista/psicanalítica/
  sistêmica — define a *lente* da extração de temas), perfil tributário.
- RF-05 **Papéis**: `psicologo` (default) e `admin`. Área `/admin` com gestão de
  psicólogos, custos de IA, leads e diagnóstico do WhatsApp.

### 3.2 Pacientes
- RF-10 Cadastrar paciente (nome, telefone, email) — dispara **WhatsApp + email**
  de boas-vindas com link de consentimento.
- RF-11 Listar pacientes com filtros, badge automático e arquivamento (soft delete).
- RF-12 Editar dados; exclusão definitiva só sem sessões registradas (CFP 06/2019).
- RF-13 Perfil clínico: condições, CID, medicações, alertas.
- RF-14 **Importar sessões anteriores** (transcrição em texto/PDF/DOCX) como
  histórico, para o paciente que já era atendido antes da Audere.
- RF-15 Paciente **demo** (fictício) para onboarding e teste.

### 3.3 Agenda e sessões
- RF-20 Agenda com visões dia/semana/mês, cores por status e tag de pagamento.
- RF-21 Nova sessão (avulsa ou série recorrente); remarcar "esta" ou
  "esta e as seguintes".
- RF-22 Ciclo de status: `agendada → aguardando_metodo → aguardando_pagamento →
  confirmada → em_curso → concluida` (+ `cancelada`/`no_show`/`interrompida`).
- RF-23 **Sessão interrompida** — começou e não aconteceu: descarta a transcrição
  parcial, não gera resumo, não avisa o paciente, devolve à agenda e **estorna a
  cota de sessão-IA**.
- RF-24 **Excluir sessão vazia** (concluída sem registro), fechando o buraco na
  numeração.
- RF-25 **Destravar sessões** presas em `em_curso` há +6h (aba fechada, queda,
  restart do pod): com registro → concluída; sem registro → interrompida.

### 3.4 Modo Presença (sessão ao vivo)
- RF-30 Interface fullscreen (sem sidebar/topbar), apenas `PresenceBar`.
- RF-31 **Transcrição dual:** psicólogo via mic local (Web Speech); paciente via
  áudio remoto do WebRTC (AssemblyAI streaming).
- RF-32 **Isolamento de falante:** o canal do paciente não pode conter a voz do
  psicólogo (cancelamento de eco + descarte de eco residual). (P7)
- RF-33 Widgets: ritmo da conversa, temas ao vivo, checagem de humor (F/I/D),
  avaliação de risco, contexto do paciente, nota rápida, observação ao vivo.
- RF-34 Marcação de turnos (insight / comportamento / avanço) e reatribuição
  manual de falante.
- RF-35 Vídeo P2P embutido (WebRTC) com sala pública para o paciente,
  reconexão automática e memória de câmera/microfone.
- RF-36 **Palco compartilhado** (web): o que o psicólogo mostra ao paciente
  durante a chamada — objetivos, **quadro branco** (Excalidraw, desenho ao vivo),
  **checagem de humor interativa** (o paciente responde) e **grafo de temas**.
  Cards móveis e redimensionáveis.
- RF-37 Pós-sessão: resumo IA (rascunho editável), assinatura, sugestões de
  marcação e risco, reagendamento.
- RF-38 **Laudo híbrido:** resumo curto automático (tier `fast`) + **laudo formal
  CFP sob demanda** (tier `strong`). O laudo é idempotente — não regera se já existe.

### 3.5 Inteligência clínica (IA)
- RF-40 **Temas Recorrentes:** grafo de construtos por paciente, extraído
  **apenas das falas do paciente** (P7), com chat de apoio. O store por sessão é
  a fonte da verdade; a recorrência é **contada**, não inferida pelo LLM.
- RF-41 **Evolução Registrada:** análise longitudinal + chat de apoio.
- RF-42 **Observação ao vivo:** gerada a cada N turnos do paciente durante a sessão.
- RF-43 Toda saída de IA passa por **guarda de termos proibidos** (P1) e abre como
  rascunho (P2); badge CFP sempre visível (P6).
- RF-44 **Objetivos e progresso:** objetivos terapêuticos, marcos do processo,
  escala GAS, notas e observações, com copiloto de sugestões.
- RF-45 **Conceitualização**: os objetivos ativos do paciente entram no prompt de
  extração de temas — **só promovem** relevância, nunca rebaixam (evita câmara de
  eco da hipótese do clínico).
- RF-46 **Rastreio de custo de IA:** toda chamada registra provedor, modelo,
  tokens reais, latência e atribuição (psicólogo/paciente/sessão/natureza).

### 3.6 Financeiro
- RF-50 Cobranças com filtros (período, status, método, NF).
- RF-51 Nota fiscal por sessão; exportação contábil/tributária (CSV/PDF).
- RF-52 Saúde da Prática: KPIs (sessões, pacientes ativos, valor médio por sessão,
  taxa de comparecimento 90d).
- RF-53 **Onboarding de recebimento**: cadastro PF/PJ com validação de CPF/CNPJ,
  dados bancários e criação do recipient na Pagar.me. Documentos e chave PIX
  cifrados em repouso.
- RF-54 Líquido exibido ao psicólogo desconta **taxa do adquirente + comissão da
  plataforma**; o bruto permanece intacto para fins de ISS/imposto.

### 3.7 Planos e assinatura
- RF-55 Planos: **Free** (3 sessões-IA/mês) · **Essencial** R$ 69,90 (30) ·
  **Pro** R$ 159,90 (80). O medidor é **sessão com IA**, não número de pacientes.
- RF-56 Assinatura via Pagar.me Subscriptions (cartão recorrente, tokenização no
  browser — o cartão nunca passa pelo servidor).
- RF-57 **Comissão de 2,5% por sessão paga**, adicional ao plano, cobrada no
  split da própria liquidação.
- RF-58 Gate de cota no Modo Presença. Durante o beta (`BETA_LIBERADO`), o gate
  não bloqueia e não há cobrança — validado **no servidor**, não só na UI.

### 3.8 WhatsApp (Evolution API)
- RF-60 Fluxo 1 — Cadastro/boas-vindas + consentimento.
- RF-61 Fluxo 2 — Agendamento + escolha de método (PIX/CRÉDITO/DÉBITO) + cobrança.
- RF-62 Fluxo 3 — Lembretes automáticos (24h, 2h e 15min).
- RF-63 Fluxo 4 — Parser de comandos recebidos.
- RF-64 Fluxo 5 — Cancelamento + reembolso (regra >24h / <24h).
- RF-65 Fluxo 6 — Pós-sessão.
- RF-66 Fluxo 7 — Confirmação pós-sessão (janela diurna/noturna; silêncio libera).
- RF-67 **Inbox conversacional** — conversa livre com o paciente, com resposta
  gerada e roteamento por telefone (blindado contra número duplicado em
  instância compartilhada). Inclui **áudio** (transcrição de voz recebida).

### 3.9 Pagamentos (Pagar.me)
- RF-70 PIX (QR, expira 30min), crédito (até 6x), débito.
- RF-71 **Split**: o líquido cai direto na conta do psicólogo; a comissão da
  plataforma e a taxa do adquirente saem na liquidação, sem acerto posterior.
- RF-72 Webhook confirma a sessão ao receber pagamento (P4) e aplica eventos de
  assinatura (renovação, falha, cancelamento).
- RF-73 Reembolso automático em cancelamento >24h.

### 3.10 Aquisição
- RF-80 Landing pública `/lancamento` com hero 3D e lista de espera.

### 3.11 Critérios de aceite (RFs críticos)

- **CA-10 (RF-10):** ao criar paciente com telefone e email válidos, são disparados
  1 WhatsApp **e** 1 email de boas-vindas, ambos com o link `/onboard/<token>`.
  Falha de um canal não impede a criação nem o outro canal.
- **CA-22 (RF-22 / P4):** a sessão só atinge `confirmada` após o webhook de pagamento
  correspondente; nunca por ação manual sem pagamento.
- **CA-32 (RF-32 / P7):** nenhuma fala do psicólogo aparece em turno `who='paciente'`.
- **CA-40 (RF-40 / P7):** o grafo de Temas e a extração persistida usam **apenas**
  texto do paciente (linhas `C:`).
- **CA-43 (RF-43 / P1):** toda saída de IA passa pelo guard; um resumo com termo
  proibido **não** pode ser assinado.
- **CA-37 (RF-37 / P2):** o resumo pós-sessão nasce rascunho e só vira prontuário
  após assinatura (com timestamp).
- **CA-63 (RF-63):** comandos `PIX`/`CREDITO`/`DEBITO`/`CONFIRMAR`/`CANCELAR`
  disparam a ação correta; texto não reconhecido cai no fallback.
- **CA-71 (RF-71):** as fatias do split somam **exatamente** o valor da order
  (invariante — divergência de 1 centavo é rejeitada pela Pagar.me).
- **CA-58 (RF-58):** com `BETA_LIBERADO`, `assinarAction` recusa no servidor,
  ainda que chamada diretamente.

## 4. Requisitos não-funcionais

- RNF-01 **Criptografia em repouso (AES-256-GCM)** para `transcricao_texto`,
  `nota_clinica`, `resumo_ia`, documentos e chave PIX do onboarding.
- RNF-02 **TLS** em trânsito (ingress + Cloudflare Full strict).
- RNF-03 Áudio bruto **descartado** após transcrição; nada persiste em disco.
- RNF-04 Consentimento LGPD com timestamp + trilha de auditoria.
- RNF-05 Disponibilidade: app stateless, 1 pod; banco e cache externos.
- RNF-06 Acessibilidade e responsividade nas telas do psicólogo.
- RNF-07 Internacionalização: pt-BR.
- RNF-08 **Custo de IA observável**: cada chamada rastreada em `api_custos` com
  atribuição; fallback de provedor gera alerta (nunca degrada em silêncio).

## 5. Regras de negócio críticas

- RN-01 Badge automático de paciente (Atenção / Espaçando / Nova / Registrar).
- RN-02 Validação de termos proibidos da IA **no backend** (não no frontend).
- RN-03 Sem assinatura, nota não vira prontuário.
- RN-04 Reembolso: >24h automático; <24h sem reembolso (configurável).
- RN-05 Sessão interrompida **estorna** a cota de sessão-IA.
- RN-06 Comissão da plataforma reduz o **líquido**, não o **bruto**: para
  ISS/imposto a receita do psicólogo é o valor cheio da sessão; a comissão é
  despesa dele.
- RN-07 Recálculo do grafo é **incremental**: sessão já extraída com o mesmo
  prompt e a mesma conceitualização é reaproveitada (0 chamadas de IA).

## 6. Escopo

### Implementado e em produção
Auth + recuperação de senha, papéis e área admin, dashboard, pacientes (incl.
importação de histórico), agenda (3 visões + série), Modo Presença completo
(transcrição dual, 9 widgets, vídeo WebRTC, palco compartilhado, quadro branco),
pós-sessão, laudo híbrido, sessão interrompida, Temas Recorrentes (grafo de
construtos), Evolução longitudinal, objetivos/marcos/GAS, financeiro + NF +
exportação contábil, Saúde da Prática, Evolution (7 fluxos + inbox + voz),
Pagar.me (PIX/crédito/débito + webhook + split + subscriptions), Resend,
instrumentação de custo de IA, landing `/lancamento`.

### Pronto em código, aguardando configuração
Cobrança (planos e split — faltam chaves `live` e o recipient da plataforma) e
TURN (código pronto; falta subir o coturn). Ver [tasks.md](./tasks.md).

### Fora de escopo / futuro
Modo supervisor (Fase 3), app mobile, agendamento inbound pelo paciente via
WhatsApp, clínica/equipe (o gancho `organizacao_id` já existe no schema).

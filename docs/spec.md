# spec.md — Especificação do Produto · Auren Care

> Especificação funcional e de negócio. Para arquitetura técnica veja [sdd.md](./sdd.md);
> para acompanhamento de tarefas veja [tasks.md](./tasks.md).
> Última atualização: junho 2026.

---

## 1. Visão

**Auren Care — "Sistema Operacional da Prática Clínica".** Plataforma SaaS para
psicólogos clínicos privados que unifica agenda, pagamentos, comunicação por
WhatsApp, transcrição de sessão, análise longitudinal e inteligência clínica em
um único produto.

- **Público-alvo:** psicólogo(a) clínico(a), prática online ou híbrida, 15–30
  pacientes ativos.
- **Não é:** ERP, prontuário hospitalar, telemedicina genérica.

## 2. Premissas inegociáveis

| # | Premissa | Origem |
|---|----------|--------|
| P1 | **A IA nunca emite diagnóstico.** Linguagem de frequência e observação, nunca clínica/diagnóstica. | CFP 09/2024 |
| P2 | **Toda nota abre como rascunho.** Só vira prontuário após assinatura do psicólogo. | CFP 06/2019 |
| P3 | **Zero data training.** Nenhum dado de paciente treina modelos. | LGPD + contrato |
| P4 | **Pagamento confirma o agendamento.** Sessão só fica "confirmada" após webhook de pagamento. | Negócio |
| P5 | **O paciente não instala nada.** WhatsApp é a única interface do paciente. | Negócio |
| P6 | **Badge CFP visível** em toda tela com conteúdo gerado por IA. | CFP 09/2024 |
| P7 | **Análise é sobre o paciente.** A extração de temas/observações considera apenas as falas do paciente. | Clínico |

## 3. Requisitos funcionais

### 3.1 Autenticação e conta
- RF-01 Login/logout do psicólogo (email + senha, bcrypt, sessão JWT 8h).
- RF-02 Cadastro público de psicólogo em `/cadastro` (5 campos) com auto-login.
- RF-03 Perfil e dados de recebimento (onboarding de pagamento / tributário).

### 3.2 Pacientes
- RF-10 Cadastrar paciente (nome, telefone, email) — dispara **WhatsApp + email**
  de boas-vindas com link de consentimento.
- RF-11 Listar pacientes com filtros, badge automático e arquivamento (soft delete).
- RF-12 Editar dados; exclusão definitiva só sem sessões registradas (CFP 06/2019).
- RF-13 Perfil clínico: condições, CID, medicações, alertas.

### 3.3 Agenda e sessões
- RF-20 Agenda com visões dia/semana/mês, cores por status e tag de pagamento.
- RF-21 Nova sessão (avulsa ou série recorrente).
- RF-22 Ciclo de status: `agendada → aguardando_metodo → aguardando_pagamento →
  confirmada → em_curso → concluida` (+ `cancelada`/`no_show`).

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
- RF-35 Vídeo P2P embutido (WebRTC) com sala pública para o paciente.
- RF-36 Pós-sessão: resumo IA (rascunho editável), assinatura, sugestões de
  marcação e risco, reagendamento.

### 3.5 Inteligência clínica (IA)
- RF-40 **Temas Recorrentes:** grafo de palavras-chave/co-ocorrência por paciente,
  extraído **apenas das falas do paciente** (P7), com chat de apoio.
- RF-41 **Evolução Registrada:** análise longitudinal + chat de apoio.
- RF-42 **Observação ao vivo:** gerada a cada N turnos do paciente durante a sessão.
- RF-43 Toda saída de IA passa por **guarda de termos proibidos** (P1) e abre como
  rascunho (P2); badge CFP sempre visível (P6).

### 3.6 Financeiro
- RF-50 Cobranças com filtros (período, status, método, NF).
- RF-51 Nota fiscal por sessão; exportação contábil/tributária (CSV/PDF).
- RF-52 Saúde da Prática: KPIs (sessões, pacientes ativos, valor médio por sessão,
  taxa de comparecimento 90d).

### 3.7 WhatsApp (Evolution API) — 7 fluxos
- RF-60 Fluxo 1 — Cadastro/boas-vindas + consentimento.
- RF-61 Fluxo 2 — Agendamento + escolha de método (PIX/CRÉDITO/DÉBITO) + cobrança.
- RF-62 Fluxo 3 — Lembretes automáticos (24h e 2h).
- RF-63 Fluxo 4 — Parser de comandos recebidos.
- RF-64 Fluxo 5 — Cancelamento + reembolso (regra >24h / <24h).
- RF-65 Fluxo 6 — Pós-sessão.
- RF-66 Fluxo 7 — Confirmação pós-sessão (janela diurna/noturna; silêncio libera).

### 3.8 Pagamentos (Pagar.me)
- RF-70 PIX (QR, expira 30min), crédito (até 6x), débito.
- RF-71 Recipient/split (PF/PJ), reembolso.
- RF-72 Webhook que confirma a sessão ao receber pagamento (P4).

## 4. Requisitos não-funcionais

- RNF-01 **Criptografia em repouso (AES-256-GCM)** para `transcricao_texto`,
  `nota_clinica`, `resumo_ia`.
- RNF-02 **TLS** em trânsito (ingress + Cloudflare Full strict).
- RNF-03 Áudio bruto **descartado** após transcrição; nada persiste em disco.
- RNF-04 Consentimento LGPD com timestamp + trilha de auditoria.
- RNF-05 Disponibilidade: app stateless, 1 pod (escalável); banco e cache externos.
- RNF-06 Acessibilidade e responsividade nas telas do psicólogo.
- RNF-07 Internacionalização: pt-BR.

## 5. Regras de negócio críticas

- RN-01 Badge automático de paciente (Atenção / Espaçando / Nova / Registrar).
- RN-02 Validação de termos proibidos da IA **no backend** (não no frontend).
- RN-03 Sem assinatura, nota não vira prontuário.
- RN-04 Reembolso: >24h automático; <24h sem reembolso (configurável).

## 6. Escopo

### Implementado e em produção
Auth, dashboard, pacientes, agenda (3 visões), Modo Presença completo (transcrição
dual + 9 widgets + vídeo WebRTC), pós-sessão, **Temas Recorrentes (grafo)**,
**Evolução longitudinal**, financeiro + NF + exportação contábil, Saúde da Prática,
Evolution (7 fluxos), Pagar.me (PIX/crédito/débito + webhook), Resend (email),
CFP badge + AES-256 + consentimento.

### Fora de escopo / futuro
Modo supervisor (Fase 3), app mobile, agendamento inbound pelo paciente via WhatsApp,
servidor TURN para WebRTC, validação de assinatura nos webhooks. Ver [tasks.md](./tasks.md).

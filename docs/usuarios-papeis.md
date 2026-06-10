# Identidade, Usuários e Papéis — proposta + plano de implementação

> **Status:** proposta com plano detalhado · decisão de "quando" em aberto
> **Data:** junho 2026
> **Objetivo:** separar autenticação (conta) dos perfis de domínio
> (`psicologos`/`pacientes`) para suportar um papel de **administrador** que não
> é psicólogo nem paciente — com o menor risco possível no auth de produção.
>
> Docs relacionados: [`sdd.md`](./sdd.md) · [`tasks.md`](./tasks.md).

---

## 1. Modelo atual (em produção)

Autenticação **achatada** na tabela `psicologos`: a mesma linha guarda conta
(login) **e** perfil profissional.

```
psicologos
  id, nome, crp,
  email, senha_hash,          ← conta / login (NextAuth credentials)
  telefone, valor_sessao, pgm_* (recebimento), plano_* (assinatura), ...
```

- **Quem autentica:** só o psicólogo.
- **Paciente:** não loga (só WhatsApp) → registro de dados, não "usuário".
- **Admin / backoffice:** não existe.

### Como o auth está fiado hoje (pontos que a refatoração toca)
| Peça | Arquivo | Papel atual |
|---|---|---|
| Provider de login | [`src/server/auth/options.ts`](../src/server/auth/options.ts) | `authorize` busca `psicologos` por email + bcrypt; JWT guarda `uid`/`crp`; sessão expõe `user.id`/`user.crp`. |
| **Gargalo de autorização** | [`src/server/lib/auth.ts`](../src/server/lib/auth.ts) | `requirePsicologo()` — `getServerSession` → redireciona p/ `/login`; retorna `session.user`. **Usado por ~40 arquivos.** |
| Cadastro | [`cadastroPsicologo.ts`](../src/server/services/cadastroPsicologo.ts) | insere em `psicologos` com `senha_hash`. |
| Reset de senha | `password_resets` (migration 020) + rotas `recuperar-senha`/`redefinir-senha` | token por email → `psicologos`. |
| "Admin" atual | [`src/app/api/admin/evolution/webhook/route.ts`](../src/app/api/admin/evolution/webhook/route.ts) | protegido só por `requirePsicologo()` → **qualquer psicólogo é "admin"**. Não há papel real. |

> **Contrato implícito hoje:** `session.user.id === psicologos.id`. Os ~40
> consumidores usam esse `id` como `psicologo_id`. **Preservar esse contrato é a
> chave para uma migração de baixo risco.**

### Por que é legítimo (no escopo atual) e onde trava
Com **um único papel que autentica**, juntar conta + perfil é uma simplificação
adequada. Trava quando surge um **segundo papel que loga** (admin/suporte): não
há onde colocar uma conta que **não seja** psicólogo.

---

## 2. Modelo proposto — `usuarios` + papéis

```
usuarios                      (conta — quem loga)
  id, email, senha_hash, nome, foto_url,
  papel,                      ← 'admin' | 'psicologo'  (futuro: 'paciente')
  ativo, created_at
     │
     └──1:1── psicologos      (perfil profissional; ganha usuario_id FK)
                              (admin = usuario SEM perfil)

pacientes                     (perfil — NÃO loga; segue por WhatsApp; inalterado)
```

- `usuarios` centraliza conta: email, senha, foto, **papel**, status.
- `psicologos` vira **perfil**, ligado por `usuario_id`.
- `admin` = `usuario` com `papel='admin'` e **sem** perfil.
- `pacientes` intocado (só ganharia `usuario_id` se um dia logar — fora de escopo).

---

## 3. Princípio-chave da migração (baixo risco)

**Manter `session.user.id === psicologos.id`.** O login passa a autenticar contra
`usuarios`, mas a sessão continua expondo o **id do perfil psicólogo** como
`user.id` — então os ~40 consumidores **não mudam**. Adicionamos apenas
`user.papel` e `user.usuarioId`.

```
authorize(email, senha)
  → acha usuarios por email + bcrypt
  → se papel='psicologo': carrega psicologos.id pelo usuario_id
       retorna { id: psicologo.id, usuarioId, papel:'psicologo', crp, ... }
  → se papel='admin':
       retorna { id: null, usuarioId, papel:'admin', ... }
```

- Fluxos de psicólogo: inalterados (`user.id` continua sendo `psicologo.id`).
- Rotas de admin: novo guard `requireAdmin()` (checa `papel`), `user.id` pode ser null.

---

## 4. Plano de implementação por fases

> Cada fase é deployável e reversível. As fases 0–2 entregam o `usuarios` + papéis
> sem mudar nada visível pro psicólogo; a fase 3 entrega o admin; a 4 é limpeza.

### Fase 0 — Migration (aditiva, sem efeito no app)
Cria `usuarios`, faz backfill dos psicólogos, liga `psicologos.usuario_id`.
**Ainda não muda o auth** → zero risco. (SQL na §6.)

### Fase 1 — Religar a autenticação
- [`options.ts`](../src/server/auth/options.ts): `authorize` passa a buscar em
  `usuarios` (email + bcrypt); resolve `psicologos.id` por `usuario_id`. JWT/sessão
  ganham `papel` e `usuarioId`; `user.id` continua = `psicologo.id`.
- [`auth.ts`](../src/server/lib/auth.ts): mantém `requirePsicologo()` (agora
  exige `papel='psicologo'` **e** `id` não-nulo); adiciona `requireUsuario()`
  (qualquer logado) e `requireAdmin()` (`papel='admin'`).
- Tipos de sessão (`next-auth.d.ts`): adicionar `papel`, `usuarioId`.
- **Senha:** a partir daqui, `usuarios.senha_hash` é a fonte única de verdade do
  login. `psicologos.senha_hash` fica órfão (removido na Fase 4).

### Fase 2 — Cadastro e reset de senha
- [`cadastroPsicologo.ts`](../src/server/services/cadastroPsicologo.ts): numa
  transação, cria `usuarios` (papel='psicologo') **e** `psicologos` ligado por
  `usuario_id`. Unicidade de email migra para `usuarios.email`.
- Reset de senha (`password_resets` + rotas): token e troca de senha passam a
  referenciar `usuarios` (por email/usuario_id), não `psicologos`.

### Fase 3 — Área de administrador
- Migration: o primeiro admin (seed/INSERT manual: `usuarios` papel='admin').
- Guard `requireAdmin()` + middleware de rota para `/admin/*`.
- Rotas/telas mínimas: lista de psicólogos, status (plano, WhatsApp conectado),
  métricas globais; mover o `api/admin/evolution/webhook` para `requireAdmin()`.
- (Itens concretos viram tasks em [`tasks.md`](./tasks.md).)

### Fase 4 — Limpeza (depois, opcional)
- `ALTER TABLE psicologos DROP COLUMN senha_hash` (e, se nada mais ler,
  `DROP COLUMN email` — verificar usos como `wa_instancia`, exportações, etc.).
- Remover qualquer caminho de auth legado.

---

## 5. Mudanças arquivo a arquivo

| Arquivo | Mudança | Fase |
|---|---|---|
| `src/server/db/migrations/022_usuarios.sql` (novo) | cria `usuarios`, `usuario_id`, backfill | 0 |
| `src/server/auth/options.ts` | `authorize` contra `usuarios`; `papel`/`usuarioId` no JWT/sessão | 1 |
| `src/server/lib/auth.ts` | `requirePsicologo` (com papel) + `requireUsuario` + `requireAdmin` | 1 |
| `src/types/next-auth.d.ts` (ou onde estiver) | tipos `papel`, `usuarioId` na sessão | 1 |
| `src/server/services/cadastroPsicologo.ts` | cria `usuarios`+`psicologos` em transação | 2 |
| rotas/serviço de reset de senha | referenciam `usuarios` | 2 |
| `src/middleware.ts` | guard de `/admin/*` (papel) | 3 |
| `src/app/api/admin/evolution/webhook/route.ts` | trocar `requirePsicologo`→`requireAdmin` | 3 |
| `src/app/(admin)/...` (novo) | telas do backoffice | 3 |
| ~40 consumidores de `requirePsicologo()` | **nenhuma** (contrato `user.id=psicologo.id` preservado) | — |

---

## 6. Migration — Fase 0 (esboço revisável)

```sql
-- 022_usuarios.sql  — ADITIVA: cria contas e liga aos psicólogos. Não muda auth.
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  foto_url TEXT,
  papel VARCHAR(20) NOT NULL DEFAULT 'psicologo',  -- admin | psicologo
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE psicologos
  ADD COLUMN usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE;

-- Backfill: cada psicólogo vira uma conta 'psicologo' (copia email/senha/nome)
INSERT INTO usuarios (email, senha_hash, nome, papel, created_at)
SELECT lower(email), senha_hash, nome, 'psicologo', created_at FROM psicologos;

UPDATE psicologos p
   SET usuario_id = u.id
  FROM usuarios u
 WHERE u.email = lower(p.email);

-- Garantia: todo psicólogo ligado a uma conta
-- (validar em código que count(usuario_id IS NULL) = 0 antes da Fase 1)
```

```sql
-- Fase 3: primeiro admin (rodar manualmente, senha hasheada via app/script)
INSERT INTO usuarios (email, senha_hash, nome, papel)
VALUES ('admin@audere.ia.br', '<bcrypt-hash>', 'Administrador', 'admin');
```

---

## 7. Testes / critérios de aceite

- **Fase 0:** migration idempotente; todo `psicologos.usuario_id` preenchido;
  `count(*) usuarios = count(*) psicologos`.
- **Fase 1:** login do psicólogo funciona igual; `session.user.id` continua
  sendo o `psicologo.id` (testar 1 rota que usa `requirePsicologo`, ex.: dashboard);
  sessão carrega `papel='psicologo'`.
- **Fase 2:** cadastro novo cria `usuarios`+`psicologos` ligados; reset de senha
  troca a senha em `usuarios` e o login passa a usar a nova.
- **Fase 3:** `usuario` admin loga; acessa `/admin/*`; psicólogo é **barrado**
  em `/admin/*`; admin **não** acessa telas de psicólogo (sem `psicologo.id`).

---

## 8. Rollback

- **Fase 0:** `DROP TABLE usuarios` + `ALTER TABLE psicologos DROP COLUMN
  usuario_id` (nada depende ainda).
- **Fase 1:** reverter `options.ts`/`auth.ts` para ler `psicologos` (os dados
  legados `psicologos.email/senha_hash` continuam intactos até a Fase 4 — por
  isso a limpeza fica por último).
- Fases 2–3 são reversíveis por revert de código; a Fase 4 (drop de colunas) só
  depois de tudo estável.

---

## 9. Esforço e risco

- **Tamanho:** ~1 migration + ~5 arquivos de código (auth, guards, cadastro,
  reset, middleware) + telas de admin sob demanda. Backfill trivial (poucos
  usuários).
- **Risco concentrado:** Fase 1 (login). Mitigado por preservar o contrato
  `user.id=psicologo.id` (não toca os ~40 consumidores) e por manter os dados
  legados até a Fase 4.
- **Não afeta** `ENCRYPTION_KEY` (senha é bcrypt, portável) nem dados clínicos.

---

## 10. Decisão

O **plano** está pronto e é de baixo risco. O que falta é o **gatilho**: existe
necessidade concreta de admin/backoffice?

- **Sim, agora** → executar Fases 0→3 (a 4 depois de estável).
- **Ainda não** → deixar registrado (este doc) e executar quando o admin virar
  requisito. O custo não muda com o tempo (backfill continua pequeno).
- **Só 1 admin urgente** → atalho temporário: coluna `papel` em `psicologos` ou
  tabela `admins` enxuta, sem a refatoração completa — depois converge pro modelo
  desta proposta.

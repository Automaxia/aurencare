-- ──────────────────────────────────────────────────────────────────────────
-- Auren Care · schema inicial · §11 + Fase 2
-- ──────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Psicólogos ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS psicologos (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                 VARCHAR(255) NOT NULL,
  crp                  VARCHAR(20)  NOT NULL UNIQUE,
  email                VARCHAR(255) NOT NULL UNIQUE,
  senha_hash           VARCHAR(255) NOT NULL,
  wa_instancia         VARCHAR(100),
  wa_conectado         BOOLEAN      DEFAULT FALSE,
  pagarme_recipient_id VARCHAR(100),
  valor_sessao         NUMERIC(10,2),
  created_at           TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Pacientes ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pacientes (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psicologo_id             UUID NOT NULL REFERENCES psicologos(id) ON DELETE CASCADE,
  nome                     VARCHAR(255) NOT NULL,
  telefone                 VARCHAR(20)  NOT NULL,
  email                    VARCHAR(255),
  condicoes                JSONB,            -- {cid, medicacoes, alertas}
  consentimento_aceito     BOOLEAN      DEFAULT FALSE,
  consentimento_timestamp  TIMESTAMPTZ,
  consentimento_token      VARCHAR(100) UNIQUE,
  status                   VARCHAR(20)  DEFAULT 'ativo',
  created_at               TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (psicologo_id, telefone)
);

-- ── Sessões ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessoes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psicologo_id          UUID NOT NULL REFERENCES psicologos(id) ON DELETE CASCADE,
  paciente_id           UUID NOT NULL REFERENCES pacientes(id)  ON DELETE CASCADE,
  numero                INTEGER NOT NULL,
  data_hora             TIMESTAMPTZ NOT NULL,
  duracao_min           INTEGER DEFAULT 50,
  modalidade            VARCHAR(20) DEFAULT 'online',
  status                VARCHAR(30) DEFAULT 'agendada',
    -- agendada | aguardando_metodo | aguardando_pagamento |
    -- confirmada | em_curso | concluida | cancelada | no_show
  pagamento_status      VARCHAR(20) DEFAULT 'pendente',
  pagamento_metodo      VARCHAR(20),                 -- pix|credito|debito
  pagamento_parcelas    INTEGER DEFAULT 1,
  pagarme_order_id      VARCHAR(100),
  pagarme_qrcode        TEXT,
  pagarme_qrcode_url    TEXT,
  pagarme_checkout_url  TEXT,
  valor                 NUMERIC(10,2),
  wa_metodo_escolhido   BOOLEAN DEFAULT FALSE,
  wa_lembrete_24h       BOOLEAN DEFAULT FALSE,
  wa_lembrete_2h        BOOLEAN DEFAULT FALSE,
  transcricao_texto     TEXT,        -- encriptado AES-256-GCM
  resumo_ia             TEXT,        -- encriptado
  nota_clinica          TEXT,        -- encriptado
  assinada              BOOLEAN DEFAULT FALSE,
  assinatura_timestamp  TIMESTAMPTZ,
  indicadores           JSONB,       -- humor F/I/D, risco, ritmo
  palavras_chave        JSONB,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessoes_paciente_data    ON sessoes(paciente_id, data_hora DESC);
CREATE INDEX IF NOT EXISTS sessoes_psicologo_status ON sessoes(psicologo_id, status);

-- ── Objetivos terapêuticos · Fase 2 ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS objetivos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id  UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  titulo       VARCHAR(255) NOT NULL,
  descricao    TEXT,
  status       VARCHAR(20) DEFAULT 'ativo',  -- ativo|concluido|pausado
  progresso    INTEGER DEFAULT 0,            -- 0..100
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Grafo de temas · Fase 2 ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS palavras_chave (
  id           BIGSERIAL PRIMARY KEY,
  paciente_id  UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  palavra      VARCHAR(120) NOT NULL,
  cluster      VARCHAR(20)  NOT NULL,        -- emocional|relacional|situacional|cognitivo
  frequencia   INTEGER      NOT NULL DEFAULT 1,
  ultima_sessao_id UUID REFERENCES sessoes(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (paciente_id, palavra)
);
CREATE INDEX IF NOT EXISTS palavras_paciente_cluster ON palavras_chave(paciente_id, cluster);

CREATE TABLE IF NOT EXISTS arestas_tema (
  id           BIGSERIAL PRIMARY KEY,
  paciente_id  UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  palavra_a    VARCHAR(120) NOT NULL,
  palavra_b    VARCHAR(120) NOT NULL,
  weight       INTEGER      NOT NULL DEFAULT 1,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (paciente_id, palavra_a, palavra_b)
);
CREATE INDEX IF NOT EXISTS arestas_paciente ON arestas_tema(paciente_id);

-- ── Consentimentos (audit trail) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consentimentos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id  UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  texto_versao VARCHAR(20) NOT NULL,        -- 'lgpd-2026.05'
  aceito_em    TIMESTAMPTZ DEFAULT NOW(),
  ip           VARCHAR(64),
  user_agent   VARCHAR(255)
);

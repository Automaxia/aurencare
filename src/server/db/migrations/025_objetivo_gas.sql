-- ──────────────────────────────────────────────────────────────────────────
-- GAS como ferramenta de ACOMPANHAMENTO da Meta (objetivo SMART), não como
-- tipo de métrica. A Meta é definida em SMART (método); o GAS é opcional,
-- editável e pode haver mais de uma escala GAS por Meta.
--
-- Cada escala = 5 níveis padrão GAS (−2 a +2) descritos pelo psicólogo, com
-- marcação de qual nível é a PARTIDA (onde o paciente começa) e o ESPERADO (meta).
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS objetivo_gas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objetivo_id     UUID NOT NULL REFERENCES objetivos(id) ON DELETE CASCADE,
  titulo          VARCHAR(160) NOT NULL,
  -- Descrições dos 5 níveis padrão (texto livre do psicólogo)
  nivel_m2        TEXT,   -- −2  muito abaixo do esperado
  nivel_m1        TEXT,   -- −1  abaixo do esperado
  nivel_0         TEXT,   --  0  nível esperado (meta)
  nivel_p1        TEXT,   -- +1  acima do esperado
  nivel_p2        TEXT,   -- +2  muito acima do esperado
  nivel_partida   SMALLINT NOT NULL DEFAULT -1,  -- onde o paciente começa
  nivel_esperado  SMALLINT NOT NULL DEFAULT 0,   -- nível-meta
  ativo           BOOLEAN  NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS obj_gas_objetivo ON objetivo_gas(objetivo_id);

-- Medições de GAS reaproveitam objetivo_medicoes (valor = nível −2..+2).
-- gas_id liga a medição à escala específica (Fase 2 — acompanhamento no tempo).
ALTER TABLE objetivo_medicoes
  ADD COLUMN IF NOT EXISTS gas_id UUID REFERENCES objetivo_gas(id) ON DELETE CASCADE;

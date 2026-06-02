-- ──────────────────────────────────────────────────────────────────────────
-- Objetivos no formato SMART + Goal Attainment Scale (GAS).
--
-- SMART: Específico (titulo), Mensurável (metrica_*), Atingível (baseline+alvo),
-- Relevante (descricao), Temporal (prazo_em).
--
-- GAS: alternativa quando o objetivo é subjetivo. Escala -2 a +2 onde
-- 0=baseline, +2=muito melhor que esperado, -2=muito pior.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE objetivos
  -- 'absoluta' (valor + unidade) | 'gas' (escala -2..+2)
  ADD COLUMN IF NOT EXISTS metrica_tipo      VARCHAR(20) DEFAULT 'absoluta',
  -- Unidade da métrica absoluta — ex: "ataques/semana", "min de respiração/dia"
  ADD COLUMN IF NOT EXISTS metrica_unidade   VARCHAR(80),
  -- Valor de partida (baseline). Em GAS, sempre 0.
  ADD COLUMN IF NOT EXISTS metrica_baseline  NUMERIC(10,2),
  -- Valor alvo. Em GAS, +2.
  ADD COLUMN IF NOT EXISTS metrica_alvo      NUMERIC(10,2),
  -- 'diminuir' (alvo < baseline) ou 'aumentar' (alvo > baseline).
  -- Define o que significa "progresso" pro cálculo.
  ADD COLUMN IF NOT EXISTS metrica_direcao   VARCHAR(10) DEFAULT 'aumentar',
  -- Data alvo pra atingir o objetivo (pilar Temporal do SMART).
  ADD COLUMN IF NOT EXISTS prazo_em          DATE;

-- ── Tabela de medições longitudinais ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS objetivo_medicoes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objetivo_id  UUID NOT NULL REFERENCES objetivos(id) ON DELETE CASCADE,
  medido_em    DATE NOT NULL,
  valor        NUMERIC(10,2) NOT NULL,
  nota         TEXT,
  -- Quem registrou: 'psicologa' (atual) | 'paciente' (futuro WhatsApp) | 'sessao' (auto na sessão)
  origem       VARCHAR(20) NOT NULL DEFAULT 'psicologa',
  -- Sessão relacionada (opcional — quando medição vem de dentro da sessão)
  sessao_id    UUID REFERENCES sessoes(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS obj_medicoes_objetivo_data
  ON objetivo_medicoes(objetivo_id, medido_em DESC);

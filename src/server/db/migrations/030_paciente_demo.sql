-- Marca pacientes de demonstração (fictícios, gerados pra teste/onboarding).
-- Permite badge na UI e remoção em 1 clique sem confundir com paciente real.
ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS demo BOOLEAN NOT NULL DEFAULT FALSE;

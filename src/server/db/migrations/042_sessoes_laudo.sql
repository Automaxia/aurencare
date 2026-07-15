-- Separa o LAUDO FORMAL (CFP) do registro de continuidade.
--
-- Modelo: `resumo_ia` passa a ser o REGISTRO ASSINADO da sessão (o resumo que
-- interessa à continuidade — temas, evolução, "preparar próxima"), preenchido a
-- partir do resumo curto automático (barato, toda sessão). O `laudo` é um
-- documento formal, gerado SOB DEMANDA (modelo forte) só quando solicitado
-- (CFP / pedido do paciente) — esporádico, e NÃO é pré-requisito da continuidade.
--
-- Antes, o laudo sob demanda escrevia na MESMA coluna (resumo_ia), então gerar
-- um laudo sobrescrevia o registro de continuidade. Agora vivem separados.
ALTER TABLE sessoes ADD COLUMN IF NOT EXISTS laudo TEXT;

COMMENT ON COLUMN sessoes.laudo IS 'Laudo formal CFP (MODE: SUMMARY, modelo forte), cifrado, gerado sob demanda. Separado de resumo_ia (registro assinado que dirige a continuidade).';

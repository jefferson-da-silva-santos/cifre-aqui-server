-- Observacoes gerais do hino: afinacao, capotraste, combinado do grupo.
--
-- Coluna propria em vez de mais um bloco: a observacao nao pertence a nenhuma
-- secao da musica, nao tem acorde nem letra, e sai no rodape da folha depois de
-- toda a cifra. Modelar como bloco a faria aparecer no meio do hino.
ALTER TABLE "cifras" ADD COLUMN "observacoes" TEXT;

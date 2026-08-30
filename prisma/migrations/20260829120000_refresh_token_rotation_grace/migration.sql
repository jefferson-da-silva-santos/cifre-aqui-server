-- Rastreia qual token substituiu cada refresh token rotacionado.
--
-- Sem esta coluna, "token revogado" é a única informação disponível no replay —
-- e retry legítimo (StrictMode, duas abas, retentativa de rede) e roubo de token
-- produzem exatamente esse mesmo estado. O resultado era toda chamada duplicada
-- ao /auth/refresh derrubar todas as sessões do usuário.
ALTER TABLE "refresh_tokens" ADD COLUMN "replacedByTokenHash" TEXT;

-- A varredura de reuso e a limpeza de expirados são por token e por data.
CREATE INDEX "refresh_tokens_replacedByTokenHash_idx" ON "refresh_tokens"("replacedByTokenHash");
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

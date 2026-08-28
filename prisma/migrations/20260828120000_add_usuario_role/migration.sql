-- Adiciona papel de usuário (USER/ADMIN). ADMIN é usado para conceder
-- exportação ilimitada sem cobrança — atribuído manualmente no banco,
-- não existe fluxo de cadastro que crie um ADMIN.
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "usuarios" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER';

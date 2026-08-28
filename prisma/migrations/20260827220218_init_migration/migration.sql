-- CreateEnum
CREATE TYPE "StatusCifra" AS ENUM ('rascunho', 'pago');

-- CreateEnum
CREATE TYPE "Instrumento" AS ENUM ('violao', 'guitarra', 'ukulele', 'baixo', 'teclado');

-- CreateEnum
CREATE TYPE "TipoPagamento" AS ENUM ('criacao', 'edicao');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "MetodoPagamento" AS ENUM ('PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BOLETO', 'ACCOUNT_MONEY');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "nomeExibicaoPadrao" TEXT,
    "logoUrlPadrao" TEXT,
    "redesSociaisPadrao" JSONB,
    "preferenciasPdfPadrao" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cifras" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "artista" TEXT,
    "tom" TEXT NOT NULL,
    "instrumento" "Instrumento" NOT NULL DEFAULT 'violao',
    "status" "StatusCifra" NOT NULL DEFAULT 'rascunho',
    "blocos" JSONB NOT NULL,
    "acordesCustomizadosUsados" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "configuracaoPdf" JSONB NOT NULL,
    "versaoPagaSnapshot" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cifras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acordes_customizados" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nomeExibicao" TEXT NOT NULL,
    "nomeAcordeVinculado" TEXT,
    "instrumento" "Instrumento" NOT NULL,
    "frets" INTEGER[],
    "fingers" INTEGER[],
    "barres" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "capo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acordes_customizados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" TEXT NOT NULL,
    "cifraId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoPagamento" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "metodo" "MetodoPagamento",
    "status" "StatusPagamento" NOT NULL DEFAULT 'pending',
    "externalReference" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "snapshotNoMomentoDoPagamento" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aprovadoEm" TIMESTAMP(3),
    "apostilaId" TEXT,

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apostilas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "status" "StatusPagamento" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apostilas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apostila_itens" (
    "id" TEXT NOT NULL,
    "apostilaId" TEXT NOT NULL,
    "cifraId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "apostila_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" BIGSERIAL NOT NULL,
    "providerEventId" TEXT,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "event" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "usuarioId" TEXT,
    "payload" JSONB,
    "ip" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_email_idx" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_usuarioId_idx" ON "refresh_tokens"("usuarioId");

-- CreateIndex
CREATE INDEX "cifras_usuarioId_idx" ON "cifras"("usuarioId");

-- CreateIndex
CREATE INDEX "cifras_status_idx" ON "cifras"("status");

-- CreateIndex
CREATE INDEX "acordes_customizados_usuarioId_idx" ON "acordes_customizados"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "pagamentos_externalReference_key" ON "pagamentos"("externalReference");

-- CreateIndex
CREATE INDEX "pagamentos_cifraId_idx" ON "pagamentos"("cifraId");

-- CreateIndex
CREATE INDEX "pagamentos_usuarioId_idx" ON "pagamentos"("usuarioId");

-- CreateIndex
CREATE INDEX "pagamentos_status_idx" ON "pagamentos"("status");

-- CreateIndex
CREATE INDEX "apostilas_usuarioId_idx" ON "apostilas"("usuarioId");

-- CreateIndex
CREATE INDEX "apostila_itens_apostilaId_idx" ON "apostila_itens"("apostilaId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_providerEventId_key" ON "webhook_events"("providerEventId");

-- CreateIndex
CREATE INDEX "audit_logs_event_idx" ON "audit_logs"("event");

-- CreateIndex
CREATE INDEX "audit_logs_usuarioId_idx" ON "audit_logs"("usuarioId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cifras" ADD CONSTRAINT "cifras_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acordes_customizados" ADD CONSTRAINT "acordes_customizados_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_cifraId_fkey" FOREIGN KEY ("cifraId") REFERENCES "cifras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_apostilaId_fkey" FOREIGN KEY ("apostilaId") REFERENCES "apostilas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apostila_itens" ADD CONSTRAINT "apostila_itens_apostilaId_fkey" FOREIGN KEY ("apostilaId") REFERENCES "apostilas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apostila_itens" ADD CONSTRAINT "apostila_itens_cifraId_fkey" FOREIGN KEY ("cifraId") REFERENCES "cifras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

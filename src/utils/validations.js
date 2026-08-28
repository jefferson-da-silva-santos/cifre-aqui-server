import { z } from "zod";

// ---------- Auth ----------
export const schemaRegisterUser = z.object({
  nome: z.string().min(2).max(100),
  email: z.string().email(),
  senha: z.string().min(8).max(72), // 72 = limite prático do bcrypt
});

export const schemaLoginUser = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

export const schemaRefreshToken = z.object({
  refreshToken: z.string().min(10).optional(), // também pode vir via cookie httpOnly
});

// ---------- Cifra ----------
const acordeInline = z.object({
  posicao: z.number().int().min(0),
  nome: z.string().min(1).max(30),
});

const linhaSchema = z.object({
  letra: z.string().max(500),
  acordes: z.array(acordeInline).default([]),
  // Texto livre com acordes inline entre colchetes (ex: ". . [F#o7] |").
  // Forma unidade rígida com a letra no PDF — nunca quebra entre páginas.
  linhaRitmo: z.string().max(200).nullable().optional(),
  // Nota discreta de direção ancorada nesta linha (ex: "Baixo entra nessa parte").
  nota: z.string().max(200).nullable().optional(),
});

const anotacaoSchema = z.object({
  instrumento: z.string().min(1).max(50),
  texto: z.string().max(300),
});

const blocoSchema = z.object({
  id: z.string().optional(),
  tipo: z.string().min(1).max(50),
  dinamica: z.enum(["calmaria", "crescendo", "climax", "break"]).nullable().optional(),
  linhas: z.array(linhaSchema).default([]),
  anotacoes: z.array(anotacaoSchema).default([]),
});

export const schemaConfiguracaoPdf = z.object({
  template: z.enum(["limpo", "professor", "compacto"]).default("limpo"),
  colunas: z.union([z.literal(1), z.literal(2)]).default(1),
  orientacao: z.enum(["retrato", "paisagem"]).default("retrato"),
  mostrarDiagramas: z.boolean().default(true),
  mostrarLegendaDinamica: z.boolean().default(true),
  mostrarCabecalhoArtista: z.boolean().default(true),
  logoUrl: z.string().url().nullable().optional(),
  nomeExibicao: z.string().max(100).nullable().optional(),
  redesSociais: z.record(z.string()).nullable().optional(),
  destaqueAcorde: z.enum(["negrito", "cor", "sublinhado"]).default("negrito"),
  tema: z.enum(["minimalista", "vintage", "cifra_igreja"]).default("minimalista"),
});

export const schemaCreateCifra = z.object({
  titulo: z.string().min(1).max(150),
  artista: z.string().max(150).optional(),
  tom: z.string().min(1).max(10),
  instrumento: z.enum(["violao", "guitarra", "ukulele", "baixo", "teclado"]).default("violao"),
  blocos: z.array(blocoSchema).default([]),
  configuracaoPdf: schemaConfiguracaoPdf.partial().default({}),
});

export const schemaUpdateCifra = schemaCreateCifra.partial();

export const schemaTransporCifra = z.object({
  semitons: z.number().int().min(-11).max(11),
});

export const schemaListCifras = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    // "todas" é o valor que o frontend usa pra "sem filtro de status" — tratamos
    // como equivalente a não informar status nenhum.
    status: z.enum(["rascunho", "pago", "todas"]).optional(),
    busca: z.string().max(150).optional(),
    // O frontend envia o termo de busca como "q" — aceitamos os dois nomes.
    q: z.string().max(150).optional(),
  })
  .transform(({ status, busca, q, ...resto }) => ({
    ...resto,
    status: status === "todas" ? undefined : status,
    busca: busca ?? q ?? undefined,
  }));

// ---------- Acorde customizado ----------
export const schemaCreateAcordeCustomizado = z.object({
  nomeExibicao: z.string().min(1).max(60),
  nomeAcordeVinculado: z.string().max(30).nullable().optional(),
  instrumento: z.enum(["violao", "guitarra", "ukulele", "baixo", "teclado"]),
  frets: z.array(z.number().int().min(-1).max(24)).min(1),
  fingers: z.array(z.number().int().min(0).max(4)).min(1),
  barres: z.array(z.number().int().min(0).max(24)).default([]),
  capo: z.boolean().default(false),
});

export const schemaUpdateAcordeCustomizado = schemaCreateAcordeCustomizado.partial();

// ---------- Exportação / Pagamento ----------
export const schemaIniciarExportacao = z.object({
  metodo: z.enum(["PIX", "CREDIT_CARD", "DEBIT_CARD", "BOLETO", "ACCOUNT_MONEY"]).default("PIX"),
});

// Usado por POST /cifras/:id/export (variante "job" consumida pelo frontend,
// que também permite sobrescrever a configuracaoPdf no ato da exportação).
export const schemaExportarCifra = z.object({
  metodo: z.enum(["PIX", "CREDIT_CARD", "DEBIT_CARD", "BOLETO", "ACCOUNT_MONEY"]).default("PIX"),
  configuracaoPdf: schemaConfiguracaoPdf.partial().optional(),
});

export const schemaWebhookPagamento = z.object({
  type: z.string().optional(),
  action: z.string().optional(),
  data: z
    .object({
      id: z.union([z.string(), z.number()]),
    })
    .optional(),
  id: z.union([z.string(), z.number()]).optional(),
});

// ---------- Modo Apostila ----------
export const schemaCreateApostila = z.object({
  titulo: z.string().min(1).max(150),
  cifraIds: z.array(z.string().uuid()).min(1).max(50),
  metodo: z.enum(["PIX", "CREDIT_CARD", "DEBIT_CARD", "BOLETO", "ACCOUNT_MONEY"]).default("PIX"),
});

// POST /apostilas/quote — orçamento (dry-run), sem título ainda definido.
export const schemaOrcarApostila = z.object({
  cifraIds: z.array(z.string().uuid()).min(1).max(50),
});

// ---------- Dashboard ----------
export const schemaDashboardQuery = z.object({
  periodo: z.enum(["7d", "30d", "90d"]).default("30d"),
});
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const senhaHash = await bcrypt.hash("senha123", 12);

  const usuario = await prisma.usuario.upsert({
    where: { email: "demo@cifreaqui.com.br" },
    update: {},
    create: {
      nome: "Usuário Demo",
      email: "demo@cifreaqui.com.br",
      senhaHash,
    },
  });

  const cifraExistente = await prisma.cifra.findFirst({
    where: { usuarioId: usuario.id, titulo: "Cifra de Demonstração" },
  });

  if (!cifraExistente) {
    await prisma.cifra.create({
      data: {
        usuarioId: usuario.id,
        titulo: "Cifra de Demonstração",
        artista: "CifreAqui",
        tom: "C",
        instrumento: "violao",
        status: "rascunho",
        blocos: [
          {
            id: "bloco-1",
            tipo: "Verso",
            dinamica: "calmaria",
            linhas: [
              {
                letra: "O amor é como o vento",
                acordes: [
                  { posicao: 2, nome: "C", reconhecido: true },
                  { posicao: 14, nome: "G", reconhecido: true },
                ],
                linhaRitmo: null,
              },
            ],
            anotacoes: [],
          },
          {
            id: "bloco-2",
            tipo: "Refrão",
            dinamica: "climax",
            linhas: [
              {
                letra: "Vem, vem, vem comigo",
                acordes: [
                  { posicao: 0, nome: "Am", reconhecido: true },
                  { posicao: 5, nome: "F", reconhecido: true },
                ],
                linhaRitmo: null,
              },
            ],
            anotacoes: [{ instrumento: "baixo", texto: "entra só no segundo refrão" }],
          },
        ],
        configuracaoPdf: {
          template: "limpo",
          colunas: 1,
          orientacao: "retrato",
          mostrarDiagramas: true,
          mostrarLegendaDinamica: true,
          mostrarCabecalhoArtista: true,
          logoUrl: null,
          nomeExibicao: null,
          redesSociais: null,
          destaqueAcorde: "negrito",
          tema: "minimalista",
        },
      },
    });
  }

  console.log("✅ Seed concluído:", usuario.email, "/ senha: senha123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

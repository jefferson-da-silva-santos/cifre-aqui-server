// Exceção deliberada ao padrão repository→service do resto do projeto: este
// serviço só faz leitura agregada (KPIs de dashboard), então fala direto com
// o Prisma em vez de passar por um repository dedicado — evitaria criar uma
// camada inteira só para queries de relatório que não representam uma
// entidade de domínio.

const PERIODOS_EM_DIAS = { "7d": 7, "30d": 30, "90d": 90 };

const LABEL_TIPO = {
  criacao: "Exportação",
  edicao: "Reexportação com edição",
};

function chaveDaSemana(data) {
  // Segunda-feira da semana ISO da data, formatada como "AAAA-MM-DD".
  const d = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
  const diaSemana = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - diaSemana + 1);
  return d.toISOString().slice(0, 10);
}

export default class DashboardService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async usuario(usuarioId, periodo = "30d") {
    const dias = PERIODOS_EM_DIAS[periodo] ?? 30;
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

    const [
      cifrasCriadas,
      pdfsExportados,
      reexportacoesGratis,
      pagamentosAprovados,
      pagamentosNoPeriodo,
      pagamentosRecentesRaw,
    ] = await Promise.all([
      this.prisma.cifra.count({ where: { usuarioId } }),
      this.prisma.auditLog.count({ where: { usuarioId, event: "pdf.gerado" } }),
      this.prisma.auditLog.count({
        where: { usuarioId, event: "pdf.gerado", payload: { path: ["gratuito"], equals: true } },
      }),
      this.prisma.pagamento.findMany({
        where: { usuarioId, status: "approved" },
        select: { valor: true },
      }),
      this.prisma.pagamento.findMany({
        where: { usuarioId, status: "approved", aprovadoEm: { gte: desde } },
        select: { tipo: true, aprovadoEm: true },
      }),
      this.prisma.pagamento.findMany({
        where: { usuarioId, status: "approved" },
        orderBy: { aprovadoEm: "desc" },
        take: 5,
        include: { cifra: { select: { titulo: true } }, apostila: { select: { titulo: true } } },
      }),
    ]);

    const receitaCentavos = pagamentosAprovados.reduce(
      (soma, p) => soma + Math.round(Number.parseFloat(p.valor.toString()) * 100),
      0,
    );

    const porSemana = new Map();
    for (const p of pagamentosNoPeriodo) {
      const semana = chaveDaSemana(p.aprovadoEm);
      const atual = porSemana.get(semana) ?? { semana, novas: 0, edicoes: 0 };
      if (p.tipo === "criacao") atual.novas += 1;
      else atual.edicoes += 1;
      porSemana.set(semana, atual);
    }
    const exportacoesPorSemana = [...porSemana.values()].sort((a, b) =>
      a.semana.localeCompare(b.semana),
    );

    const pagamentosRecentes = pagamentosRecentesRaw.map((p) => ({
      id: p.id,
      titulo: p.apostila?.titulo ?? p.cifra?.titulo ?? "—",
      detalhe: p.apostilaId ? "Modo Apostila" : (LABEL_TIPO[p.tipo] ?? p.tipo),
      valor: Number.parseFloat(p.valor.toString()),
      status: p.status,
    }));

    return {
      kpis: {
        cifrasCriadas,
        pdfsExportados,
        receitaCentavos,
        reexportacoesGratis,
      },
      exportacoesPorSemana,
      pagamentosRecentes,
    };
  }
}

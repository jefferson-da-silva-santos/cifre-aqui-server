import AbstractService from "../AbstractService.js";
import { ApiError } from "../../utils/ApiError.js";
import { paginate, buildMeta } from "../../utils/pagination.js";
import { isAcordeReconhecido } from "../../utils/chordParser.js";
import TransposicaoService from "../transposicao/TransposicaoService.js";

const transposicaoService = new TransposicaoService();

// Anota cada acorde com `reconhecido` (seção 4.3) sem nunca bloquear a gravação —
// acorde não reconhecido só afeta a exibição de diagrama automático depois.
function anotarReconhecimento(blocos) {
  return blocos.map((bloco) => ({
    ...bloco,
    linhas: bloco.linhas.map((linha) => ({
      ...linha,
      acordes: linha.acordes.map((a) => ({ ...a, reconhecido: isAcordeReconhecido(a.nome) })),
      // linhaRitmo é texto livre (ex: ". . [F#o7] |") — não há acorde estruturado
      // aqui para anotar; os acordes embutidos entre colchetes são só recalculados
      // na transposição (TransposicaoService), nunca bloqueiam nem são validados.
    })),
  }));
}

// Resumo leve usado em GET /cifras (evita o frontend ter que varrer `blocos`
// toda vez só para mostrar contagem/dinâmicas usadas na listagem).
function resumir(cifra) {
  const blocos = cifra.blocos ?? [];
  const dinamicas = [...new Set(blocos.map((b) => b.dinamica).filter(Boolean))];
  return { ...cifra, totalBlocos: blocos.length, dinamicas };
}

export default class CifraService extends AbstractService {
  constructor(cifraRepository, acordeCustomizadoRepository, auditService) {
    super(cifraRepository);
    this.acordeCustomizadoRepository = acordeCustomizadoRepository;
    this.auditService = auditService;
  }

  async criar(usuarioId, dados, ctx = {}) {
    const blocosAnotados = anotarReconhecimento(dados.blocos ?? []);

    const cifra = await this.repository.create({
      usuarioId,
      titulo: dados.titulo,
      artista: dados.artista ?? null,
      observacoes: dados.observacoes ?? null,
      tom: dados.tom,
      instrumento: dados.instrumento,
      blocos: blocosAnotados,
      configuracaoPdf: this.mesclarConfigPadrao(dados.configuracaoPdf),
      status: "rascunho",
    });

    await this.auditService.log("cifra.criada", "cifra", cifra.id, {}, {
      usuarioId,
      requestId: ctx.requestId,
    });

    return cifra;
  }

  mesclarConfigPadrao(config = {}) {
    return {
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
      ...config,
    };
  }

  async obterOuFalhar(id, usuarioId) {
    const cifra = await this.repository.findByIdAndUsuario(id, usuarioId);
    if (!cifra) throw ApiError.notFound("Cifra não encontrada.");
    return cifra;
  }

  async listar(usuarioId, filtros) {
    const { skip, take, page, limit } = { skip: (filtros.page - 1) * filtros.limit, take: filtros.limit, page: filtros.page, limit: filtros.limit };

    const where = {};
    if (filtros.status) where.status = filtros.status;
    if (filtros.busca) {
      where.OR = [
        { titulo: { contains: filtros.busca, mode: "insensitive" } },
        { artista: { contains: filtros.busca, mode: "insensitive" } },
      ];
    }

    const [itens, total] = await Promise.all([
      this.repository.listByUsuario(usuarioId, { where, skip, take }),
      this.repository.countByUsuario(usuarioId, where),
    ]);

    return { itens: itens.map(resumir), meta: buildMeta({ page, limit, total }) };
  }

  async atualizar(id, usuarioId, dados, ctx = {}) {
    await this.obterOuFalhar(id, usuarioId);

    const patch = { ...dados };
    if (patch.blocos) patch.blocos = anotarReconhecimento(patch.blocos);
    if (patch.configuracaoPdf) {
      const atual = await this.repository.findById(id);
      patch.configuracaoPdf = { ...atual.configuracaoPdf, ...patch.configuracaoPdf };
    }

    const cifra = await this.repository.update(id, patch);

    await this.auditService.log("cifra.editada", "cifra", id, { campos: Object.keys(dados) }, {
      usuarioId,
      requestId: ctx.requestId,
    });

    return cifra;
  }

  /** Clona uma cifra como novo rascunho independente (sem histórico de pagamento). */
  async duplicar(id, usuarioId, ctx = {}) {
    const original = await this.obterOuFalhar(id, usuarioId);

    const copia = await this.repository.create({
      usuarioId,
      titulo: `${original.titulo} (cópia)`,
      artista: original.artista,
      observacoes: original.observacoes,
      tom: original.tom,
      instrumento: original.instrumento,
      blocos: original.blocos,
      acordesCustomizadosUsados: original.acordesCustomizadosUsados,
      configuracaoPdf: original.configuracaoPdf,
      status: "rascunho",
    });

    await this.auditService.log(
      "cifra.duplicada",
      "cifra",
      copia.id,
      { origemId: id },
      { usuarioId, requestId: ctx.requestId },
    );

    return copia;
  }

  async excluir(id, usuarioId, ctx = {}) {
    await this.obterOuFalhar(id, usuarioId);
    await this.repository.delete(id);
    await this.auditService.log("cifra.excluida", "cifra", id, {}, {
      usuarioId,
      requestId: ctx.requestId,
    });
  }

  async transpor(id, usuarioId, semitons, ctx = {}) {
    if (semitons === 0) return this.obterOuFalhar(id, usuarioId);

    const cifra = await this.obterOuFalhar(id, usuarioId);

    // Regra 4.5 / 5: transposição é não destrutiva no rascunho — o campo `tom` e
    // os acordes de todos os blocos são recalculados em cascata, sem afetar
    // status de pagamento (o diff no momento da exportação é quem decide cobrança).
    const resultado = transposicaoService.transporCifra(
      { tom: cifra.tom, blocos: cifra.blocos },
      semitons,
    );

    const atualizada = await this.repository.update(id, {
      tom: resultado.tom,
      blocos: resultado.blocos,
    });

    await this.auditService.log(
      "cifra.transposta",
      "cifra",
      id,
      { semitons, tomAnterior: cifra.tom, tomNovo: resultado.tom },
      { usuarioId, requestId: ctx.requestId },
    );

    return atualizada;
  }

  /** Bloqueia exportação de cifra sem nenhum bloco/conteúdo (seção 14). */
  validarConteudoExportavel(cifra) {
    const temConteudo = (cifra.blocos ?? []).some(
      (b) => (b.linhas ?? []).some((l) => l.letra?.trim() || (l.acordes ?? []).length > 0),
    );
    if (!temConteudo) {
      throw ApiError.badRequest(
        "Esta cifra ainda não tem conteúdo (letra ou acordes). Adicione algo antes de exportar.",
      );
    }
  }
}

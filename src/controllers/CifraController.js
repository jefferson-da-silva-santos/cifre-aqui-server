import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export default class CifraController {
  constructor(cifraService) {
    this.cifraService = cifraService;

    this.criar = asyncHandler(this.criar.bind(this));
    this.listar = asyncHandler(this.listar.bind(this));
    this.obter = asyncHandler(this.obter.bind(this));
    this.atualizar = asyncHandler(this.atualizar.bind(this));
    this.excluir = asyncHandler(this.excluir.bind(this));
    this.transpor = asyncHandler(this.transpor.bind(this));
    this.duplicar = asyncHandler(this.duplicar.bind(this));
  }

  async criar(req, res) {
    const cifra = await this.cifraService.criar(req.user.id, req.body, { requestId: req.id });
    return ApiResponse.created(res, { data: cifra, message: "Cifra criada." });
  }

  async listar(req, res) {
    const { itens, meta } = await this.cifraService.listar(req.user.id, req.query);
    return ApiResponse.success(res, { data: itens, meta });
  }

  async obter(req, res) {
    const cifra = await this.cifraService.obterOuFalhar(req.params.id, req.user.id);
    return ApiResponse.success(res, { data: cifra });
  }

  async atualizar(req, res) {
    const cifra = await this.cifraService.atualizar(req.params.id, req.user.id, req.body, {
      requestId: req.id,
    });
    return ApiResponse.success(res, { data: cifra, message: "Cifra atualizada." });
  }

  async excluir(req, res) {
    await this.cifraService.excluir(req.params.id, req.user.id, { requestId: req.id });
    return ApiResponse.noContent(res);
  }

  async transpor(req, res) {
    const cifra = await this.cifraService.transpor(
      req.params.id,
      req.user.id,
      req.body.semitons,
      { requestId: req.id },
    );
    return ApiResponse.success(res, { data: cifra, message: "Cifra transposta." });
  }

  async duplicar(req, res) {
    const copia = await this.cifraService.duplicar(req.params.id, req.user.id, {
      requestId: req.id,
    });
    return ApiResponse.created(res, { data: copia, message: "Cifra duplicada." });
  }
}

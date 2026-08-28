import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export default class AcordeCustomizadoController {
  constructor(acordeCustomizadoService) {
    this.acordeCustomizadoService = acordeCustomizadoService;

    this.criar = asyncHandler(this.criar.bind(this));
    this.listar = asyncHandler(this.listar.bind(this));
    this.atualizar = asyncHandler(this.atualizar.bind(this));
    this.excluir = asyncHandler(this.excluir.bind(this));
  }

  async criar(req, res) {
    const acorde = await this.acordeCustomizadoService.criar(req.user.id, req.body);
    return ApiResponse.created(res, { data: acorde, message: "Acorde customizado criado." });
  }

  async listar(req, res) {
    const acordes = await this.acordeCustomizadoService.listar(req.user.id);
    return ApiResponse.success(res, { data: acordes });
  }

  async atualizar(req, res) {
    const acorde = await this.acordeCustomizadoService.atualizar(
      req.params.id,
      req.user.id,
      req.body,
    );
    return ApiResponse.success(res, { data: acorde, message: "Acorde customizado atualizado." });
  }

  async excluir(req, res) {
    await this.acordeCustomizadoService.excluir(req.params.id, req.user.id);
    return ApiResponse.noContent(res);
  }
}

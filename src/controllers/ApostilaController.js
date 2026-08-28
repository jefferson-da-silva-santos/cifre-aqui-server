import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { buildDownloadUrl } from "../utils/downloadUrl.js";

export default class ApostilaController {
  constructor(apostilaService) {
    this.apostilaService = apostilaService;

    this.criar = asyncHandler(this.criar.bind(this));
    this.baixar = asyncHandler(this.baixar.bind(this));
    this.orcar = asyncHandler(this.orcar.bind(this));
  }

  async orcar(req, res) {
    const orcamento = await this.apostilaService.orcar(req.user.id, { cifraIds: req.body.cifraIds });
    return ApiResponse.success(res, { data: orcamento });
  }

  async criar(req, res) {
    const resultado = await this.apostilaService.criarESolicitarExportacao(
      req.user.id,
      { titulo: req.body.titulo, cifraIds: req.body.cifraIds },
      req.body.metodo ?? "PIX",
      { requestId: req.id },
    );

    if (resultado.gratuito) {
      return ApiResponse.success(res, {
        message: "Apostila gerada sem cobrança (todas as cifras já pagas e sem alteração).",
        data: { gratuito: true, downloadUrl: buildDownloadUrl(resultado.pdf.fileName) },
      });
    }

    return ApiResponse.success(res, {
      message: "Checkout da apostila iniciado.",
      data: resultado,
    });
  }

  async baixar(req, res) {
    const pdf = await this.apostilaService.gerarPdfConsolidado(req.user.id, req.params.id);
    return ApiResponse.success(res, { data: { downloadUrl: buildDownloadUrl(pdf.fileName) } });
  }
}

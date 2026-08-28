import { randomUUID } from "crypto";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { buildDownloadUrl } from "../utils/downloadUrl.js";

export default class ExportacaoController {
  constructor(exportacaoService) {
    this.exportacaoService = exportacaoService;

    this.iniciar = asyncHandler(this.iniciar.bind(this));
    this.status = asyncHandler(this.status.bind(this));
    this.reprocessar = asyncHandler(this.reprocessar.bind(this));
    this.orcar = asyncHandler(this.orcar.bind(this));
    this.exportar = asyncHandler(this.exportar.bind(this));
    this.statusExportacao = asyncHandler(this.statusExportacao.bind(this));
  }

  async iniciar(req, res) {
    const resultado = await this.exportacaoService.iniciarExportacao(
      req.user.id,
      req.params.id,
      req.body.metodo,
      { requestId: req.id },
    );

    if (resultado.gratuito) {
      return ApiResponse.success(res, {
        message: "PDF gerado sem cobrança (sem alterações desde a última exportação paga).",
        data: { gratuito: true, downloadUrl: buildDownloadUrl(resultado.pdf.fileName) },
      });
    }

    return ApiResponse.success(res, {
      message: "Checkout iniciado.",
      data: {
        gratuito: false,
        pagamentoId: resultado.pagamento.id,
        valor: resultado.pagamento.valor,
        tipo: resultado.pagamento.tipo,
        publicKey: resultado.publicKey,
        apiBaseUrl: resultado.apiBaseUrl,
        externalReference: resultado.pagamento.externalReference,
      },
    });
  }

  async status(req, res) {
    const pagamento = await this.exportacaoService.consultarStatus(req.user.id, req.params.pagamentoId);
    return ApiResponse.success(res, { data: pagamento });
  }

  async reprocessar(req, res) {
    const pdf = await this.exportacaoService.reprocessarPdf(req.user.id, req.params.pagamentoId, {
      requestId: req.id,
    });
    return ApiResponse.success(res, {
      message: "PDF reprocessado.",
      data: { downloadUrl: buildDownloadUrl(pdf.fileName) },
    });
  }

  /** GET /cifras/:id/export-quote — orçamento sem efeitos colaterais. */
  async orcar(req, res) {
    const quote = await this.exportacaoService.orcar(req.user.id, req.params.id);
    return ApiResponse.success(res, { data: quote });
  }

  /**
   * POST /cifras/:id/export — variante "job" (ExportJob) do mesmo fluxo de
   * `/cifras/:id/exportacoes`, usada pelo frontend: já libera o PDF de cara
   * quando é grátis, ou devolve um `exportId` (= id do pagamento) para o
   * frontend fazer polling em GET /exports/:exportId.
   */
  async exportar(req, res) {
    const resultado = await this.exportacaoService.iniciarExportacao(
      req.user.id,
      req.params.id,
      req.body.metodo,
      { requestId: req.id },
      req.body.configuracaoPdf,
    );

    if (resultado.gratuito) {
      return ApiResponse.success(res, {
        message: "PDF gerado sem cobrança.",
        data: {
          exportId: `gratuito-${randomUUID()}`,
          status: "concluido",
          downloadUrl: buildDownloadUrl(resultado.pdf.fileName),
          pagamentoId: null,
        },
      });
    }

    return ApiResponse.success(res, {
      message: "Checkout iniciado.",
      data: {
        exportId: resultado.pagamento.id,
        status: "aguardando_pagamento",
        downloadUrl: null,
        pagamentoId: resultado.pagamento.id,
      },
    });
  }

  /** GET /exports/:exportId — polling do job de exportação criado em POST /cifras/:id/export. */
  async statusExportacao(req, res) {
    const pagamento = await this.exportacaoService.consultarStatus(req.user.id, req.params.exportId);

    if (pagamento.status === "pending") {
      return ApiResponse.success(res, {
        data: {
          exportId: pagamento.id,
          status: "aguardando_pagamento",
          downloadUrl: null,
          pagamentoId: pagamento.id,
        },
      });
    }

    if (pagamento.status === "rejected") {
      return ApiResponse.success(res, {
        data: {
          exportId: pagamento.id,
          status: "falhou",
          downloadUrl: null,
          pagamentoId: pagamento.id,
          mensagem: "Pagamento não aprovado.",
        },
      });
    }

    // approved — gera (ou regera) o PDF na hora, sem cobrar de novo.
    const pdf = await this.exportacaoService.reprocessarPdf(req.user.id, pagamento.id, {
      requestId: req.id,
    });
    return ApiResponse.success(res, {
      data: {
        exportId: pagamento.id,
        status: "concluido",
        downloadUrl: buildDownloadUrl(pdf.fileName),
        pagamentoId: pagamento.id,
      },
    });
  }
}

export class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }

  static badRequest(message, details = null) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = "Não autenticado.") {
    return new ApiError(401, message);
  }

  static paymentRequired(message = "Pagamento necessário.", details = null) {
    return new ApiError(402, message, details);
  }

  static forbidden(message = "Acesso negado.") {
    return new ApiError(403, message);
  }

  static notFound(message = "Recurso não encontrado.") {
    return new ApiError(404, message);
  }

  static conflict(message = "Conflito de estado.", details = null) {
    return new ApiError(409, message, details);
  }

  static internal(message = "Erro interno do servidor.") {
    return new ApiError(500, message);
  }
}

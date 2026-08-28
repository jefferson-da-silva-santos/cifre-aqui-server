export class ApiResponse {
  static success(res, { data = null, message = "OK", meta = null, status = 200 } = {}) {
    return res.status(status).json({ success: true, message, data, meta });
  }

  static created(res, { data = null, message = "Criado com sucesso." } = {}) {
    return this.success(res, { data, message, status: 201 });
  }

  static noContent(res) {
    return res.status(204).send();
  }

  static error(res, { message = "Erro interno.", status = 500, details = null, requestId } = {}) {
    return res.status(status).json({ success: false, message, details, requestId });
  }
}

import { ApiError } from "../utils/ApiError.js";

// Valida req[source] contra um schema Zod e substitui pelo dado já parseado
// (com defaults aplicados), padronizando o que os controllers recebem.
export function validate(schema, source = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(ApiError.badRequest("Dados inválidos.", result.error.flatten()));
    }
    req[source] = result.data;
    next();
  };
}

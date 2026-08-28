import sanitizeHtml from "sanitize-html";

const OPTS = { allowedTags: [], allowedAttributes: {} };

function limpar(valor) {
  if (typeof valor === "string") return sanitizeHtml(valor, OPTS);
  if (Array.isArray(valor)) return valor.map(limpar);
  if (valor && typeof valor === "object") {
    const out = {};
    for (const key of Object.keys(valor)) out[key] = limpar(valor[key]);
    return out;
  }
  return valor;
}

// Sanitiza recursivamente o corpo da requisição — importante aqui porque o
// conteúdo de uma cifra (letra, anotações, título) é texto livre digitado pelo
// usuário e acaba renderizado depois (preview e PDF via Puppeteer).
export function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = limpar(req.body);
  }
  next();
}

import { normalizarNota } from "./harmonicFields.js";

const NOTA = "[A-G](?:#|b)?";
const REGEX_ACORDE = new RegExp(`^(${NOTA})([^/]*)(?:/(${NOTA}))?$`);

/**
 * Decompõe um nome de acorde em fundamental, resto (qualidade+extensões) e baixo (slash).
 * Ex: "Cm7(b5)/Eb" -> { fundamental: "C", resto: "m7(b5)", baixo: "Eb" }
 */
export function parseAcorde(nome) {
  const match = REGEX_ACORDE.exec(nome.trim());
  if (!match) return null;
  const [, fundamental, resto, baixo] = match;
  return { fundamental, resto: resto ?? "", baixo: baixo ?? null };
}

/**
 * Extrai a "qualidade base" (a que aparece nas tabelas de campo harmônico:
 * maior, menor, diminuto ou aumentado) e o restante da extensão (7, 9, maj7, sus4...).
 */
export function separarQualidadeBase(resto) {
  if (/^m(?!aj)/.test(resto)) {
    return { qualidadeBase: "m", extensao: resto.slice(1) };
  }
  if (/^dim/.test(resto) || /^°/.test(resto)) {
    const offset = resto.startsWith("dim") ? 3 : 1;
    return { qualidadeBase: "dim", extensao: resto.slice(offset) };
  }
  if (/^\+/.test(resto) || /^aug/.test(resto)) {
    const offset = resto.startsWith("aug") ? 3 : 1;
    return { qualidadeBase: "aug", extensao: resto.slice(offset) };
  }
  return { qualidadeBase: "", extensao: resto };
}

/**
 * Decompõe um item de tabela de campo harmônico (ex: "Bdim", "C+", "Am", "G")
 * em fundamental + qualidadeBase, para permitir comparação.
 */
export function decomporEntradaCampo(entrada) {
  const parsed = parseAcorde(entrada);
  const { qualidadeBase } = separarQualidadeBase(parsed.resto);
  return { fundamental: parsed.fundamental, qualidadeBase };
}

export function montarNomeAcorde({ fundamental, resto = "", baixo = null }) {
  return `${fundamental}${resto}${baixo ? `/${baixo}` : ""}`;
}

export function mesmaNota(a, b) {
  return normalizarNota(a) === normalizarNota(b);
}
